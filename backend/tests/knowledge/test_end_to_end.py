DEMO_TEXT = "未来15天采购200吨二等玉米到潍坊，库存只够5天，不能影响生产"


def _complete_demo_mission(client) -> int:
    preview = client.post("/api/zhanggui/missions/preview", json={"text": DEMO_TEXT})
    assert preview.status_code == 200
    created = client.post(
        "/api/zhanggui/missions",
        json={
            "raw_request": DEMO_TEXT,
            "goal": preview.json()["goal"],
            "memory_references": preview.json()["memory_references"],
        },
    )
    mission = created.json()
    goal = client.post(
        f"/api/zhanggui/missions/{mission['id']}/confirm-goal",
        json={"goal": {**mission["goal"], "budget_yuan_per_ton": "2500"}},
    )
    team = client.post(
        f"/api/zhanggui/missions/{mission['id']}/confirm-team",
        json={"team": goal.json()["team"]},
    )
    assert team.status_code == 200
    run = client.post(f"/api/zhanggui/missions/{mission['id']}/run")
    decision = next(
        item for item in run.json()["decisions"] if item["status"] == "pending"
    )
    completed = client.post(
        f"/api/zhanggui/missions/{mission['id']}/decisions/{decision['id']}",
        json={"action": "verify_a", "note": ""},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    return mission["id"]


def test_zhanggui_knowledge_is_reused_by_logistics(client, monkeypatch):
    monkeypatch.setattr("app.zhanggui.goal_parser._llm_patch", lambda *args: False)
    monkeypatch.setattr("app.knowledge.extractor._extract_with_llm", lambda *args: [])
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: None)
    monkeypatch.setattr("app.knowledge.memory.search_ids", lambda *args, **kwargs: [])

    mission_id = _complete_demo_mission(client)
    learned = client.get("/api/knowledge/items?source_agent=zhanggui").json()["items"]
    assert learned and learned[0]["source_record_id"] == mission_id

    task = client.post(
        "/api/logistics/tasks",
        json={
            "origin": "长春",
            "destination": "潍坊",
            "variety_code": "corn",
            "quantity_tons": 200,
            "extra_note": "库存只够5天，连续降雨，不能断粮",
        },
    ).json()
    matched = client.post(
        f"/api/logistics/tasks/{task['id']}/match", json={"use_memory": True}
    )
    assert matched.status_code == 200
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["memory_references"]
    assert "稳定" in detail["task"]["memory_effect"]

