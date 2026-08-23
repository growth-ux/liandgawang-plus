from datetime import date
from decimal import Decimal

from app.market.mock_seed import MOCK_GENERATED_AT, SERIES_DAYS, seed_zhan_mock_data
from app.market.models import MarketPriceSeries, MarketSpotPrice


def test_price_series_model_saves_mock_metadata(db_session):
    row = MarketPriceSeries(
        series_code="ZHAN-V1-SERIES-CORN-01-20260525",
        spot_code="ZHAN-V1-CORN-01",
        variety_code="corn",
        observed_date=date(2026, 5, 25),
        price=Decimal("2302"),
        mock_generated_at=MOCK_GENERATED_AT,
    )
    db_session.add(row)
    db_session.commit()

    assert row.data_kind == "simulated"
    assert row.mock_dataset_version == "zhan-v1"
    # SQLite 存回时去掉时区信息，与 MOCK_GENERATED_AT 的 naive 形式一致
    assert row.mock_generated_at == MOCK_GENERATED_AT.replace(tzinfo=None)


def _series_by_spot(db_session):
    """返回 {spot_code: [按日期升序的历史序列点]}"""
    rows = db_session.query(MarketPriceSeries).all()
    by_spot = {}
    for r in rows:
        by_spot.setdefault(r.spot_code, []).append(r)
    for pts in by_spot.values():
        pts.sort(key=lambda p: p.observed_date)
    return by_spot


def test_seed_series_idempotent_and_simulated(db_session):
    seed_zhan_mock_data(db_session)
    series = db_session.query(MarketPriceSeries).all()
    n_spots = db_session.query(MarketSpotPrice).count()
    assert len(series) == n_spots * SERIES_DAYS
    assert all(s.data_kind == "simulated" for s in series)
    assert all(s.mock_dataset_version == "zhan-v1" for s in series)

    first = len(series)
    seed_zhan_mock_data(db_session)
    assert db_session.query(MarketPriceSeries).count() == first


def test_series_ends_at_spot_price(db_session):
    seed_zhan_mock_data(db_session)
    spots = {s.spot_code: s for s in db_session.query(MarketSpotPrice).all()}
    by_spot = _series_by_spot(db_session)
    assert len(by_spot) == len(spots)
    for code, pts in by_spot.items():
        assert len(pts) == SERIES_DAYS
        assert pts[-1].price == spots[code].price


def test_series_day_change_matches_spot_change_pct(db_session):
    seed_zhan_mock_data(db_session)
    spots = {s.spot_code: s for s in db_session.query(MarketSpotPrice).all()}
    by_spot = _series_by_spot(db_session)
    for code, pts in by_spot.items():
        latest = float(pts[-1].price)
        prev = float(pts[-2].price)
        day_change = round((latest - prev) / prev * 100, 1)
        assert abs(day_change - float(spots[code].change_pct)) <= 0.1


def test_series_trend_matches_variety_story(db_session):
    seed_zhan_mock_data(db_session)
    for variety, sign in [("corn", 1), ("soybean", -1)]:
        spot = (
            db_session.query(MarketSpotPrice)
            .filter_by(variety_code=variety)
            .order_by(MarketSpotPrice.id)
            .first()
        )
        pts = sorted(
            db_session.query(MarketPriceSeries)
            .filter_by(spot_code=spot.spot_code)
            .all(),
            key=lambda p: p.observed_date,
        )
        latest = float(pts[-1].price)
        month_ago = float(pts[-31].price)
        month_change = (latest - month_ago) / month_ago * 100
        assert month_change * sign > 0.5


def test_price_series_route(client, db_session):
    seed_zhan_mock_data(db_session)
    spot = (
        db_session.query(MarketSpotPrice)
        .filter_by(variety_code="corn")
        .order_by(MarketSpotPrice.id)
        .first()
    )
    resp = client.get(
        "/api/market/price-series",
        params={"variety_code": "corn", "spot_code": spot.spot_code},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data_kind"] == "simulated"
    assert body["mock_dataset_version"] == "zhan-v1"
    assert body["variety_name"] == "玉米"
    assert body["spot"]["spot_code"] == spot.spot_code
    assert body["spot"]["region_name"] == spot.region_name
    assert body["spot"]["region_type"] == spot.region_type
    assert body["spot"]["quote_type"] == spot.quote_type
    assert body["spot"]["remark"] == spot.remark
    assert body["spot"]["unit"] == "元/吨"
    assert len(body["points"]) == SERIES_DAYS
    assert set(body["points"][0]) == {"observed_date", "price"}
    assert set(body["summary"]) == {
        "latest_price",
        "day_change_pct",
        "week_change_pct",
        "month_change_pct",
        "range_high",
        "range_low",
        "direction",
    }
    assert float(body["summary"]["latest_price"]) == float(spot.price)


def test_price_series_unknown_variety_404(client, db_session):
    seed_zhan_mock_data(db_session)
    resp = client.get(
        "/api/market/price-series",
        params={"variety_code": "unknown", "spot_code": "X"},
    )
    assert resp.status_code == 404


def test_price_series_spot_not_in_variety_404(client, db_session):
    seed_zhan_mock_data(db_session)
    wheat_spot = (
        db_session.query(MarketSpotPrice)
        .filter_by(variety_code="wheat")
        .order_by(MarketSpotPrice.id)
        .first()
    )
    resp = client.get(
        "/api/market/price-series",
        params={"variety_code": "corn", "spot_code": wheat_spot.spot_code},
    )
    assert resp.status_code == 404


def test_series_is_not_monotonic_has_drawdowns(db_session):
    """玉米序列应有明显回调而非单边上涨（回归：曾几乎一路缓涨、一眼假）。"""
    seed_zhan_mock_data(db_session)
    spot = (
        db_session.query(MarketSpotPrice)
        .filter_by(variety_code="corn")
        .order_by(MarketSpotPrice.id)
        .first()
    )
    pts = sorted(
        db_session.query(MarketPriceSeries)
        .filter_by(spot_code=spot.spot_code)
        .all(),
        key=lambda p: p.observed_date,
    )
    prices = [float(p.price) for p in pts]
    has_drawdown = any(
        (prices[i + 30] - prices[i]) / prices[i] * 100 < -1.5
        for i in range(len(prices) - 30)
    )
    assert has_drawdown
