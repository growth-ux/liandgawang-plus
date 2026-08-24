"""粮掌柜 LangGraph 编排：专业小二并行办理、依赖办理、冲突检测与综合建议。

每个专业 worker 使用自己的 SQLAlchemy Session，严禁多线程共享请求 Session。
"""

import logging
import random
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from datetime import datetime, timedelta, timezone
from typing import Callable, TypedDict

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session, sessionmaker

from app.zhanggui import repository, zlog
from app.zhanggui.adapters.base import AgentContext, failed_result, run_agent
from app.zhanggui.conflict_rules import detect_conflicts
from app.zhanggui.schemas import AgentResult, MissionConflict, MissionGoal
from app.zhanggui.synthesizer import build_recommendation

logger = logging.getLogger("zhanggui.graph")
CHINA_TZ = timezone(timedelta(hours=8))

WORKER_TIMEOUT_SECONDS = 30
PARALLEL_AGENTS = ["zhan", "liang", "yun", "qian"]

# 模拟每个小二的真实办理耗时（秒），让前端能看到动态过程
_AGENT_SIM_DELAY: dict[str, tuple[float, float]] = {
    "zhan": (2.0, 3.5),   # 粮小二
    "liang": (3.0, 5.0),  # 粮小二（寻源较慢）
    "yun": (2.5, 4.0),    # 运小二
    "qian": (1.5, 2.5),   # 钱小二
    "suan": (2.0, 3.5),   # 算小二
    "an": (2.0, 3.0),     # 安小二
}

# SQLite（测试）单连接不能真正并发，用锁串行 worker；MySQL 不受影响
_WORKER_LOCK = threading.Lock()


class MissionGraphState(TypedDict, total=False):
    mission_id: int
    goal: dict
    selected_agents: list[str]
    results: dict[str, dict]
    conflicts: list[dict]
    recommendation: dict


def _emit(emit: Callable[[dict], None], event_type: str, mission_id: int, agent_id: str | None = None, payload: dict | None = None) -> None:
    emit({"type": event_type, "mission_id": mission_id, "agent_id": agent_id, "payload": payload or {}})


def _need_sqlite_lock(session_factory: sessionmaker) -> bool:
    session = session_factory()
    try:
        return session.get_bind().url.get_backend_name() == "sqlite"
    finally:
        session.close()


def _run_worker(session_factory: sessionmaker, agent_id: str, mission_id: int, goal: MissionGoal, prior: dict[str, dict], use_lock: bool) -> AgentResult:
    """单个专业小二的独立运行：自建 Session，异常结构化降级。

    SQLite（测试）使用 StaticPool 单连接：worker 必须在锁内完成整个生命周期，
    否则未关闭的读事务会阻塞父线程写入；MySQL 不受锁影响。
    """
    logger.info("[任务 %s] _run_worker 进入: agent=%s, use_lock=%s", mission_id, agent_id, use_lock)
    prior_results = {key: AgentResult.model_validate(value) for key, value in prior.items()}

    def _invoke() -> AgentResult:
        logger.info("[任务 %s] %s _invoke 开始，创建 session", mission_id, agent_id)
        # 模拟真实办理耗时
        lo, hi = _AGENT_SIM_DELAY.get(agent_id, (1.5, 3.0))
        delay = random.uniform(lo, hi)
        zlog(f"[graph] {agent_id} 开始办理（预计 {delay:.1f}s）")
        time.sleep(delay)
        session = session_factory()
        try:
            context = AgentContext(mission_id=mission_id, goal=goal, prior_results=prior_results)
            logger.info("[任务 %s] %s 调用 run_agent", mission_id, agent_id)
            result = run_agent(agent_id, session, context)
            logger.info("[任务 %s] %s run_agent 返回, status=%s", mission_id, agent_id, result.status)
            return result
        except Exception as exc:  # run_agent 已兗底，这里是双保险
            logger.error("[任务 %s] %s run_agent 异常：%s", mission_id, agent_id, exc, exc_info=True)
            return failed_result(agent_id, exc)
        finally:
            session.close()

    if use_lock:
        logger.info("[任务 %s] %s 等待 _WORKER_LOCK", mission_id, agent_id)
        with _WORKER_LOCK:
            logger.info("[任务 %s] %s 获取 _WORKER_LOCK 成功", mission_id, agent_id)
            return _invoke()
    return _invoke()


