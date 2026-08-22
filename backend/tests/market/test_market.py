from app.market.mock_seed import seed_zhan_mock_data
from app.market.models import MarketSpotPrice


def test_seed_is_idempotent(db_session):
    seed_zhan_mock_data(db_session)
    first = db_session.query(MarketSpotPrice).count()
    seed_zhan_mock_data(db_session)
    assert db_session.query(MarketSpotPrice).count() == first == 131  # 41+30+28+32


def test_seed_all_simulated(db_session):
    seed_zhan_mock_data(db_session)
    spots = db_session.query(MarketSpotPrice).all()
    assert all(s.data_kind == "simulated" for s in spots)
    assert all(s.mock_dataset_version == "zhan-v1" for s in spots)


def test_overview_returns_corn_spots(client, db_session):
    seed_zhan_mock_data(db_session)
    resp = client.get("/api/market/overview", params={"variety_code": "corn"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["variety_name"] == "玉米"
    assert body["data_kind"] == "simulated"
    assert body["mock_dataset_version"] == "zhan-v1"
    assert len(body["spots"]) == 41  # 玉米 41 个库点
    spot = body["spots"][0]
    assert set(spot) == {
        "spot_code",
        "region_name",
        "region_type",
        "quote_type",
        "remark",
        "lng",
        "lat",
        "price",
        "change_pct",
        "last_year_price",
    }


def test_overview_unknown_variety_404(client, db_session):
    seed_zhan_mock_data(db_session)
    resp = client.get("/api/market/overview", params={"variety_code": "unknown"})
    assert resp.status_code == 404
