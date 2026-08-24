import pytest

from app.finance.seed import seed_finance_products


@pytest.fixture(autouse=True)
def seeded(db_session):
    seed_finance_products(db_session)


DEMAND = {
    "purpose": "grain_purchase", "amount_yuan": "300000", "duration_days": 45,
    "business_years": "2", "guarantee_modes": ["credit"],
    "credentials": ["purchase_contract"], "source_type": "manual",
}


def test_preview_returns_explainable_primary_backup_and_rejection(client, monkeypatch):
    from app.finance import llm
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    response = client.post("/api/finance/matches/preview", json={"requirement": DEMAND})
    assert response.status_code == 200
    body = response.json()
    assert body["primary"]["product"]["product_code"] == "QIAN-V1-PW-01"
    assert 1 <= len(body["backups"]) <= 2
    assert any("凭证" in "".join(x["rejection_reasons"]) or "增信" in "".join(x["rejection_reasons"])
               for x in body["rejected"])
    assert "粮采周转贷" in body["explanation"]


def test_preview_does_not_save_until_user_requests_save(client, monkeypatch):
    from app.finance import llm
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    client.post("/api/finance/matches/preview", json={"requirement": DEMAND})
    assert client.get("/api/finance/matches").json()["items"] == []
    saved = client.post("/api/finance/matches", json={"requirement": DEMAND})
    assert saved.status_code == 200
    assert len(client.get("/api/finance/matches").json()["items"]) == 1


def test_no_full_match_returns_no_primary_and_clear_message(client, monkeypatch):
    from app.finance import llm
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    demand = DEMAND | {"amount_yuan": "9000000", "duration_days": 600}
    body = client.post("/api/finance/matches/preview", json={"requirement": demand}).json()
    assert body["primary"] is None
    assert body["backups"] == []
    assert body["rejected"]
    assert "没有完全符合" in body["explanation"]


def test_saved_match_detail_and_suan_handoff(client, monkeypatch):
    from app.finance import llm
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    saved = client.post("/api/finance/matches", json={"requirement": DEMAND}).json()
    detail = client.get(f"/api/finance/matches/{saved['id']}")
    assert detail.status_code == 200
    handoff = client.post(f"/api/finance/matches/{saved['id']}/handoff/suan").json()
    assert handoff["source_agent"] == "qian"
    assert handoff["target_agent"] == "suan"
    assert handoff["amount_yuan"] == "300000"
    assert handoff["duration_days"] == 45
    assert handoff["reference_cost_yuan"] == saved["result"]["primary"]["estimated_cost_yuan"]
