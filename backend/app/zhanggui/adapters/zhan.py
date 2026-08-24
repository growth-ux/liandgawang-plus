"""瞻小二适配器：读取行情数据并调用采购研判规则。"""

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.analysis.rules import build_procurement_judgment, pick_baseline_spot
from app.market import repository as market_repo
from app.zhanggui.adapters.base import AgentContext
from app.zhanggui.schemas import AgentResult


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
        },
        recommendations=[judgment["time_window"] or ""],
        risks=[],
        missing_information=missing,
        evidence=evidence,
        impact_on_mission="采购时机与分批比例将作为粮源和运输批次安排的参考",
    )
