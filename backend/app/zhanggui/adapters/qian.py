"""钱小二适配器：仅在存在资金缺口时匹配资金产品。"""

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.finance import repository as finance_repo
from app.finance.rules import calculate_reference_cost, match_products
from app.finance.schemas import FinanceProductOut, FinanceRequirement
from app.zhanggui import demo_data
from app.zhanggui.adapters.base import AgentContext
from app.zhanggui.schemas import AgentResult


def run(db: Session, context: AgentContext) -> AgentResult:
    goal = context.goal
    gap = goal.financing_gap_yuan
    if gap in (None, "", "0"):
        return AgentResult(
            agent_id="qian",
            status="completed",
            summary="当前未发现资金缺口或账期需求，钱小二保持待命",
            facts={},
            evidence=[],
            impact_on_mission="本次方案不计入资金成本",
        )

    deadline_days = 45
    if goal.deadline_date:
        deadline_days = max((date.fromisoformat(goal.deadline_date) - demo_data.DEMO_TODAY).days + 30, 15)
    requirement = FinanceRequirement(
        purpose="grain_purchase",
        amount_yuan=Decimal(gap),
        duration_days=deadline_days,
        business_years=Decimal("3"),
        guarantee_modes=["credit", "guarantee"],
        credentials=["purchase_contract"],
        source_type="liang",
        source_ref=f"mission-{context.mission_id}",
    )

    products = finance_repo.list_products(db)
    source = "平台资金产品"
    if not products:
        products = [FinanceProductOut.model_validate(demo_data.DEMO_FINANCE_PRODUCT)]
        source = "业务测算结果"
    preview = match_products(requirement, products)
    if preview.primary is None:
        return AgentResult(
            agent_id="qian",
            status="completed",
            summary=f"约 {gap} 元资金缺口暂未匹配到合适产品，建议扩大产品范围或调整期限",
            facts={"amount_yuan": gap, "duration_days": deadline_days},
            recommendations=["调整融资期限或增信方式后重新匹配"],
            missing_information=["可接受的增信方式"],
            evidence=[],
            impact_on_mission="资金成本暂按 0 计入综合方案",
        )

    product = preview.primary.product
    cost = preview.primary.estimated_cost_yuan
    if cost is None and product.annual_rate_pct is not None:
        cost = calculate_reference_cost(requirement.amount_yuan, product.annual_rate_pct, requirement.duration_days)
    facts = {
        "amount_yuan": gap,
        "duration_days": deadline_days,
        "product_code": product.product_code,
        "product_name": product.name,
        "institution_name": product.institution_name,
        "annual_rate_pct": str(product.annual_rate_pct) if product.annual_rate_pct is not None else None,
        "estimated_cost_yuan": str(cost) if cost is not None else "0",
        "matched_reasons": preview.primary.matched_reasons,
        "pending_conditions": preview.primary.pending_conditions,
    }
    return AgentResult(
        agent_id="qian",
        status="completed",
        summary=f"为约 {gap} 元资金缺口主推 {product.name}（{product.institution_name}），参考资金成本 {facts['estimated_cost_yuan']} 元。",
        facts=facts,
        recommendations=["融资审批周期需与采购窗口核对", "放款前需完成采购合同等凭证核验"],
        risks=[],
        missing_information=[],
        evidence=[{"item": f"{product.name} 年化 {facts['annual_rate_pct']}%，期限 {product.min_days}~{product.max_days} 天", "source": source}],
        impact_on_mission="参考资金成本将计入两套方案的综合成本",
    )
