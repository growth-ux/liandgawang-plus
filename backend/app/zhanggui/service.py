"""粮掌柜用例层：管理任务状态转换与三个人工闸门。"""

import logging
import threading
from datetime import date, datetime
from typing import Callable

from sqlalchemy.orm import Session, sessionmaker

from app.knowledge import memory as knowledge_memory
from app.knowledge import repository as knowledge_repo
from app.zhanggui import repository, zlog
from app.zhanggui.goal_parser import parse_goal
from app.zhanggui.graph import run_professional_graph
from app.zhanggui.schemas import GoalPreview, MissionGoal, TeamMember
from app.zhanggui.team_rules import AGENT_NAMES, recommend_team

logger = logging.getLogger("zhanggui.service")

# 同一任务只允许一个运行实例：并发请求只回放快照，不重复运行小二
_RUNNING_MISSIONS: set[int] = set()
_RUN_LOCK = threading.Lock()


class MissionStateError(Exception):
    """任务状态不允许当前操作；路由层统一转换为 HTTP 409。"""


ALLOWED_TRANSITIONS = {
    "awaiting_goal_confirmation": {"awaiting_team_confirmation"},
    "awaiting_team_confirmation": {"running"},
    "running": {"awaiting_decision", "partially_completed", "failed"},
    "awaiting_decision": {"completed"},
    "partially_completed": {"completed"},
}

PLAN_DECISION_OPTIONS = [
    {
        "action": "verify_a",
        "label": "先核验主推供应方的履约担保",
        "description": "创建安小二风险核验任务；询价、备选保留与运输任务等待核验通过",
    },
    {
        "action": "choose_b",
        "label": "直接选择备选方案 B",
        "description": "放弃主推方案，立即为备选供应方创建询价和运输任务",
    },
]


def _session_factory(db: Session) -> sessionmaker:
    return sessionmaker(bind=db.get_bind())


def _get_mission_or_error(db: Session, mission_id: int):
    mission = repository.get_mission(db, mission_id)
    if mission is None:
        raise MissionStateError("任务不存在")
    return mission


def _transition(db: Session, mission, new_status: str) -> None:
    allowed = ALLOWED_TRANSITIONS.get(mission.status, set())
    if new_status not in allowed:
        raise MissionStateError(f"当前状态 {mission.status} 不允许进入 {new_status}")


def preview_mission(db: Session, text: str) -> GoalPreview:
    """解析自然语言目标；优先 mem0 记忆，失败回退企业经验表。"""
    memories = knowledge_memory.search_memories(text, limit=3)
    if not memories:
        try:
            memories = [item["content"] for item in knowledge_repo.list_experiences(db)[:3]]
        except Exception:
            logger.exception("企业经验查询失败，跳过历史经验引用")
            memories = []
    return parse_goal(text, today=date.today(), memories=memories)


def create_mission_from_preview(db: Session, raw_request: str, goal: dict, memories: list) -> dict:
    goal_obj = MissionGoal.model_validate(goal)
    memory_items = []
    for item in memories or []:
        if isinstance(item, str):
            memory_items.append({"content": item, "source": "企业过往经验"})
        elif isinstance(item, dict) and item.get("content"):
            memory_items.append({"content": item["content"], "source": item.get("source", "企业过往经验")})
    mission = repository.create_mission(
        db, raw_request=raw_request, goal=goal_obj.model_dump(), memory_references=memory_items,
    )
    return repository.get_mission_snapshot(db, mission.id)


def confirm_goal(db: Session, mission_id: int, goal: dict) -> dict:
    """目标确认闸门：确认关键条件后生成组队建议。"""
    mission = _get_mission_or_error(db, mission_id)
    if mission.status != "awaiting_goal_confirmation":
        raise MissionStateError("目标已确认，请勿重复操作")
    goal_obj = MissionGoal.model_validate(goal)
    team = [member.model_dump() for member in recommend_team(goal_obj)]

    decision = repository.create_decision(
        db, mission_id, "goal",
        "请确认本次采购的关键条件（品种、数量、交期、到货地、预算与质量底线）",
        [{"action": "confirm", "label": "确认目标"}, {"action": "edit", "label": "修改目标"}],
        "建议确认：关键条件已齐备，缺失项已标记为暂估",
    )
    repository.confirm_decision(db, decision, "confirm", "用户确认目标口径")

    repository.set_mission_state(
        db, mission,
        phase="team_confirmation",
        status="awaiting_team_confirmation",
        goal=goal_obj.model_dump(),
        team=team,
    )
    selected = [m for m in team if m["selected"]]
    logger.info(
        "[任务 %s] 目标已确认：%s %s 吨 → %s；组队建议 %d 位参与（%s）",
        mission_id, goal_obj.variety_name, goal_obj.quantity_tons or "—", goal_obj.destination or "—",
        len(selected), "、".join(m["agent_id"] for m in selected),
    )
    return repository.get_mission_snapshot(db, mission_id)


