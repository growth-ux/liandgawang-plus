"""粮小二适配器：对主演示候选执行寻源图筛选。"""

from datetime import date

from sqlalchemy.orm import Session

from app.liang.sourcing_graph import run_sourcing_graph
from app.zhanggui import demo_data
from app.zhanggui.adapters.base import AgentContext
from app.zhanggui.schemas import AgentResult

_CANDIDATE_KEYS = [
    "listing_code", "supplier_code", "supplier_name", "grade", "price", "price_type",
    "available_quantity_tons", "latest_ship_at", "origin", "delivered_price",
    "quality_penalty", "reasons", "risks",
]


def _raw_text(goal) -> str:
    parts = [f"采购{goal.quantity_tons or ''}吨{goal.grade or ''}{goal.variety_name}"]
    if goal.deadline_date:
        days = max((date.fromisoformat(goal.deadline_date) - demo_data.DEMO_TODAY).days, 1)
        parts.append(f"{days}天内可发")
    if goal.budget_yuan_per_ton:
        parts.append(f"预算{goal.budget_yuan_per_ton}")
    return "，".join(parts)


def _brief(candidate: dict | None) -> dict | None:
    if not candidate:
        return None
    brief = {key: candidate.get(key) for key in _CANDIDATE_KEYS}
    brief["scheme_id"] = candidate.get("scheme_id")
    return brief


def run(db: Session, context: AgentContext) -> AgentResult:
    goal = context.goal
    outcome = run_sourcing_graph(_raw_text(goal), [dict(item) for item in demo_data.DEMO_LISTINGS])
    plan = outcome["plan"]
    supplier_by_listing = {
        item["listing_code"]: item["supplier_code"] for item in demo_data.DEMO_LISTINGS
    }

    candidates = []
    if plan.get("primary"):
        candidates.append({**plan["primary"], "supplier_code": supplier_by_listing.get(plan["primary"]["listing_code"]), "scheme_id": "B"})
    if plan.get("backup"):
        candidates.append({**plan["backup"], "supplier_code": supplier_by_listing.get(plan["backup"]["listing_code"]), "scheme_id": "A"})

    summary_parts = []
    if plan.get("primary"):
        summary_parts.append(f"{plan['primary']['supplier_name']}（{plan['primary']['listing_code']}）交付条件更稳")
    if plan.get("backup"):
        summary_parts.append(f"{plan['backup']['supplier_name']}出厂报价更低")
    summary = f"共筛选 {outcome['listing_count']} 条粮源，保留 2 条候选：" + "；".join(summary_parts) + "。"
    if plan.get("eliminated"):
        eliminated = plan["eliminated"][0]
        summary += f"淘汰 {eliminated['listing_code']}：{eliminated['reason_text']}。"

    evidence = [
        {
            "item": f"{c['supplier_name']} {c['grade']}报价 {c['price']} 元/吨（{c['price_type']}），可用 {c['available_quantity_tons']} 吨",
            "source": "平台粮源信息",
        }
        for c in candidates
    ]

    return AgentResult(
        agent_id="liang",
        status="completed",
        summary=summary,
        facts={
            "origin": demo_data.DEMO_TRANSPORT_ORIGIN,
            "candidates": candidates,
            "eliminated": plan.get("eliminated", []),
            "verifications": plan.get("verifications", []),
        },
        recommendations=[f"优先核验 {c['supplier_name']} 的库存锁定与正式质检单" for c in candidates],
        risks=[],
        missing_information=[],
        evidence=evidence,
        impact_on_mission="候选粮源将组合运输形成两套完整采购方案",
    )


def candidate_briefs(result: AgentResult) -> list[dict]:
    """供算/安小二消费的精简候选（A 在前）。"""
    candidates = result.facts.get("candidates", []) if result else []
    return [_brief(c) for c in candidates if c]
