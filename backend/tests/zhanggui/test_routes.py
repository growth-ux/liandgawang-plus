import json

DEMO_TEXT = "未来15天采购200吨二等玉米到潍坊，不能影响生产"


def _create_demo_mission(client) -> int:
    preview = client.post("/api/zhanggui/missions/preview", json={"text": DEMO_TEXT})
    assert preview.status_code == 200
    created = client.post("/api/zhanggui/missions", json={
        "raw_request": DEMO_TEXT,
        "goal": preview.json()["goal"],
        "memory_references": preview.json()["memory_references"],
    })
    assert created.status_code == 200
    return created.json()["id"]


def test_demo_mission_api_reaches_human_decision(client):
    preview = client.post("/api/zhanggui/missions/preview", json={"text": DEMO_TEXT})
    assert preview.status_code == 200

    created = client.post("/api/zhanggui/missions", json={
        "raw_request": DEMO_TEXT,
        "goal": preview.json()["goal"],
        "memory_references": preview.json()["memory_references"],
    }).json()
    mission_id = created["id"]

    goal = client.post(f"/api/zhanggui/missions/{mission_id}/confirm-goal", json={
        "goal": {**created["goal"], "budget_yuan_per_ton": "2500"}
    })
    assert goal.status_code == 200

    team = client.post(f"/api/zhanggui/missions/{mission_id}/confirm-team", json={
        "team": goal.json()["team"]
    })
    assert team.status_code == 200

    run = client.post(f"/api/zhanggui/missions/{mission_id}/run")
    assert run.status_code == 200
    assert run.json()["status"] == "awaiting_decision"
    assert run.json()["recommendation"]["primary_scheme_id"] == "A"


def test_duplicate_goal_confirmation_rejected(client):
    mission_id = _create_demo_mission(client)
    snapshot = client.get(f"/api/zhanggui/missions/{mission_id}").json()
    payload = {"goal": snapshot["goal"]}
    assert client.post(f"/api/zhanggui/missions/{mission_id}/confirm-goal", json=payload).status_code == 200
    assert client.post(f"/api/zhanggui/missions/{mission_id}/confirm-goal", json=payload).status_code == 409


def test_run_before_team_confirmation_rejected(client):
    mission_id = _create_demo_mission(client)
    snapshot = client.get(f"/api/zhanggui/missions/{mission_id}").json()
    client.post(f"/api/zhanggui/missions/{mission_id}/confirm-goal", json={"goal": snapshot["goal"]})
    response = client.post(f"/api/zhanggui/missions/{mission_id}/run")
    assert response.status_code == 409
    assert "团队" in response.json()["detail"]


def test_missing_mission_returns_404(client):
    assert client.get("/api/zhanggui/missions/9999").status_code == 404
    assert client.post("/api/zhanggui/missions/9999/run").status_code == 404


def test_events_stream_returns_ndjson(client):
    mission_id = _create_demo_mission(client)
    snapshot = client.get(f"/api/zhanggui/missions/{mission_id}").json()
    client.post(f"/api/zhanggui/missions/{mission_id}/confirm-goal", json={"goal": snapshot["goal"]})
    team = client.get(f"/api/zhanggui/missions/{mission_id}").json()["team"]
    client.post(f"/api/zhanggui/missions/{mission_id}/confirm-team", json={"team": team})

    response = client.get(f"/api/zhanggui/missions/{mission_id}/events")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    events = [json.loads(line) for line in response.text.splitlines() if line]
    types = {event["type"] for event in events}
    assert {"agent_started", "agent_completed", "conflict_found", "decision_required"} <= types
    assert all(event["mission_id"] == mission_id for event in events)

    # 已到达闸门后再次请求事件，不重复运行小二
    replay = client.get(f"/api/zhanggui/missions/{mission_id}/events")
    replay_events = [json.loads(line) for line in replay.text.splitlines() if line]
    assert not any(event["type"] == "agent_started" for event in replay_events)


def test_submit_decision_via_api_creates_action_tasks(client):
    mission_id = _create_demo_mission(client)
    snapshot = client.get(f"/api/zhanggui/missions/{mission_id}").json()
    client.post(f"/api/zhanggui/missions/{mission_id}/confirm-goal", json={"goal": snapshot["goal"]})
    team = client.get(f"/api/zhanggui/missions/{mission_id}").json()["team"]
    client.post(f"/api/zhanggui/missions/{mission_id}/confirm-team", json={"team": team})
    run = client.post(f"/api/zhanggui/missions/{mission_id}/run").json()
    decision = next(d for d in run["decisions"] if d["status"] == "pending")

    response = client.post(
        f"/api/zhanggui/missions/{mission_id}/decisions/{decision['id']}",
        json={"action": "verify_a", "note": ""},
    )
    assert response.status_code == 200
    tasks = {item["action_code"]: item["status"] for item in response.json()["action_tasks"]}
    assert tasks["ACT-VERIFY-A"] == "ready"
    assert tasks["ACT-INQUIRY-A"] == "waiting_prerequisite"
