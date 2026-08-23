"""寻源任务接口测试：创建、列表、详情、交接、交接前置校验。"""

from app.liang.models import SourcingTask  # noqa: F401  注册表到 Base.metadata


def _need():
    return {"variety": "玉米", "quantity_tons": 120, "grade": "二等"}


def _plan():
    return {
        "need_summary": {"variety": "玉米", "quantity_tons": 120, "grade": "二等"},
        "primary": {
            "listing_code": "LIANG-V1-001",
            "variety_name": "玉米",
            "grade": "二等",
            "crop_year": 2025,
            "origin": "黑龙江绥化",
            "supplier_name": "北安粮贸",
            "price": "2380",
            "price_type": "出厂价",
            "available_quantity_tons": 800,
            "latest_ship_at": "2026-08-28",
            "reasons": ["2025 年新粮"],
            "risks": [],
        },
        "backup": None,
        "eliminated": [],
        "verifications": ["确认可锁定库存"],
    }


def test_create_task(client, db_session):
    resp = client.post("/api/liang/tasks", json={"need": _need(), "plan": _plan()})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "completed"
    assert body["task_code"].startswith("XZ")
    assert body["plan"]["primary"]["listing_code"] == "LIANG-V1-001"


def test_list_tasks(client, db_session):
    client.post("/api/liang/tasks", json={"need": _need(), "plan": _plan()})
    client.post("/api/liang/tasks", json={"need": _need(), "plan": _plan()})
    resp = client.get("/api/liang/tasks")
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 2


def test_task_detail_and_404(client, db_session):
    created = client.post("/api/liang/tasks", json={"need": _need(), "plan": _plan()}).json()
    resp = client.get(f"/api/liang/tasks/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["task_code"] == created["task_code"]
    assert client.get("/api/liang/tasks/99999").status_code == 404


def test_handoff(client, db_session):
    created = client.post("/api/liang/tasks", json={"need": _need(), "plan": _plan()}).json()
    resp = client.post(f"/api/liang/tasks/{created['id']}/handoff", json={"destination": "深圳"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "handed_off"
    assert body["handoff"]["summary"]["destination"] == "深圳"
    assert body["handoff"]["summary"]["primary_listing_code"] == "LIANG-V1-001"
    assert body["handoff"]["handoff_code"].startswith("YJ")


def test_handoff_idempotent(client, db_session):
    created = client.post("/api/liang/tasks", json={"need": _need(), "plan": _plan()}).json()
    client.post(f"/api/liang/tasks/{created['id']}/handoff", json={"destination": "深圳"})
    second = client.post(
        f"/api/liang/tasks/{created['id']}/handoff", json={"destination": "上海"}
    ).json()
    assert second["status"] == "handed_off"
    assert second["handoff"]["summary"]["destination"] == "深圳"  # 未覆盖首次交接


def test_handoff_requires_primary(client, db_session):
    plan_no_primary = {
        "need_summary": None,
        "primary": None,
        "backup": None,
        "eliminated": [],
        "verifications": [],
    }
    created = client.post(
        "/api/liang/tasks", json={"need": _need(), "plan": plan_no_primary}
    ).json()
    resp = client.post(
        f"/api/liang/tasks/{created['id']}/handoff", json={"destination": "深圳"}
    )
    assert resp.status_code == 422
