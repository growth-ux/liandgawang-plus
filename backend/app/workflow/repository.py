from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.market.metrics import pct_change
from app.market.repository import get_price_series, get_spot
from app.workflow.models import WatchCondition
from app.workflow.rules import build_trigger_reason, evaluate_watch_condition


def list_watches(db: Session) -> list[WatchCondition]:
    return db.scalars(select(WatchCondition).order_by(WatchCondition.id)).all()


def get_watch(db: Session, watch_id: int) -> WatchCondition | None:
    return db.get(WatchCondition, watch_id)


def _current_value(db: Session, watch: WatchCondition) -> Decimal | None:
    """读取关注对应库点的当前值（价格或涨跌%）。缺数据返回 None。"""
    if watch.watch_type in ("price_above", "price_below"):
        spot = get_spot(db, watch.variety_code, watch.spot_code)
        return spot.price if spot else None
    if watch.watch_type == "day_change":
        spot = get_spot(db, watch.variety_code, watch.spot_code)
        return spot.change_pct if spot else None
    # week_change：库点序列最近一天 vs 8 天前
    points = get_price_series(db, watch.spot_code)
    if len(points) < 8:
        return None
    return pct_change(points[-1].price, points[-8].price)


def refresh_watch(db: Session, watch: WatchCondition) -> None:
    """用当前演示行情重算关注状态（不 commit，由调用方提交）。暂停/关闭不重算。"""
    if watch.status in ("paused", "closed", "notified"):
        return
    value = _current_value(db, watch)
    if value is None:
        watch.status = "data_pending"
        watch.current_value = None
        watch.triggered_reason = "演示数据集中缺少该库点的价格或序列，暂无法判断"
    else:
        triggered = evaluate_watch_condition(watch.watch_type, watch.threshold, value)
        watch.status = "triggered" if triggered else "monitoring"
        watch.current_value = value
        watch.triggered_reason = build_trigger_reason(
            watch.watch_type, watch.threshold, value, triggered
        )
    watch.last_checked_at = datetime.now()
