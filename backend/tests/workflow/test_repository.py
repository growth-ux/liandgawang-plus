from decimal import Decimal

from app.workflow.models import WatchCondition
from app.market.mock_seed import seed_zhan_mock_data
from app.workflow import repository


def test_watch_condition_persists(db_session):
    w = WatchCondition(
        watch_code="WATCH-TEST-01",
        variety_code="corn",
        variety_name="玉米",
        spot_code="ZHAN-V1-CORN-01",
        region_name="黑龙江·绥化",
        quote_type="收购价",
        watch_type="price_below",
        threshold=Decimal("2300"),
        status="monitoring",
        data_kind="user_input",
        mock_dataset_version="zhan-v1",
    )
    db_session.add(w)
    db_session.commit()
    assert w.id is not None
    assert w.watch_code == "WATCH-TEST-01"
    assert w.data_kind == "user_input"
    assert w.mock_dataset_version == "zhan-v1"


def test_refresh_watch_triggers_price_below(db_session):
    seed_zhan_mock_data(db_session)
    w = WatchCondition(
        watch_code="WATCH-TRIG",
        variety_code="corn",
        variety_name="玉米",
        spot_code="ZHAN-V1-CORN-01",
        region_name="黑龙江·绥化",
        quote_type="收购价",
        watch_type="price_below",
        threshold=Decimal("99999"),
        status="monitoring",
        data_kind="user_input",
        mock_dataset_version="zhan-v1",
    )
    db_session.add(w)
    db_session.commit()
    repository.refresh_watch(db_session, w)
    db_session.commit()
    assert w.status == "triggered"
    assert w.current_value is not None
    assert "已触发" in w.triggered_reason


def test_refresh_watch_data_pending_when_spot_missing(db_session):
    seed_zhan_mock_data(db_session)
    w = WatchCondition(
        watch_code="WATCH-MISSING",
        variety_code="corn",
        variety_name="玉米",
        spot_code="NO-SUCH-SPOT",
        region_name="未知",
        quote_type="收购价",
        watch_type="price_below",
        threshold=Decimal("2300"),
        status="monitoring",
        data_kind="user_input",
        mock_dataset_version="zhan-v1",
    )
    db_session.add(w)
    db_session.commit()
    repository.refresh_watch(db_session, w)
    db_session.commit()
    assert w.status == "data_pending"
    assert w.current_value is None


def test_refresh_watch_skips_paused(db_session):
    seed_zhan_mock_data(db_session)
    w = WatchCondition(
        watch_code="WATCH-PAUSED",
        variety_code="corn",
        variety_name="玉米",
        spot_code="ZHAN-V1-CORN-01",
        region_name="黑龙江·绥化",
        quote_type="收购价",
        watch_type="price_below",
        threshold=Decimal("2300"),
        status="paused",
        current_value=Decimal("2310"),
        triggered_reason="暂停前",
        data_kind="user_input",
        mock_dataset_version="zhan-v1",
    )
    db_session.add(w)
    db_session.commit()
    repository.refresh_watch(db_session, w)
    db_session.commit()
    assert w.status == "paused"
    assert w.triggered_reason == "暂停前"