def confirm_team(db: Session, mission_id: int, team: list) -> dict:
    """团队确认闸门：确认参与小二后进入办理。"""
    mission = _get_mission_or_error(db, mission_id)
    if mission.status != "awaiting_team_confirmation":
        raise MissionStateError("团队已确认，请勿重复操作")
    members = [TeamMember.model_validate(item) for item in team]
    team_dicts = [member.model_dump() for member in members]

    decision = repository.create_decision(
        db, mission_id, "team",
        "请确认参与本次任务的专业小二与分工",
        [{"action": "confirm", "label": "确认团队"}, {"action": "edit", "label": "调整团队"}],
        "建议按当前组队执行；未参与小二的原因已说明",
    )
    repository.confirm_decision(db, decision, "confirm", "用户确认协作团队")

    repository.set_mission_state(db, mission, phase="parallel_execution", status="running", team=team_dicts)
    for member in members:
        if member.selected:
            repository.upsert_agent_run(db, mission_id, member.agent_id, participation_reason=member.reason, status="pending")
    selected = [m for m in members if m.selected]
    standby = [m.name for m in members if not m.selected]
    logger.info(
        "[任务 %s] 团队已确认：%d 位参与（%s）%s，进入并行办理",
        mission_id, len(selected), "、".join(m.agent_id for m in selected),
        f"；待命：{('、'.join(standby))}" if standby else "",
    )
    return repository.get_mission_snapshot(db, mission_id)


def _emit(emit: Callable[[dict], None], event_type: str, mission_id: int, payload: dict | None = None) -> None:
    emit({"type": event_type, "mission_id": mission_id, "agent_id": None, "payload": payload or {}})


def run_until_gate(db: Session, mission_id: int, emit: Callable[[dict], None]) -> dict:
    """运行或恢复任务，直到下一个人工闸门。"""
    zlog(f"[run_until_gate] 任务 {mission_id} 进入")
    logger.info("[任务 %s] run_until_gate 进入", mission_id)
    mission = _get_mission_or_error(db, mission_id)
    logger.info("[任务 %s] 当前状态：%s", mission_id, mission.status)
    zlog(f"[run_until_gate] 任务 {mission_id} 当前状态: {mission.status}")
    if mission.status == "awaiting_goal_confirmation":
        raise MissionStateError("请先确认采购目标")
    if mission.status == "awaiting_team_confirmation":
        raise MissionStateError("请先确认协作团队")
    if mission.status == "completed":
        raise MissionStateError("任务已完成")
    if mission.status == "failed":
        raise MissionStateError("任务已结束，无法继续运行")

    snapshot = repository.get_mission_snapshot(db, mission_id)
    logger.info("[任务 %s] 快照中 team=%d 人, agent_runs=%d 条", mission_id,
                len(snapshot.get("team", [])), len(snapshot.get("agent_runs", [])))
    if mission.status in ("awaiting_decision", "partially_completed"):
        # 已在人工闸门：只回放当前状态，不重复运行小二
        zlog(f"[run_until_gate] 任务 {mission_id} 已在闸门 {mission.status}，回放状态")
        logger.info("[任务 %s] 已在闸门 %s，回放状态", mission_id, mission.status)
        _emit(emit, "decision_required", mission_id, {"recommendation": snapshot.get("recommendation")})
        return snapshot

    logger.info("[任务 %s] 准备获取运行锁，当前运行中任务：%s", mission_id, _RUNNING_MISSIONS)
    with _RUN_LOCK:
        if mission_id in _RUNNING_MISSIONS:
            zlog(f"[run_until_gate] 任务 {mission_id} 已有运行实例，仅回放快照")
            logger.info("[任务 %s] 已有运行实例，仅回放当前快照", mission_id)
            _emit(emit, "snapshot", mission_id, {"snapshot": snapshot})
            return snapshot
        _RUNNING_MISSIONS.add(mission_id)
        zlog(f"[run_until_gate] 任务 {mission_id} 已获取运行锁，准备执行")
        logger.info("[任务 %s] 已获取运行锁", mission_id)

    try:
        return _execute_until_gate(db, mission, mission_id, emit, snapshot)
    finally:
        with _RUN_LOCK:
            _RUNNING_MISSIONS.discard(mission_id)
            logger.info("[任务 %s] 已释放运行锁", mission_id)


