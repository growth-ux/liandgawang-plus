"""采购研判确定性规则：由行情数据生成可解释的行动建议骨架，不依赖模型。"""

from datetime import date
from decimal import Decimal

from app.market.metrics import build_summary
from app.market.mock_seed import PRICE_DATE

ACTION_LABELS = {
    "buy_now": "立即采购",
    "split": "分批采购",
    "wait": "暂缓观望",
    "verify": "先核验条件",
}

# 数据缺失仅在证据不足（如无行情数据）时如实记录，常规研判不输出缺失项


# 常用区域说法到库点省份的映射，支持“东北”这类目标地区表述
REGION_ALIASES = {
    "东北": ["黑龙江", "吉林", "辽宁", "内蒙"],
    "华北": ["河北", "山东", "河南", "山西"],
    "华东": ["江苏", "安徽", "江西"],
    "南方": ["广东", "广西", "云南", "四川"],
    "港口": ["港"],
}


def pick_baseline_spot(spots: list, target_region: str | None):
    """确定性选取基准库点：目标区域（含别名） > 港口 > 首个产区 > 首个库点。"""
    keywords = [target_region or ""] + REGION_ALIASES.get(target_region or "", [])
    for kw in keywords:
        if not kw:
            continue
        for s in spots:
            if kw in s.region_name:
                return s
    for s in spots:
        if s.region_type == "港口":
            return s
    for s in spots:
        if s.region_type == "产区":
            return s
    return spots[0] if spots else None


def _fmt_chg(v: Decimal) -> str:
    return f"{float(v) + 0.0:+.1f}%"


