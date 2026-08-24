from app.handoff.models import AgentHandoff  # noqa: F401  注册表到 Base.metadata


def test_handoff_can_be_created_and_accepted(client):
    created = client.post("/api/handoffs", json={
        "source_agent": "liang",
        "target_agent": "yun",
        "source_ref": "XY-001",
        "title": "安排运输",
        "summary": "绥化至潍坊，120 吨玉米",
        "payload": {"type": "transport_requirement", "origin": "绥化"},
    })
    assert created.status_code == 200
    assert created.json()["status"] == "pending"

    accepted = client.post(f"/api/handoffs/{created.json()['id']}/accept")
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    assert accepted.json()["payload"]["origin"] == "绥化"