def _execute_until_gate(db: Session, mission, mission_id: int, emit: Callable[[dict], None], snapshot: dict) -> dict:
    logger.info("[任务 %s] _execute_until_gate 开始，准备 commit 请求会话", mission_id)
    # 先结束请求会话的读事务，避免悬挂事务与图内并发写入互相干扰
    try:
        db.commit()
        db.expire_all()
        logger.info("[任务 %s] 请求会话 commit 完成", mission_id)
    except Exception as exc:
        logger.error("[任务 %s] 请求会话 commit 失败：%s", mission_id, exc, exc_info=True)
        raise
    _emit(emit, "mission_started", mission_id, {"title": mission.title})
    zlog(f"[execute] 任务 {mission_id} 开始调用 run_professional_graph")
    logger.info("[任务 %s] 开始调用 run_professional_graph", mission_id)
    final_state = run_professional_graph(_session_factory(db), snapshot, emit)
    zlog(f"[execute] 任务 {mission_id} graph 完成，keys={list(final_state.keys())}")
    logger.info("[任务 %s] run_professional_graph 完成，结果 keys=%s", mission_id, list(final_state.keys()))

    recommendation = final_state.get("recommendation") or {}
    conflicts = final_state.get("conflicts") or []
    if recommendation.get("primary_scheme_id"):
        zlog(f"[execute] 任务 {mission_id} 到达决策闸门，主推方案: {recommendation.get('primary_scheme_id')}")
        _transition(db, mission, "awaiting_decision")
        repository.set_mission_state(
            db, mission,
            phase="decision",
            status="awaiting_decision",
            conflicts=conflicts,
            recommendation=recommendation,
        )
        runs = {run["agent_id"]: run for run in repository.get_mission_snapshot(db, mission_id)["agent_runs"]}
        failed_agents = [agent_id for agent_id, run in runs.items() if run["status"] == "failed"]
        prompt = recommendation.get("summary", "请选择采购方案")
        if failed_agents:
            names = "、".join(AGENT_NAMES.get(agent_id, agent_id) for agent_id in failed_agents)
            prompt += f"（{names}结果缺失，方案已标注不完整）"
        repository.create_decision(
            db, mission_id, "plan", prompt, PLAN_DECISION_OPTIONS,
            recommendation.get("summary", ""),
        )
        logger.info("[任务 %s] 办理到达决策闸门：主推方案 %s，等待用户确认", mission_id, recommendation.get("primary_scheme_id"))
        _emit(emit, "decision_required", mission_id, {"recommendation": recommendation})
    else:
        zlog(f"[execute] 任务 {mission_id} 办理结束：无法形成可用方案")
        _transition(db, mission, "failed")
        repository.set_mission_state(
            db, mission, phase="parallel_execution", status="failed", conflicts=conflicts, recommendation=None,
        )
        _emit(emit, "mission_failed", mission_id, {"reason": "无法形成可用方案"})
        logger.warning("[任务 %s] 办理结束：无法形成可用方案", mission_id)
    db.expire_all()
    return repository.get_mission_snapshot(db, mission_id)


def _build_verify_a_tasks(recommendation: dict) -> list[dict]:
    """先核验 A：核验任务待办理，其余动作等待前置核验。"""
    drafts = recommendation.get("next_actions", [])
    actions = []
    for draft in drafts:
        status = "ready" if draft["action_code"] == "ACT-VERIFY-A" else "waiting_prerequisite"
        actions.append({
            "action_code": draft["action_code"],
            "agent_id": draft["agent_id"],
            "title": draft["title"],
            "payload": draft.get("payload", {}),
            "scheme_id": draft.get("scheme_id"),
            "status": status,
        })
    return actions


