from app.knowledge.schemas import KnowledgeReference


def _reference():
    return KnowledgeReference(
        knowledge_id=7,
        title="雨季优先锁车源",
        content="紧急补库优先稳定车源",
        source_agent="zhanggui",
        source_title="玉米补库任务",
        applicable_reason="本次同为雨季紧急补库",
        reliability_label="已确认 · 单次经验",
    )


def test_logistics_match_uses_relevant_memory_and_records_effect(client, monkeypatch):
    monkeypatch.setattr(
        "app.knowledge.service.search_for_task", lambda *args, **kwargs: [_reference()]
    )
    monkeypatch.setattr("app.knowledge.service.record_citation", lambda *args, **kwargs: None)
    task = client.post(
        "/api/logistics/tasks",
        json={
            "origin": "长春",
            "destination": "潍坊",
            "variety_code": "corn",
            "quantity_tons": 200,
            "extra_note": "连续降雨，库存只够 5 天",
        },
    ).json()
    matched = client.post(
        f"/api/logistics/tasks/{task['id']}/match", json={"use_memory": True}
    )
    assert matched.status_code == 200
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["memory_references"][0]["knowledge_id"] == 7
    assert "稳定" in detail["task"]["memory_effect"]


def test_logistics_can_rebuild_without_memory(client, monkeypatch):
    monkeypatch.setattr(
        "app.knowledge.service.search_for_task", lambda *args, **kwargs: [_reference()]
    )
    monkeypatch.setattr("app.knowledge.service.record_citation", lambda *args, **kwargs: None)
    task = client.post(
        "/api/logistics/tasks",
        json={
            "origin": "长春",
            "destination": "潍坊",
            "variety_code": "corn",
            "quantity_tons": 200,
            "decision_preference": "balanced",
            "extra_note": "连续降雨，库存只够 5 天",
        },
    ).json()
    client.post(f"/api/logistics/tasks/{task['id']}/match", json={"use_memory": True})
    rebuilt = client.post(
        f"/api/logistics/tasks/{task['id']}/match",
        json={"decision_preference": "cost", "use_memory": False},
    )
    assert rebuilt.status_code == 200
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["memory_references"] == []
    assert detail["task"]["memory_accepted"] is False
    assert detail["task"]["decision_preference"] == "cost"