def _build_graph(session_factory: sessionmaker, emit: Callable[[dict], None], use_lock: bool):
    def _persist_result(agent_id: str, mission_id: int, result: AgentResult, reason: str = "") -> None:
        def _write() -> None:
            session = session_factory()
            try:
                repository.upsert_agent_run(
                    session, mission_id, agent_id,
                    status=result.status,
                    participation_reason=reason,
                    output_snapshot=result.model_dump(mode="json"),
                    finished_at=datetime.now(),
                )
            finally:
                session.close()

        # SQLite 单连接下写入也必须与 worker 串行，避免丢失更新；MySQL 不受影响
        if use_lock:
            with _WORKER_LOCK:
                _write()
        else:
            _write()

    def _run_single(agent_id: str, state: MissionGraphState, prior: dict[str, dict], reason: str = "") -> AgentResult:
        mission_id = state["mission_id"]
        goal = MissionGoal.model_validate(state["goal"])
        logger.info("[任务 %s] %s 开始办理", mission_id, agent_id)
        _emit(emit, "agent_started", mission_id, agent_id)
        result = _run_worker(session_factory, agent_id, mission_id, goal, prior, use_lock)
        _persist_result(agent_id, mission_id, result, reason)
        if result.status == "failed":
            logger.warning("[任务 %s] %s 办理失败：%s", mission_id, agent_id, result.summary)
            _emit(emit, "agent_failed", mission_id, agent_id, {"summary": result.summary, "status": result.status})
        else:
            logger.info("[任务 %s] %s 办理完成（%s）：%s", mission_id, agent_id, result.status, result.summary)
            _emit(emit, "agent_completed", mission_id, agent_id, {"summary": result.summary, "status": result.status})
        return result

    def parallel_professionals_node(state: MissionGraphState) -> dict:
        zlog(f"[graph] ===== 并行节点进入: mission_id={state['mission_id']} =====")
        logger.info("[任务 %s] ===== 并行节点进入 =====", state["mission_id"])
        results = dict(state.get("results", {}))
        logger.info("[任务 %s] selected_agents=%s, 已有 results=%s",
                    state["mission_id"], state["selected_agents"], list(results.keys()))
        targets = [
            agent_id for agent_id in state["selected_agents"]
            if agent_id in PARALLEL_AGENTS and agent_id not in results
        ]
        zlog(f"[graph] 并行办理目标: {targets}, 已完成: {list(results.keys())}")
        mission_id = state["mission_id"]
        if not targets:
            logger.info("[任务 %s] 并行阶段无新增小二（均已完成或不在团队）", mission_id)
            return {}
        logger.info("[任务 %s] 并行办理启动：%s (共 %d 个)", mission_id, "、".join(targets), len(targets))
        logger.info("[任务 %s] 创建 ThreadPoolExecutor (max_workers=4)", mission_id)
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = {}
            for agent_id in targets:
                logger.info("[任务 %s] 提交 %s 到线程池", mission_id, agent_id)
                futures[agent_id] = pool.submit(
                    _run_worker, session_factory, agent_id, mission_id,
                    MissionGoal.model_validate(state["goal"]), {}, use_lock
                )
            logger.info("[任务 %s] 所有 worker 已提交，发送 agent_started 事件", mission_id)
            for agent_id in targets:
                _emit(emit, "agent_started", mission_id, agent_id)
            logger.info("[任务 %s] 开始等待 worker 结果 (超时=%ss)", mission_id, WORKER_TIMEOUT_SECONDS)
            for agent_id, future in futures.items():
                zlog(f"[graph] 等待 {agent_id} 结果...")
                logger.info("[任务 %s] 等待 %s 的 future...", mission_id, agent_id)
                try:
                    result = future.result(timeout=WORKER_TIMEOUT_SECONDS)
                    logger.info("[任务 %s] %s future 返回, status=%s", mission_id, agent_id, result.status)
                except FutureTimeout:
                    logger.error("[任务 %s] %s 办理超时（%ss）", mission_id, agent_id, WORKER_TIMEOUT_SECONDS)
                    result = failed_result(agent_id, TimeoutError(f"{agent_id} 专业办理超时"))
                except Exception as exc:
                    logger.error("[任务 %s] %s future 异常：%s", mission_id, agent_id, exc, exc_info=True)
                    result = failed_result(agent_id, exc)
                _persist_result(agent_id, mission_id, result)
                results[agent_id] = result.model_dump(mode="json")
                if result.status == "failed":
                    zlog(f"[graph] {agent_id} 办理失败: {result.summary}")
                    logger.warning("[任务 %s] %s 办理失败：%s", mission_id, agent_id, result.summary)
                    _emit(emit, "agent_failed", mission_id, agent_id, {"summary": result.summary, "status": result.status})
                else:
                    zlog(f"[graph] {agent_id} 办理完成 ({result.status}): {result.summary}")
                    logger.info("[任务 %s] %s 办理完成（%s）：%s", mission_id, agent_id, result.status, result.summary)
                    _emit(emit, "agent_completed", mission_id, agent_id, {"summary": result.summary, "status": result.status})
        logger.info("[任务 %s] ===== 并行节点完成，共 %d 个结果 =====", mission_id, len(results))
        zlog(f"[graph] ===== 并行节点完成: {len(results)} 个结果 =====")
        return {"results": results}

    def dependent_costing_node(state: MissionGraphState) -> dict:
        zlog(f"[graph] 算小二(依赖办理)节点进入")
        results = dict(state.get("results", {}))
        if "suan" not in state["selected_agents"] or "suan" in results:
            return {}
        result = _run_single("suan", state, results, "需要把粮源和运输结果组合成多套方案比较综合成本")
        return {"results": {**results, "suan": result.model_dump(mode="json")}}

    def risk_review_node(state: MissionGraphState) -> dict:
        zlog(f"[graph] 安小二(风险审核)节点进入")
        results = dict(state.get("results", {}))
        if "an" not in state["selected_agents"] or "an" in results:
            return {}
        result = _run_single("an", state, results, "需要审核供应方履约证据与质量、交付风险")
        return {"results": {**results, "an": result.model_dump(mode="json")}}

    def conflict_node(state: MissionGraphState) -> dict:
        zlog(f"[graph] 冲突检测节点进入")
        goal = MissionGoal.model_validate(state["goal"])
        results = {key: AgentResult.model_validate(value) for key, value in state.get("results", {}).items()}
        conflicts = detect_conflicts(goal, results)
        merged = dict(state.get("results", {}))

        # 定向补充：只重新运行冲突直接关联的小二一次，补充后不再循环
        supplement_agents = sorted({
            agent_id
            for conflict in conflicts
            if not conflict.supplement_requested
            for agent_id in conflict.agent_ids
        })
        supplemented = False
        for agent_id in supplement_agents:
            if agent_id not in merged:
                continue
            supplemented = True
            _emit(emit, "agent_started", state["mission_id"], agent_id, {"supplement": True})
            result = _run_single(agent_id, state, merged, "响应粮掌柜的一次定向补充")
            merged[agent_id] = result.model_dump(mode="json")
            _emit(emit, "agent_completed", state["mission_id"], agent_id, {"supplement": True})
        if supplemented:
            results = {key: AgentResult.model_validate(value) for key, value in merged.items()}
            conflicts = detect_conflicts(goal, results)

        conflict_dicts = []
        occurred_at = datetime.now(CHINA_TZ).isoformat()
        for conflict in conflicts:
            if supplemented:
                conflict.supplement_requested = True
            conflict_with_time = conflict.model_copy(update={"occurred_at": conflict.occurred_at or occurred_at})
            conflict_dict = conflict_with_time.model_dump(mode="json")
            conflict_dicts.append(conflict_dict)
            _emit(emit, "conflict_found", state["mission_id"], None, conflict_dict)
        if conflict_dicts:
            logger.info(
                "[任务 %s] 冲突检测完成：%s（定向补充：%s）",
                state["mission_id"],
                "、".join(c["kind"] for c in conflict_dicts),
                "已执行" if supplemented else "未执行",
            )
        else:
            logger.info("[任务 %s] 冲突检测完成：未发现跨专业冲突", state["mission_id"])
        return {"results": merged, "conflicts": conflict_dicts}

    def synthesis_node(state: MissionGraphState) -> dict:
        zlog(f"[graph] 综合建议节点进入")
        goal = MissionGoal.model_validate(state["goal"])
        results = {key: AgentResult.model_validate(value) for key, value in state.get("results", {}).items()}
        conflicts = [MissionConflict.model_validate(item) for item in state.get("conflicts", [])]
        suan = results.get("suan")
        if suan is None or suan.status == "failed" or not suan.facts.get("recommended_scheme_id"):
            logger.warning("[任务 %s] 无法形成可用方案（算小二结果缺失或失败）", state["mission_id"])
            return {"recommendation": {}}
        recommendation = build_recommendation(goal, results, conflicts)
        logger.info(
            "[任务 %s] 综合建议生成：主推方案 %s，备选 %s，生效条件：%s",
            state["mission_id"],
            recommendation.primary_scheme_id,
            recommendation.backup_scheme_id or "无",
            recommendation.condition or "无",
        )
        _emit(emit, "recommendation_ready", state["mission_id"], None, {"primary_scheme_id": recommendation.primary_scheme_id})
        return {"recommendation": recommendation.model_dump(mode="json")}

    builder = StateGraph(MissionGraphState)
    builder.add_node("parallel_professionals", parallel_professionals_node)
    builder.add_node("dependent_costing", dependent_costing_node)
    builder.add_node("risk_review", risk_review_node)
    builder.add_node("detect_conflicts", conflict_node)
    builder.add_node("synthesize", synthesis_node)
    builder.add_edge(START, "parallel_professionals")
    builder.add_edge("parallel_professionals", "dependent_costing")
    builder.add_edge("dependent_costing", "risk_review")
    builder.add_edge("risk_review", "detect_conflicts")
    builder.add_edge("detect_conflicts", "synthesize")
    builder.add_edge("synthesize", END)
    return builder.compile()