def _build_choose_b_tasks(recommendation: dict) -> list[dict]:
    """直接选择 B：为备选供应方创建询价和运输任务，不创建 A 的执行动作。"""
    drafts = recommendation.get("next_actions", [])
    backup = recommendation.get("backup_scheme_id")
    backup_draft = next(
        (d for d in drafts if d.get("scheme_id") == backup and d["agent_id"] == "liang"),
        None,
    )
    payload = (backup_draft or {}).get("payload", {})
    supplier_name = payload.get("supplier_name") or f"方案{backup}供应方"
    return [
        {
            "action_code": "ACT-INQUIRY-B",
            "agent_id": "liang",
            "title": f"向{supplier_name}询价并锁定库存",
            "payload": payload,
            "scheme_id": backup,
            "status": "ready",
        },
        {
            "action_code": "ACT-TRANSPORT-B",
            "agent_id": "yun",
            "title": "确认备选方案两批运输安排",
            "payload": {"scheme_id": backup},
            "scheme_id": backup,
            "status": "ready",
        },
    ]


def build_mission_experience(snapshot: dict) -> str | None:
    """仅在用户做出最终选择后，提炼稳定、已确认的决策经验。"""
    recommendation = snapshot.get("recommendation") or {}
    if not recommendation.get("primary_scheme_id"):
        return None
    plan_decision = next(
        (d for d in snapshot.get("decisions", []) if d.get("gate_type") == "plan" and d.get("status") == "confirmed"),
        None,
    )
    if plan_decision is None:
        return None
    variety = (snapshot.get("goal") or {}).get("variety_name") or "粮食"
    if recommendation.get("condition"):
        return (
            f"该企业{variety}补库优先保供，再比较综合成本；"
            "当低成本供应方履约证据不足时，应先核验履约担保，未通过则切换稳定备选。"
        )
    return f"该企业{variety}补库优先保供，再比较综合成本；已确认执行方案 {recommendation['primary_scheme_id']}。"


def _sink_experience(db: Session, mission_id: int) -> None:
    """沉淀企业经验并同步记忆；失败不影响任务完成。"""
    try:
        snapshot = repository.get_mission_snapshot(db, mission_id) or {}
        content = build_mission_experience(snapshot)
        if not content:
            return
        goal = snapshot.get("goal") or {}
        tags = ["粮掌柜", goal.get("variety_name") or "粮食"]
        exp = knowledge_repo.create_experience(
            db,
            source_record_id=mission_id,
            content=content,
            tags=[t for t in tags if t],
            source_type="zhanggui",
        )
        if exp:
            row = knowledge_repo.get_experience(db, exp["id"])
            if row is not None:
                knowledge_memory.sync_experience(row)
            logger.info("[任务 %s] 企业经验已沉淀：%s", mission_id, content)
    except Exception:
        logger.exception("企业经验沉淀失败，不影响任务完成")


def submit_decision(db: Session, mission_id: int, decision_id: int, action: str, note: str) -> dict:
    """方案与执行闸门：用户选择后生成行动任务并完成任务。"""
    mission = _get_mission_or_error(db, mission_id)
    if mission.status not in ("awaiting_decision", "partially_completed"):
        raise MissionStateError("当前没有待确认的方案决策")
    decision = repository.get_decision(db, decision_id)
    if decision is None or decision.mission_id != mission_id:
        raise MissionStateError("决策记录不存在")
    if decision.status != "pending":
        raise MissionStateError("该决策已经确认，请勿重复提交")
    valid_actions = {option.get("action") for option in decision.options or []}
    if action not in valid_actions:
        raise MissionStateError(f"未知决策动作：{action}")

    recommendation = mission.recommendation_snapshot or {}
    if action == "verify_a":
        actions = _build_verify_a_tasks(recommendation)
    elif action == "choose_b":
        actions = _build_choose_b_tasks(recommendation)
    else:
        raise MissionStateError(f"未知决策动作：{action}")

    repository.confirm_decision(db, decision, action, note)
    tasks = repository.create_action_tasks(db, mission_id, actions)
    verify_task = next((t for t in tasks if t.action_code == "ACT-VERIFY-A"), None)
    if verify_task is not None:
        for task in tasks:
            if task.status == "waiting_prerequisite":
                task.prerequisite_action_id = verify_task.id
        db.commit()

    _transition(db, mission, "completed")
    repository.set_mission_state(db, mission, phase="execution", status="completed")
    logger.info("[任务 %s] 用户决策：%s，生成 %d 项行动任务，任务完成", mission_id, action, len(actions))
    _sink_experience(db, mission_id)
    return repository.get_mission_snapshot(db, mission_id)
