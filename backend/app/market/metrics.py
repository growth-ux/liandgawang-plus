"""品种行情摘要指标：基于升序价格序列的确定性纯函数。"""

from decimal import Decimal


def pct_change(current: Decimal, base: Decimal) -> Decimal:
    """(current - base) / base * 100，保留 1 位小数。"""
    return round((current - base) / base * 100, 1)


def classify_direction(month_change: Decimal) -> str:
    if month_change >= Decimal("1.5"):
        return "偏强"
    if month_change <= Decimal("-1.5"):
        return "偏弱"
    return "震荡"


def build_summary(prices: list[Decimal]) -> dict:
    """基于升序价格序列（至少 31 点）计算摘要。"""
    latest = prices[-1]
    day = pct_change(latest, prices[-2])
    week = pct_change(latest, prices[-8])
    month = pct_change(latest, prices[-31])
    window = prices[-30:]
    return {
        "latest_price": str(latest),
        "day_change_pct": str(day),
        "week_change_pct": str(week),
        "month_change_pct": str(month),
        "range_high": str(max(window)),
        "range_low": str(min(window)),
        "direction": classify_direction(month),
    }
