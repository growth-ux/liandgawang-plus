def _create_and_match(client):
    resp = client.post(
        "/api/logistics/tasks",
        json={
            "origin": "白城",
            "destination": "深圳港",
            "variety_code": "corn",
            "quantity_tons": 120,
            "deadline_date": "2026-08-30",
        },
    )
    task = resp.json()
    client.post(f"/api/logistics/tasks/{task['id']}/match")
    return task


def test_extract_unavailable_without_key(client, monkeypatch):
    from app.logistics import llm

    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    resp = client.post(
        "/api/logistics/extract", json={"text": "120 吨玉米，白城到深圳港，一周内到"}
    )
    assert resp.status_code == 200
    assert resp.json()["llm_available"] is False


def test_explain_fallback_without_key(client, monkeypatch):
    from app.logistics import llm

    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    task = _create_and_match(client)
    resp = client.post(
        "/api/logistics/explain",
        json={"task_id": task["id"], "question": "为什么主推铁路？"},
    )
    assert resp.status_code == 200
    answer = resp.json()["answer"]
    assert "主推" in answer
    assert "未入选" in answer
