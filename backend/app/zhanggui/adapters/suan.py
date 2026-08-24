"""算小二适配器：把粮源与运输结果组合成两套方案比较综合成本。"""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.costing.rules import compare_schemes
from app.costing.schemas import FieldMeta, SchemeInput
from app.zhanggui import demo_data
from app.zhanggui.adapters import liang as liang_adapter
from app.zhanggui.adapters.base import AgentContext
from app.zhanggui.schemas import AgentResult

# 粮小二候选与采购方案的映射：低成本出厂价候选为 A，港口稳定候选为 B
_SCHEME_BY_SUPPLIER = {"SUP-A": "A", "SUP-B": "B"}


def run(db: Session, context: AgentContext) -> AgentResult:
    goal = context.goal
    liang_result = context.prior_results.get("liang")
    yun_result = context.prior_results.get("yun")
    qian_result = context.prior_results.get("qian")
    if liang_result is None or liang_result.status == "failed":
        raise RuntimeError("缺少粮小二结果，无法组合采购方案")
    if yun_result is None or yun_result.status == "failed":
        raise RuntimeError("缺少运小二结果，无法组合采购方案")

    candidates = liang_adapter.candidate_briefs(liang_result)
    quantity = Decimal(goal.quantity_tons or "0")
    freight = Decimal(yun_result.facts.get("freight_weighted_yuan_per_ton", "0"))
    financing_cost = Decimal(str(qian_result.facts.get("estimated_cost_yuan", "0"))) if qian_result else Decimal("0")

    schemes: list[SchemeInput] = []
    for candidate in candidates:
        scheme_id = _SCHEME_BY_SUPPLIER.get(candidate.get("supplier_code") or "", None)
        if scheme_id is None:
            continue
        schemes.append(SchemeInput(
            scheme_id=scheme_id,
            name=f"{candidate['supplier_name']}（{candidate['listing_code']}）",
            variety_name=goal.variety_name,
            quantity_tons=quantity,
            purchase_price_yuan_per_ton=Decimal(candidate["price"]),
            tax_included=True,
            quality_discount_yuan_per_ton=Decimal(candidate.get("quality_penalty") or "0"),
            freight_yuan_per_ton=freight,
            loading_yuan_per_ton=Decimal(demo_data.DEMO_LOADING_YUAN_PER_TON),
            loss_rate_pct=Decimal(demo_data.DEMO_LOSS_RATE_PCT),
            financing_cost_yuan=financing_cost,
            other_cost_yuan=Decimal("0"),
            constraints_met=True,
            field_meta={
                "purchase_price_yuan_per_ton": FieldMeta(source="liang", note=f"{candidate['supplier_name']}报价"),
                "freight_yuan_per_ton": FieldMeta(source="yun", note="两批加权参考运费"),
                "financing_cost_yuan": FieldMeta(source="qian" if qian_result else "user", note="资金成本"),
            },
        ))
    if len(schemes) < 1:
        raise RuntimeError("候选粮源不足以形成采购方案")

    comparison = compare_schemes(schemes)
    if comparison.recommended_scheme_id is None:
        raise RuntimeError("所有方案均不满足硬性条件")

    results = {r.scheme_id: r for r in comparison.results}
    best_id = comparison.recommended_scheme_id
    best = results[best_id]
    others = [r for r in comparison.results if r.scheme_id != best_id]
    saving = comparison.differences[0] if comparison.differences else None

    facts = {
        "recommended_scheme_id": best_id,
        "backup_scheme_id": others[0].scheme_id if others else None,
        "delivered_cost_yuan_per_ton": {sid: str(r.delivered_cost_yuan_per_ton) for sid, r in results.items()},
        "total_cost_yuan": {sid: str(r.total_cost_yuan) for sid, r in results.items()},
        "saving_total_yuan": str(saving.total_cost_delta_yuan) if saving else "0.00",
        "delta_yuan_per_ton": str(saving.delivered_cost_delta_yuan_per_ton) if saving else "0.00",
        "schemes": [
            {
                "scheme_id": r.scheme_id,
                "name": r.name,
                "delivered_cost_yuan_per_ton": str(r.delivered_cost_yuan_per_ton),
                "total_cost_yuan": str(r.total_cost_yuan),
                "breakdown": r.breakdown.model_dump(mode="json"),
            }
            for r in comparison.results
        ],
        "contains_estimates": comparison.contains_estimates,
    }

    detail = "、".join(
        f"方案{r.scheme_id}到厂吨成本 {r.delivered_cost_yuan_per_ton} 元" for r in comparison.results
    )
    summary = f"推荐成本更低的方案 {best_id}（{detail}），方案间总计相差 {facts['saving_total_yuan']} 元。"

    return AgentResult(
        agent_id="suan",
        status="completed",
        summary=summary,
        facts=facts,
        recommendations=[f"按方案 {best_id} 锁定采购与运输组合", "签约前确认报价含税口径与有效期"],
        risks=[],
        missing_information=[],
        evidence=[
            {
                "item": f"方案{r.scheme_id}：采购 {r.breakdown.purchase_yuan_per_ton} + 运费 {r.breakdown.freight_yuan_per_ton} + 装卸 {r.breakdown.loading_yuan_per_ton} 元/吨，损耗 {demo_data.DEMO_LOSS_RATE_PCT}%",
                "source": "业务测算结果",
            }
            for r in comparison.results
        ],
        impact_on_mission="综合吨成本是主推与备选方案的核心排序依据",
    )
