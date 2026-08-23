"""预置 2 条示例关注：1 条已触发 + 1 条监测中（幂等）。"""

from sqlalchemy.orm import Session

from app.market.repository import get_spot
from app.workflow import repository
from app.workflow.models import WatchCondition


def seed_demo_watches(db: Session) -> None:
    """已存在任意关注则跳过，避免覆盖用户数据。"""
    if db.query(WatchCondition).count() > 0:
        return
    suihua = get_spot(db, "corn", "ZHAN-V1-CORN-01")
    dalian = get_spot(db, "corn", "ZHAN-V1-CORN-04")
    if suihua is None or dalian is None:
        return
    watches = [
        # 已触发：价格低于（当前价 + 40），当前价必然 ≤ 阈值
        WatchCondition(
            watch_code="WATCH-CORN-01",
            variety_code=suihua.variety_code,
            variety_name=suihua.variety_name,
            spot_code=suihua.spot_code,
            region_name=suihua.region_name,
            quote_type=suihua.quote_type,
            watch_type="price_below",
            threshold=suihua.price + 40,
            status="monitoring",
            data_kind="user_input",
            mock_dataset_version="zhan-v1",
        ),
        # 监测中：价格高于（当前价 + 80），当前价必然 < 阈值
        WatchCondition(
            watch_code="WATCH-CORN-02",
            variety_code=dalian.variety_code,
            variety_name=dalian.variety_name,
            spot_code=dalian.spot_code,
            region_name=dalian.region_name,
            quote_type=dalian.quote_type,
            watch_type="price_above",
            threshold=dalian.price + 80,
            status="monitoring",
            data_kind="user_input",
            mock_dataset_version="zhan-v1",
        ),
    ]
    for w in watches:
        db.add(w)
    db.commit()
    for w in watches:
        repository.refresh_watch(db, w)
    db.commit()
