SCHEME = {
    "scheme_id": "A", "name": "方案 A", "variety_name": "玉米",
    "quantity_tons": "300", "purchase_price_yuan_per_ton": "2300",
    "tax_included": True, "quality_discount_yuan_per_ton": "12",
    "freight_yuan_per_ton": "160", "loading_yuan_per_ton": "8",
    "loss_rate_pct": "0.5", "financing_cost_yuan": "6000",
    "other_cost_yuan": "0", "constraints_met": True,
    "pending_items": [], "field_meta": {},
}


def test_preview_then_save_and_complete_record(client, monkeypatch):
    monkeypatch.setattr("app.costing.llm.explain_comparison", lambda value: "方案 A 综合成本最低")
    preview = client.post("/api/costing/calculate", json={"schemes": [SCHEME]})
    assert preview.status_code == 200
    assert client.get("/api/costing/records").json()["items"] == []

    saved = client.post("/api/costing/records", json={
        "title": "300 吨玉米到厂成本", "source_text": "微信报价原文",
        "schemes": [SCHEME], "calculation": preview.json(),
        "selected_scheme_id": "A",
    })
    assert saved.status_code == 200
    assert saved.json()["status"] == "completed"

    profit = client.post(f"/api/costing/records/{saved.json()['id']}/profit", json={
        "selling_price_yuan_per_ton": "2600",
        "sales_fulfillment_cost_yuan": "3000",
    })
    assert profit.status_code == 200
    assert profit.json()["profit"]["total_profit_yuan"] == "23100.00"


def test_calculate_mixed_tax_returns_422(client):
    scheme_b = {**SCHEME, "scheme_id": "B", "tax_included": False}
    response = client.post("/api/costing/calculate", json={"schemes": [SCHEME, scheme_b]})
    assert response.status_code == 422
    assert "含税口径" in response.json()["detail"]


def test_extract_empty_text_returns_422(client):
    response = client.post("/api/costing/extract", json={"text": "  "})
    assert response.status_code == 422


def test_clone_record_creates_new_pending(client, monkeypatch):
    monkeypatch.setattr("app.costing.llm.explain_comparison", lambda value: "ok")
    saved = client.post("/api/costing/records", json={
        "title": "原始记录",
        "schemes": [SCHEME],
        "calculation": client.post("/api/costing/calculate", json={"schemes": [SCHEME]}).json(),
        "selected_scheme_id": "A",
    })
    assert saved.status_code == 200

    cloned = client.post(f"/api/costing/records/{saved.json()['id']}/clone")
    assert cloned.status_code == 200
    body = cloned.json()
    assert body["id"] != saved.json()["id"]
    assert body["status"] == "pending"
    assert body["calculation"] is None
    assert body["selected_scheme_id"] is None
