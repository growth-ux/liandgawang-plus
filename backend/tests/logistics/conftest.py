import pytest


@pytest.fixture(autouse=True)
def _seed_logistics(db_session):
    from app.logistics.seed import seed_logistics_mock_data

    seed_logistics_mock_data(db_session)
