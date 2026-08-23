from app.liang.mock_seed import seed_liang_mock_data
from app.liang.models import CandidateBasketItem  # noqa: F401  注册表到 Base.metadata


HEADERS = {"X-Visitor-Id": "visitor-a"}


def test_candidate_basket_persists_and_is_scoped_to_visitor(client, db_session):
    seed_liang_mock_data(db_session)

    created = client.post("/api/liang/candidate-basket", json={"listing_id": 1}, headers=HEADERS)
    assert created.status_code == 200
    assert [item["id"] for item in created.json()["items"]] == [1]

    restored = client.get("/api/liang/candidate-basket", headers=HEADERS)
    assert [item["id"] for item in restored.json()["items"]] == [1]

    other_visitor = client.get("/api/liang/candidate-basket", headers={"X-Visitor-Id": "visitor-b"})
    assert other_visitor.json()["items"] == []


def test_candidate_basket_supports_remove_and_clear(client, db_session):
    seed_liang_mock_data(db_session)
    client.post("/api/liang/candidate-basket", json={"listing_id": 1}, headers=HEADERS)
    client.post("/api/liang/candidate-basket", json={"listing_id": 2}, headers=HEADERS)

    removed = client.delete("/api/liang/candidate-basket/1", headers=HEADERS)
    assert [item["id"] for item in removed.json()["items"]] == [2]

    cleared = client.delete("/api/liang/candidate-basket", headers=HEADERS)
    assert cleared.status_code == 200
    assert client.get("/api/liang/candidate-basket", headers=HEADERS).json()["items"] == []
