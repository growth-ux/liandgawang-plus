from app.liang.mock_seed import seed_liang_mock_data
from app.liang import repository


def test_list_all(db_session):
    seed_liang_mock_data(db_session)
    result = repository.list_listings(db_session)
    assert len(result) == 200


def test_list_by_variety(db_session):
    seed_liang_mock_data(db_session)
    result = repository.list_listings(db_session, {"variety_name": "玉米"})
    assert len(result) > 8
    assert all(l.variety_name == "玉米" for l in result)


def test_list_by_price_range(db_session):
    seed_liang_mock_data(db_session)
    result = repository.list_listings(db_session, {"min_price": 2300, "max_price": 2400})
    assert result
    assert all(2300 <= float(l.price) <= 2400 for l in result)


def test_get_listing_found_and_missing(db_session):
    seed_liang_mock_data(db_session)
    first = repository.list_listings(db_session)[0]
    assert repository.get_listing(db_session, first.id) is not None
    assert repository.get_listing(db_session, 99999) is None
