from app.liang.mock_seed import seed_liang_mock_data
from app.liang import metrics, repository


def test_summary_aggregates(db_session):
    seed_liang_mock_data(db_session)
    listings = repository.list_listings(db_session)
    summary = metrics.build_summary(listings)
    assert summary["total_listings"] == 12
    assert summary["total_quantity_tons"] == 7900
    assert "玉米" in summary["varieties"]
    assert summary["province_count"] >= 5
    assert summary["price_range"] == {"low": "2280", "high": "3980"}


def test_discoveries_are_deterministic(db_session):
    seed_liang_mock_data(db_session)
    listings = repository.list_listings(db_session)
    d1 = metrics.build_discoveries(listings)
    d2 = metrics.build_discoveries(listings)
    assert [x["id"] for x in d1] == [x["id"] for x in d2]
    assert d1[0]["title"] == "玉米供应最多"
    assert d1[0]["filter"] == {"key": "variety_name", "value": "玉米"}
