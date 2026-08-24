import pytest

from app.finance.seed import seed_finance_products


@pytest.fixture(autouse=True)
def seeded(db_session):
    seed_finance_products(db_session)


def test_meta_exposes_visible_market_summary(client):
    body = client.get("/api/finance/meta").json()
    assert body["product_count"] == 50
    assert set(body["categories"]) == {
        "purchase_working", "order_finance", "warehouse_finance", "receivable_finance"
    }
    assert body["annual_rate_min_pct"] == "4.500"
    assert body["annual_rate_max_pct"] == "9.200"
    assert body["data_updated_at"] == "2026-08-23"


def test_products_filter_by_amount_duration_and_guarantee(client):
    response = client.get(
        "/api/finance/products",
        params={"purpose": "grain_purchase", "amount_yuan": 300000,
                "duration_days": 45, "guarantee_mode": "credit"},
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert items
    assert all(float(x["min_amount_yuan"]) <= 300000 <= float(x["max_amount_yuan"]) for x in items)
    assert all(x["min_days"] <= 45 <= x["max_days"] for x in items)
    assert all("credit" in x["guarantee_modes"] for x in items)


def test_product_detail_and_missing_product(client):
    item = client.get("/api/finance/products").json()["items"][0]
    detail = client.get(f"/api/finance/products/{item['id']}")
    assert detail.status_code == 200
    assert detail.json()["requirements"]
    assert client.get("/api/finance/products/99999").status_code == 404