def build_procurement_judgment(
    *,
    variety_name: str,
    quantity_tons: Decimal,
    deadline_date: date,
    spots: list,
    series_prices: list[Decimal],
    events: list,
    baseline_spot,
    budget_price: Decimal | None = None,
    stock_days: int | None = None,
    risk_preference: str | None = None,
) -> dict:
    """生成结构化研判骨架，返回结构与 ProcurementJudgment 对齐。"""
    days_left = (deadline_date - PRICE_DATE).days
    qty = quantity_tons.quantize(Decimal("1")) if quantity_tons == quantity_tons.to_integral_value() else quantity_tons

    missing: list[str] = []
    supporting: list[str] = []
    opposing: list[str] = []
    invalidation: list[str] = []
    watch: list[str] = []

    # ── 证据不足：不输出强行动建议 ──
    if not spots or len(series_prices) < 31 or baseline_spot is None:
        if not spots:
            missing.append("该品种库点现货价缺失")
        if len(series_prices) < 31:
            missing.append("基准库点近 30 天价格序列不足")
        return {
            "action": "verify",
            "action_label": ACTION_LABELS["verify"],
            "ratio_low": None,
            "ratio_high": None,
            "time_window": None,
            "summary": f"{variety_name}演示行情证据不足，暂不给出采购节奏建议，请先核验采购条件",
            "supporting": supporting,
            "opposing": opposing,
            "invalidation": invalidation,
            "watch_metrics": watch,
            "missing_data": missing,
            "evidence_completeness": "low",
        }

    summary = build_summary(series_prices)
    direction = summary["direction"]  # 偏强 / 偏弱 / 震荡
    latest = Decimal(summary["latest_price"])
    base_desc = f"{baseline_spot.region_name}{baseline_spot.quote_type}"

    # ── 市场证据 ──
    supporting.append(f"{base_desc}最新价 {latest} 元/吨，近 30 天{_fmt_chg(Decimal(summary['month_change_pct']))}，走势{direction}")
    supporting.append(f"近一周 {_fmt_chg(Decimal(summary['week_change_pct']))}、近一日 {_fmt_chg(Decimal(summary['day_change_pct']))}")
    bullish = [e for e in events if e.direction == "bullish"]
    bearish = [e for e in events if e.direction == "bearish"]
    for e in bullish:
        supporting.append(f"事件：{e.title}")
    for e in bearish:
        opposing.append(f"事件：{e.title}")

    # ── 预算约束 ──
    if budget_price is not None and latest > budget_price:
        opposing.append(
            f"当前最新价 {latest} 元/吨，已高于目标预算 {budget_price} 元/吨"
        )
        invalidation.append("若价格回落至预算内，可按原节奏执行")

    # ── 库存缓冲 ──
    if stock_days is not None:
        if stock_days >= max(days_left, 0):
            supporting.append(f"现有库存可用 {stock_days} 天，可覆盖至最晚采购时间，节奏可更从容")
        else:
            supporting.append(f"现有库存仅可用 {stock_days} 天，{stock_days} 天后必须开始补库")

    # ── 决策规则 ──
    ratio_low: int | None
    ratio_high: int | None

    if days_left <= 3:
        # 时间窗极短：不赌方向，立即完成采购
        action = "buy_now"
        ratio_low, ratio_high = 100, 100
        time_window = f"最晚时间仅剩 {max(days_left, 0)} 天，建议 3 天内完成采购"
        text = f"{days_left} 天内需采购 {qty} 吨{variety_name}，时间窗口极短，建议立即完成采购"
        invalidation.append("若供应商报价明显高于近期均价，可改为分批小量先行")
    elif direction == "偏强":
        action = "split"
        ratio_low, ratio_high = 40, 60
        time_window = "建议 3~5 天内锁定第一批，其余在最晚采购时间前 3 天择机完成"
        text = f"{variety_name}近期走势偏强，且 {days_left} 天内需采购 {qty} 吨，建议分批采购、先锁定 {ratio_low}%~{ratio_high}%"
        invalidation.append("若产区到货量明显恢复、价格涨势停滞，可放缓第二批节奏")
        invalidation.append("若出现政策性抛售或进口放量等利空，偏强逻辑失效")
    elif direction == "偏弱":
        if stock_days is not None and stock_days >= 7:
            action = "wait"
            ratio_low, ratio_high = None, None
            time_window = f"库存可支撑 {stock_days} 天，建议观望至最晚采购时间前一周再启动"
            text = f"{variety_name}近期走势偏弱且库存可支撑，建议暂缓采购、等待更优价格"
        else:
            action = "split"
            ratio_low, ratio_high = 20, 40
            time_window = "先小批量锁定刚需，剩余部分观察价格走势后再补"
            text = f"{variety_name}近期走势偏弱，建议先小批量采购 {ratio_low}%~{ratio_high}%，其余等待价格企稳"
        invalidation.append("若价格止跌企稳并放量回升，应提前启动剩余采购")
    else:
        action = "split"
        ratio_low, ratio_high = 30, 50
        time_window = "一周内锁定第一批，其余观察方向明确后再补"
        text = f"{variety_name}近期多空交织、方向不明，建议分批采购 {ratio_low}%~{ratio_high}% 先行，保留灵活度"
        invalidation.append("若方向明确转强，应提高首批比例；转弱则降低")

    # ── 风险偏好微调（不改变行动类型，只调比例） ──
    if action == "split" and ratio_low is not None and risk_preference:
        if risk_preference == "积极":
            ratio_low, ratio_high = min(ratio_low + 10, 70), min(ratio_high + 10, 80)
        elif risk_preference == "保守":
            ratio_low, ratio_high = max(ratio_low - 10, 10), max(ratio_high - 10, 20)

    # ── 继续观察指标 ──
    watch.extend([
        f"{variety_name}产区到货量与基层售粮进度",
        "港口库存与集港节奏",
        "政策性收储/投放动向",
    ])

    completeness = "medium" if len(spots) >= 5 and len(events) >= 1 else "low"

    return {
        "action": action,
        "action_label": ACTION_LABELS[action],
        "ratio_low": ratio_low,
        "ratio_high": ratio_high,
        "time_window": time_window,
        "summary": text,
        "supporting": supporting,
        "opposing": opposing,
        "invalidation": invalidation,
        "watch_metrics": watch,
        "missing_data": missing,
        "evidence_completeness": completeness,
    }
