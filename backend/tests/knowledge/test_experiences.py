SCHEME = {
    "scheme_id": "A", "name": "方案 A", "variety_name": "玉米",
    "quantity_tons": "300", "purchase_price_yuan_per_ton": "2300",
    "tax_included": True, "quality_discount_yuan_per_ton": "12",
    "freight_yuan_per_ton": "160", "loading_yuan_per_ton": "8",
    "loss_rate_pct": "0.5", "financing_cost_yuan": "6000",
    "other_cost_yuan": "0", "constraints_met": True,
    "pending_items": [], "field_meta": {},
}


def _save_completed_record(client, monkeypatch):
    monkeypatch.setattr("app.costing.llm.explain_comparison", lambda v: "ok")
    monkeypatch.setattr("app.knowledge.memory.sync_experience", lambda item: None)
    preview = client.post("/api/costing/calculate", json={"schemes": [SCHEME]})
    saved = client.post("/api/costing/records", json={
        "title": "300 吨玉米到厂成本",
        "source_text": "微信报价原文",
        "schemes": [SCHEME],
        "calculation": preview.json(),
        "selected_scheme_id": "A",
    })
    return saved.json()


def test_completed_costing_creates_editable_experience(client, monkeypatch):
    record = _save_completed_record(client, monkeypatch)
    items = client.get("/api/knowledge/experiences").json()["items"]
    assert len(items) == 1
    assert items[0]["source_record_id"] == record["id"]

    edited = client.patch(
        f"/api/knowledge/experiences/{items[0]['id']}",
        json={"content": "华南到货需同时比较物流与水分折价。"},
    )
    assert edited.json()["content"].startswith("华南到货")


def test_ignore_experience_removes_from_default_list(client, monkeypatch):
    record = _save_completed_record(client, monkeypatch)
    items = client.get("/api/knowledge/experiences").json()["items"]
    exp_id = items[0]["id"]

    ignored = client.post(f"/api/knowledge/experiences/{exp_id}/ignore")
    assert ignored.json()["status"] == "ignored"

    # 默认列表不含已忽略
    items = client.get("/api/knowledge/experiences").json()["items"]
    assert len(items) == 0

    # include_ignored 可以看到
    items = client.get("/api/knowledge/experiences?include_ignored=true").json()["items"]
    assert len(items) == 1


def test_profit_save_also_creates_experience(client, monkeypatch):
    """保存盈亏后也应产生经验（同一条记录只产生一条）"""
    monkeypatch.setattr("app.costing.llm.explain_comparison", lambda v: "ok")
    monkeypatch.setattr("app.knowledge.memory.sync_experience", lambda item: None)

    # 先保存一条 calculated 记录（无意向，不会创建经验）
    preview = client.post("/api/costing/calculate", json={"schemes": [SCHEME]})
    saved = client.post("/api/costing/records", json={
        "title": "测试盈亏经验",
        "schemes": [SCHEME],
        "calculation": preview.json(),
    })
    assert saved.json()["status"] == "calculated"
    assert client.get("/api/knowledge/experiences").json()["items"] == []

    # 保存盈亏 → completed → 创建经验
    profit = client.post(f"/api/costing/records/{saved.json()['id']}/profit", json={
        "selling_price_yuan_per_ton": "2600",
        "sales_fulfillment_cost_yuan": "3000",
    })
    assert profit.status_code == 200
    items = client.get("/api/knowledge/experiences").json()["items"]
    assert len(items) == 1
    assert items[0]["source_record_id"] == saved.json()["id"]
