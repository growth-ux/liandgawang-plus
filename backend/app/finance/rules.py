from decimal import Decimal, ROUND_HALF_UP

from app.finance.schemas import FinanceProductOut, FinanceRequirement, MatchCandidate, MatchPreview


def calculate_reference_cost(amount_yuan: Decimal, annual_rate_pct: Decimal,
                             duration_days: int) -> Decimal:
    """参考资金成本 = 金额 × 年化利率 / 100 × 天数 / 365，保留两位小数"""
    value = amount_yuan * annual_rate_pct / Decimal("100") * Decimal(duration_days) / Decimal("365")
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _evaluate(requirement: FinanceRequirement, product) -> tuple[list[str], list[str], list[str]]:
    """评估产品与需求的匹配、待确认和拒绝理由"""
    matched, pending, rejected = [], [], []

    # 额度
    if not (product.min_amount_yuan <= requirement.amount_yuan <= product.max_amount_yuan):
        rejected.append(
            f"需求金额不在{product.min_amount_yuan:.0f}至{product.max_amount_yuan:.0f}元额度范围"
        )
    else:
        matched.append("额度覆盖本次资金需求")

    # 期限
    if not (product.min_days <= requirement.duration_days <= product.max_days):
        rejected.append(f"使用期限不在{product.min_days}至{product.max_days}天范围")
    else:
        matched.append("产品期限覆盖本次使用周期")

    # 用途
    if requirement.purpose not in product.purposes:
        rejected.append("产品资金用途与本次需求不一致")
    else:
        matched.append("资金用途一致")

    # 增信方式
    if requirement.guarantee_modes is None:
        pending.append("需确认可提供或接受的增信方式")
    elif not set(requirement.guarantee_modes) & set(product.guarantee_modes):
        rejected.append("可提供的增信方式不满足产品要求")
    else:
        matched.append("增信方式可匹配")

    # 必要凭证
    if requirement.credentials is None:
        if product.required_credentials:
            pending.append("需确认必要业务凭证是否齐全")
    else:
        missing = set(product.required_credentials) - set(requirement.credentials)
        if missing:
            rejected.append("缺少必要凭证：" + "、".join(sorted(missing)))
        else:
            matched.append("必要业务凭证已具备")

    # 经营年限
    if product.min_business_years is not None:
        years = Decimal(str(product.min_business_years))
        if requirement.business_years is None:
            pending.append(f"需确认企业持续经营是否满{years:g}年")
        elif requirement.business_years < years:
            rejected.append(f"企业经营年限不足{years:g}年")
        else:
            matched.append("企业经营年限满足基础条件")

    return matched, pending, rejected


def match_products(requirement: FinanceRequirement, products: list) -> MatchPreview:
    """对产品列表执行硬筛选和稳定排序，返回主推、备选和排除结果"""
    feasible: list[MatchCandidate] = []
    rejected_items: list[MatchCandidate] = []

    for row in products:
        product_out = FinanceProductOut.model_validate(row)
        matched, pending, rejected = _evaluate(requirement, row)
        cost = (
            calculate_reference_cost(requirement.amount_yuan, row.annual_rate_pct, requirement.duration_days)
            if row.annual_rate_pct is not None
            else None
        )
        candidate = MatchCandidate(
            product=product_out,
            estimated_cost_yuan=cost,
            matched_reasons=matched,
            pending_conditions=pending,
            rejection_reasons=rejected,
        )
        (rejected_items if rejected else feasible).append(candidate)

    infinity = Decimal("999999999999")
    feasible.sort(key=lambda item: (
        len(item.pending_conditions),
        item.estimated_cost_yuan if item.estimated_cost_yuan is not None else infinity,
        abs(item.product.max_days - requirement.duration_days),
        item.product.product_code,
    ))
    rejected_items.sort(key=lambda item: (len(item.rejection_reasons), item.product.product_code))

    return MatchPreview(
        requirement=requirement,
        primary=feasible[0] if feasible else None,
        backups=feasible[1:3],
        rejected=rejected_items,
    )