def run_professional_graph(session_factory: sessionmaker, mission_snapshot: dict, emit: Callable[[dict], None]) -> dict:
    """从任务快照重建图状态并运行；已完成的小二不重复运行。"""
    zlog(f"[graph] run_professional_graph 进入")
    logger.info("[图] run_professional_graph 进入")
    results = {
        run["agent_id"]: run["output_snapshot"]
        for run in mission_snapshot.get("agent_runs", [])
        if run["output_snapshot"] and run["status"] in ("completed", "completed_with_objection", "failed")
    }
    state: MissionGraphState = {
        "mission_id": mission_snapshot["id"],
        "goal": mission_snapshot.get("goal", {}),
        "selected_agents": [member["agent_id"] for member in mission_snapshot.get("team", []) if member.get("selected")],
        "results": results,
        "conflicts": mission_snapshot.get("conflicts", []) or [],
        "recommendation": mission_snapshot.get("recommendation") or {},
    }
    logger.info("[图] 任务 %s: selected_agents=%s, 已有 results=%s",
                state["mission_id"], state["selected_agents"], list(results.keys()))
    use_lock = _need_sqlite_lock(session_factory)
    zlog(f"[graph] 任务 {state['mission_id']}: agents={state['selected_agents']}, 已有结果={list(results.keys())}, use_lock={use_lock}")
    logger.info("[图] use_lock=%s", use_lock)
    graph = _build_graph(session_factory, emit, use_lock)
    logger.info("[图] 图构建完成，开始 invoke")
    zlog(f"[graph] 图构建完成，开始 invoke")
    final = graph.invoke(state)
    zlog(f"[graph] invoke 完成，返回 keys={list(final.keys())}")
    logger.info("[图] invoke 完成，返回 keys=%s", list(final.keys()))
    return final
