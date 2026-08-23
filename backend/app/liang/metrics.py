"""市场概览与市场发现：基于固定数据集的确定性聚合，不做个性化推荐。"""
from collections import Counter

from app.liang.models import GrainListing


def build_summary(listings: list[GrainListing]) -> dict:
    """概览条：在架数、挂牌总量、主要品种、报价区间、覆盖产区。"""
    total_quantity = sum(l.available_quantity_tons for l in listings)
    varieties = list(dict.fromkeys(l.variety_name for l in listings))
    provinces = sorted({l.origin_province for l in listings})
    prices = [float(l.price) for l in listings]

    return {
        "total_listings": len(listings),
        "total_quantity_tons": total_quantity,
        "varieties": varieties,
        "price_range": {"low": f"{min(prices):.0f}", "high": f"{max(prices):.0f}"},
        "province_count": len(provinces),
    }


def build_discoveries(listings: list[GrainListing]) -> list[dict]:
    """市场发现：确定性摘要，每条带可点击联动筛选的 filter。"""
    discoveries: list[dict] = []

    # 品种供应排行
    variety_counter = Counter(l.variety_name for l in listings)
    top_variety = variety_counter.most_common(1)[0][0]
    discoveries.append(
        {
            "id": "top-variety",
            "title": f"{top_variety}供应最多",
            "detail": f"在架 {variety_counter[top_variety]} 笔{top_variety}，占全部粮源的多数。",
            "filter": {"key": "variety_name", "value": top_variety},
        }
    )

    # 产区集中度
    province_counter = Counter(l.origin_province for l in listings)
    top_province = province_counter.most_common(1)[0][0]
    discoveries.append(
        {
            "id": "top-province",
            "title": f"{top_province}产区最集中",
            "detail": f"{top_province}在架 {province_counter[top_province]} 笔，是当前粮源最集中的产区。",
            "filter": {"key": "origin_province", "value": top_province},
        }
    )

    # 字段缺失
    missing = [
        l for l in listings
        if l.earliest_ship_at is None
        or l.latest_ship_at is None
        or l.test_weight_g_l is None
    ]
    if missing:
        discoveries.append(
            {
                "id": "missing-field",
                "title": f"{len(missing)} 笔缺关键信息",
                "detail": "部分粮源缺少发运窗口或质检指标，下单前需重点核验。",
                "filter": None,
            }
        )

    # 同口径价格区间（取供应最多的口径）
    price_counter = Counter(l.price_type for l in listings)
    top_type = price_counter.most_common(1)[0][0]
    same_type = [float(l.price) for l in listings if l.price_type == top_type]
    discoveries.append(
        {
            "id": "price-range",
            "title": f"{top_type}区间 {min(same_type):.0f}~{max(same_type):.0f} 元/吨",
            "detail": f"同为{top_type}时价格跨度 {max(same_type) - min(same_type):.0f} 元/吨，比较前先对齐口径。",
            "filter": {"key": "price_type", "value": top_type},
        }
    )

    return discoveries
