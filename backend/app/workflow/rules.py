"""关注条件判定纯函数：只做确定性比较，不访问数据库、不调用 LangChain。"""

from decimal import Decimal

WATCH_TYPES = {"price_above", "price_below", "day_change", "week_change"}

WATCH_TYPE_LABELS = {
    "price_above": "价格高于",
    "price_below": "价格低于",
    "day_change": "日涨跌超过",
    "week_change": "周涨跌超过",
}


def evaluate_watch_condition(watch_type: str, threshold: Decimal, current_value: Decimal) -> bool:
    """确定性判定：是否触发。价格类型做有符号比较，涨跌类型按绝对值比较。"""
    if watch_type == "price_above":
        return current_value >= threshold
    if watch_type == "price_below":
        return current_value <= threshold
    if watch_type in ("day_change", "week_change"):
        return abs(current_value) >= threshold
    raise ValueError(f"未知关注类型：{watch_type}")


def _fmt_num(v: Decimal) -> str:
    """去掉末尾多余的 0：Decimal('2300.00') -> '2300'，Decimal('1.80') -> '1.8'。"""
    s = str(v)
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def format_threshold(watch_type: str, threshold: Decimal) -> str:
    """阈值展示文案。"""
    if watch_type in ("price_above", "price_below"):
        return f"{_fmt_num(threshold)} 元/吨"
    return f"{_fmt_num(threshold)}%"


def build_trigger_reason(
    watch_type: str, threshold: Decimal, current_value: Decimal, triggered: bool
) -> str:
    """触发/未触发说明文案。"""
    label = WATCH_TYPE_LABELS[watch_type]
    thr = format_threshold(watch_type, threshold)
    if watch_type in ("price_above", "price_below"):
        cur = f"{_fmt_num(current_value)} 元/吨"
    else:
        cur = f"{current_value:+.1f}%"
    state = "已触发" if triggered else "暂未触发"
    return f"{label}阈值 {thr}，当前 {cur}，{state}"
