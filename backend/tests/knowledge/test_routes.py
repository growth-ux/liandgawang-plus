def test_manual_item_overview_edit_disable(client, monkeypatch):
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: "mem-1")
    monkeypatch.setattr("app.knowledge.memory.delete_item", lambda memory_id: True)
    created = client.post(
        "/api/knowledge/items",
        json={
            "knowledge_type": "preference",
            "title": "安全库存低于七天优先保供",
            "content": "安全库存低于七天时，优先选择能够按期到货的方案。",
            "applicable_context": ["玉米补库"],
            "tags": ["保供", "库存"],
        },
    )
    assert created.status_code == 200
    item_id = created.json()["id"]
    assert client.get("/api/knowledge/overview").json()["total_items"] == 1

    edited = client.patch(
        f"/api/knowledge/items/{item_id}",
        json={"content": "库存低于七天时优先保供。"},
    )
    assert edited.json()["content"] == "库存低于七天时优先保供。"

    disabled = client.patch(
        f"/api/knowledge/items/{item_id}", json={"status": "ignored"}
    )
    assert disabled.json()["status"] == "ignored"
    assert client.get("/api/knowledge/items?status=active").json()["items"] == []


def test_an_review_confirmation_learns_risk_rule(client, monkeypatch):
    monkeypatch.setattr("app.knowledge.extractor._extract_with_llm", lambda *args: [])
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: None)
    response = client.post(
        "/api/knowledge/learn/an-review",
        json={
            "record_id": "AR-20260818-003",
            "partner_name": "齐鲁粮贸",
            "partner_type": "粮源供应方",
            "title": "大额集中采购需确认装车排期",
            "experience": "大于 150 吨的集中采购，应提前确认装车排期并要求临近装车复检。",
        },
    )
    assert response.status_code == 200
    assert response.json()["items"][0]["knowledge_type"] == "risk"


def test_search_and_citation_detail(client, monkeypatch):
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: "mem-1")
    created = client.post(
        "/api/knowledge/items",
        json={
            "knowledge_type": "decision",
            "title": "雨季保供优先",
            "content": "雨季紧急补库优先锁定稳定车源。",
            "applicable_context": ["玉米补库", "雨季"],
            "tags": ["玉米", "保供"],
        },
    ).json()
    monkeypatch.setattr(
        "app.knowledge.memory.search_ids", lambda query, limit=10: [created["id"]]
    )
    searched = client.post(
        "/api/knowledge/search",
        json={
            "agent_key": "yun",
            "task_type": "logistics",
            "task_id": 8,
            "query": "雨季玉米补库",
            "context": {"tags": ["玉米", "雨季"]},
        },
    )
    assert searched.status_code == 200
    assert searched.json()["items"][0]["applicable_reason"] == "本次同为玉米、雨季场景"
    assert client.get(
        f"/api/knowledge/items/{created['id']}/citations"
    ).json()["items"] == []
