from decimal import Decimal, ROUND_HALF_UP

from app.costing.schemas import (
    CostBreakdown,
    CostComparison,
    CostDifference,
    ProfitRequest,
    ProfitScenario,
    SchemeInput,
    SchemeResult,
)

MONEY = Decimal("0.01")
QTY = Decimal("0.0001")
PCT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def qty(value: Decimal) -> Decimal:
    return value.quantize(QTY, rounding=ROUND_HALF_UP)


def pct(value: Decimal) -> Decimal:
    return value.quantize(PCT, rounding=ROUND_HALF_UP)


def calculate_scheme(scheme: SchemeInput) -> SchemeResult:
    quantity = scheme.quantity_tons
    usable = qty(quantity * (Decimal("1") - scheme.loss_rate_pct / Decimal("100")))
    purchase = scheme.purchase_price_yuan_per_ton * quantity
    quality = scheme.quality_discount_yuan_per_ton * quantity
    freight = scheme.freight_yuan_per_ton * quantity
    loading = scheme.loading_yuan_per_ton * quantity
    total = purchase + quality + freight + loading + scheme.financing_cost_yuan + scheme.other_cost_yuan
    delivered = total / usable
    zero_loss_ton = total / quantity
    return SchemeResult(
        scheme_id=scheme.scheme_id,
        name=scheme.name,
        eligible=scheme.constraints_met,
        total_cost_yuan=money(total),
        usable_quantity_tons=usable,
        delivered_cost_yuan_per_ton=money(delivered),
        purchase_total_yuan=money(purchase),
        breakdown=CostBreakdown(
            purchase_yuan_per_ton=money(scheme.purchase_price_yuan_per_ton),
            quality_yuan_per_ton=money(scheme.quality_discount_yuan_per_ton),
            freight_yuan_per_ton=money(scheme.freight_yuan_per_ton),
            loading_yuan_per_ton=money(scheme.loading_yuan_per_ton),
            loss_impact_yuan_per_ton=money(delivered - zero_loss_ton),
            financing_yuan_per_ton=money(scheme.financing_cost_yuan / usable),
            other_yuan_per_ton=money(scheme.other_cost_yuan / usable),
        ),
        pending_items=scheme.pending_items,
    )


def compare_schemes(schemes: list[SchemeInput]) -> CostComparison:
    if not schemes or len(schemes) > 3:
        raise ValueError("方案数量必须为 1 至 3 个")

    # 校验含税口径一致
    tax_values = {s.tax_included for s in schemes}
    if len(tax_values) > 1:
        raise ValueError("所有方案的含税口径必须一致")

    results = [calculate_scheme(s) for s in schemes]

    eligible = [r for r in results if r.eligible]
    if not eligible:
        return CostComparison(
            recommended_scheme_id=None,
            results=results,
            differences=[],
            contains_estimates=False,
            explanation="所有方案均不满足硬性条件，无法推荐。",
        )

    # 按到厂吨成本升序排序，取最低者为推荐
    best = min(eligible, key=lambda r: r.delivered_cost_yuan_per_ton)

    differences = []
    for r in results:
        if r.scheme_id != best.scheme_id:
            differences.append(
                CostDifference(
                    scheme_id=r.scheme_id,
                    against_scheme_id=best.scheme_id,
                    delivered_cost_delta_yuan_per_ton=money(
                        r.delivered_cost_yuan_per_ton - best.delivered_cost_yuan_per_ton
                    ),
                    total_cost_delta_yuan=money(r.total_cost_yuan - best.total_cost_yuan),
                )
            )

    contains_estimates = any(
        any(m.status == "estimated" for m in s.field_meta.values())
        for s in schemes
    )

    return CostComparison(
        recommended_scheme_id=best.scheme_id,
        results=results,
        differences=differences,
        contains_estimates=contains_estimates,
    )


def calculate_profit(scheme: SchemeInput, request: ProfitRequest) -> ProfitScenario:
    # 情景覆盖：若提供了运费或损耗率，生成临时方案重新计算
    effective = scheme
    if request.freight_yuan_per_ton is not None or request.loss_rate_pct is not None:
        updates = {}
        if request.freight_yuan_per_ton is not None:
            updates["freight_yuan_per_ton"] = request.freight_yuan_per_ton
        if request.loss_rate_pct is not None:
            updates["loss_rate_pct"] = request.loss_rate_pct
        effective = scheme.model_copy(update=updates)

    result = calculate_scheme(effective)
    usable = result.usable_quantity_tons
    total_cost = result.total_cost_yuan

    revenue = request.selling_price_yuan_per_ton * usable
    total_profit = money(revenue - total_cost - request.sales_fulfillment_cost_yuan)
    profit_per_ton = money(total_profit / usable)
    margin = pct(profit_per_ton / request.selling_price_yuan_per_ton * Decimal("100"))
    break_even = money((total_cost + request.sales_fulfillment_cost_yuan) / usable)
    safety = money(request.selling_price_yuan_per_ton - break_even)

    return ProfitScenario(
        selling_price_yuan_per_ton=request.selling_price_yuan_per_ton,
        total_profit_yuan=total_profit,
        profit_yuan_per_ton=profit_per_ton,
        margin_pct=margin,
        break_even_price_yuan_per_ton=break_even,
        safety_space_yuan_per_ton=safety,
    )
