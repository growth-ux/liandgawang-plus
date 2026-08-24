def test_fallback_extracts_demo_requirement_without_key(client, monkeypatch):
    from app.finance import llm
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    response = client.post("/api/finance/requirements/extract", json={
        "text": "采购200吨玉米，缺30万元，预计45天回款，没有抵押物，有采购合同"
    })
    assert response.status_code == 200
    body = response.json()
    assert body["llm_available"] is False
    assert body["fields"] == {
        "purpose": "grain_purchase", "amount_yuan": "300000",
        "duration_days": 45, "business_years": None,
        "guarantee_modes": ["credit"], "credentials": ["purchase_contract"],
    }
    assert body["question"] == "企业持续经营多久了？"


def test_fallback_asks_amount_before_less_important_fields(client, monkeypatch):
    from app.finance import llm
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    body = client.post("/api/finance/requirements/extract", json={
        "text": "想做一笔粮食采购融资，预计用45天"
    }).json()
    assert body["question"] == "本次资金缺口是多少？"


def test_extract_rejects_empty_text(client):
    response = client.post("/api/finance/requirements/extract", json={"text": "  "})
    assert response.status_code == 422
    assert response.json()["detail"] == "请描述本次资金需求"
