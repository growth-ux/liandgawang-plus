"""瞻小二适配器：行情研判规则定结论，大模型负责自然语言解读。

行动建议、分批比例与时间窗仍由确定性规则计算（供冲突检测与综合建议消费），
LLM 只生成解读文案，未配置或失败时用规则版兜底。
"""

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.analysis.llm import interpret_judgment
from app.analysis.rules import build_procurement_judgment, pick_baseline_spot
from app.market import repository as market_repo
from app.zhanggui.adapters.base import AgentContext
from app.zhanggui.schemas import AgentResult

# 编排内 LLM 解读超时：瞻小二 worker 有 30 秒上限，不能沿用单页的 180 秒
_INTERPRET_TIMEOUT_SECONDS = 20


def _rule_interpretation(judgment: dict) -> str:
    """模型不可用时的兜底解读：把规则结论与关键证据拼成一段话。"""
    parts = [judgment["summary"]]
    if judgment.get("time_window"):
        parts.append(f"节奏上，{judgment['time_window']}")
    supporting = judgment.get("supporting") or []
    if supporting:
        parts.append("主要依据：" + "；".join(supporting[:2]))
    opposing = judgment.get("opposing") or []
    if opposing:
        parts.append("需要留意：" + "；".join(opposing[:2]))
    invalidation = judgment.get("invalidation") or []
    if invalidation:
        parts.append("出现以下情况时该建议失效：" + "；".join(invalidation[:1]))
    return "。".join(parts) + "。"


def run(db: Session, context: AgentContext) -> AgentResult:
    goal = context.goal
    spots = market_repo.list_spots(db, goal.variety_code)
    events = market_repo.list_events(db, goal.variety_code)
    baseline = pick_baseline_spot(spots, goal.destination)
    series_prices = (
        [p.price for p in market_repo.get_price_series(db, baseline.spot_code)]
        if baseline is not None
        else []
    )
    deadline = date.fromisoformat(goal.deadline_date) if goal.deadline_date else date.today()
    judgment = build_procurement_judgment(
        variety_name=goal.variety_name,
        quantity_tons=Decimal(goal.quantity_tons or "0"),
        deadline_date=deadline,
        spots=spots,
        series_prices=series_prices,
        events=events,
        baseline_spot=baseline,
        budget_price=Decimal(goal.budget_yuan_per_ton) if goal.budget_yuan_per_ton else None,
        stock_days=goal.stock_days,
    )

    evidence = [{"item": item, "source": "平台粮源信息"} for item in judgment["supporting"]]
    evidence += [{"item": item, "source": "平台粮源信息"} for item in judgment["opposing"]]
    for item in judgment["missing_data"]:
        evidence.append({"item": item, "source": "业务测算结果"})
    if not evidence:
        evidence.append({"item": judgment["summary"], "source": "业务测算结果"})

    # 解读层：规则定结论，模型只负责组织语言；失败自动回退规则版
    extra_parts = []
    if goal.destination:
        extra_parts.append(f"到货地{goal.destination}")
    if goal.budget_yuan_per_ton:
        extra_parts.append(f"预算{goal.budget_yuan_per_ton}元/吨")
    if goal.stock_days is not None:
        extra_parts.append(f"现有库存可用{goal.stock_days}天")
    conditions = {
        "variety_name": goal.variety_name,
        "quantity_tons": goal.quantity_tons or "0",
        "deadline_date": goal.deadline_date or "未明确",
        "extra": "，".join(extra_parts) or None,
    }
    interpretation = interpret_judgment(judgment, conditions, timeout_seconds=_INTERPRET_TIMEOUT_SECONDS)
    interpretation_source = "qwen" if interpretation else "rule"
    if not interpretation:
        interpretation = _rule_interpretation(judgment)

    missing = list(judgment["missing_data"])
    return AgentResult(
        agent_id="zhan",
        status="completed",
        summary=judgment["summary"],
        facts={
            "action": judgment["action"],
            "action_label": judgment["action_label"],
            "ratio_low": judgment["ratio_low"],
            "ratio_high": judgment["ratio_high"],
            "time_window": judgment["time_window"],
            "invalidation": judgment["invalidation"],
            "watch_metrics": judgment["watch_metrics"],
            "evidence_completeness": judgment["evidence_completeness"],
            "interpretation": interpretation,
            "interpretation_source": interpretation_source,
        },
        recommendations=[judgment["time_window"] or ""],
        risks=[],
        missing_information=missing,
        evidence=evidence,
        impact_on_mission="采购时机与分批比例将作为粮源和运输批次安排的参考",
    )
