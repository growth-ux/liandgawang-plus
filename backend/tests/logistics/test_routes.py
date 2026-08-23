from app.logistics.seed import seed_logistics_mock_data


def test_seed_loads_segments_and_services(db_session):
    from app.logistics.models import LogisticsService, RouteSegment

    seed_logistics_mock_data(db_session)
    assert db_session.query(RouteSegment).count() == 10
    assert db_session.query(LogisticsService).count() == 200


def test_seed_idempotent(db_session):
    from app.logistics.models import LogisticsService, RouteSegment

    seed_logistics_mock_data(db_session)
    seed_logistics_mock_data(db_session)
    assert db_session.query(RouteSegment).count() == 10
    assert db_session.query(LogisticsService).count() == 200


# ---------- 测算与市场接口 ----------

def test_meta_nodes(client):
    data = client.get("/api/logistics/meta").json()
    assert "白城" in data["nodes"]
    assert "深圳港" in data["nodes"]
    assert len(data["varieties"]) == 4


def test_hot_routes(client):
    items = client.get("/api/logistics/hot-routes").json()
    assert 6 <= len(items) <= 8
    assert all("price_low" in i and "days_hint" in i for i in items)


def test_lines(client):
    items = client.get("/api/logistics/lines").json()
    assert len(items) == 10
    first = items[0]
    for key in ("origin", "destination", "mode_name", "carrier", "tonnage_min",
                "tonnage_max", "price_low", "price_high", "days_low", "days_high",
                "dispatch_window"):
        assert key in first


def test_estimate_with_deadline(client):
    resp = client.post(
        "/api/logistics/estimates",
        json={
            "origin": "白城",
            "destination": "深圳港",
            "variety_code": "corn",
            "quantity_tons": 120,
            "deadline_date": "2026-08-30",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    modes = {r["mode"] for r in data["results"]}
    assert modes == {"road", "rail", "combined"}
    combined = next(r for r in data["results"] if r["mode"] == "combined")
    assert combined["deadline_ok"] is False

    listed = client.get("/api/logistics/estimates").json()
    assert listed[0]["origin"] == "白城"


def test_estimate_no_route(client):
    resp = client.post(
        "/api/logistics/estimates",
        json={"origin": "哈尔滨", "destination": "鲅鱼圈港", "quantity_tons": 100},
    )
    assert resp.json()["results"] == []


# ---------- 任务与匹配接口 ----------

def _create_demo_task(client, deadline="2026-08-30"):
    resp = client.post(
        "/api/logistics/tasks",
        json={
            "origin": "白城",
            "destination": "深圳港",
            "variety_code": "corn",
            "quantity_tons": 120,
            "deadline_date": deadline,
            "source_type": "estimate",
            "source_ref": "1",
        },
    )
    assert resp.status_code == 200
    return resp.json()


def test_create_task_and_match(client):
    task = _create_demo_task(client)
    assert task["status"] == "working"

    resp = client.post(f"/api/logistics/tasks/{task['id']}/match")
    assert resp.json()["primary"] is True

    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["status"] == "plans_ready"
    by_type = {}
    for p in detail["plans"]:
        by_type.setdefault(p["plan_type"], []).append(p)
    assert by_type["primary"][0]["title"].startswith("铁路")
    assert by_type["backup"][0]["title"].startswith("公路")
    assert any("超期" in r["reason"] for r in by_type["rejected"])


def test_match_no_feasible(client):
    task = _create_demo_task(client, deadline="2026-08-24")
    resp = client.post(f"/api/logistics/tasks/{task['id']}/match")
    assert resp.json()["primary"] is False
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["blocked_note"]  # 有放宽建议
    assert all(p["plan_type"] == "rejected" for p in detail["plans"])


def test_task_list(client):
    _create_demo_task(client)
    tasks = client.get("/api/logistics/tasks").json()
    assert tasks[0]["origin"] == "白城"
    assert "status_label" in tasks[0]


# ---------- 询运与反馈接口 ----------

def test_inquiry_flow(client):
    task = _create_demo_task(client)
    client.post(f"/api/logistics/tasks/{task['id']}/match")
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    primary = next(p for p in detail["plans"] if p["plan_type"] == "primary")

    resp = client.post(
        f"/api/logistics/tasks/{task['id']}/inquiry", json={"plan_id": primary["id"]}
    )
    assert resp.status_code == 200
    inquiry = resp.json()
    assert inquiry["status"] == "draft"
    assert "白城" in inquiry["content"]["路线"]
    assert "玉米" in inquiry["content"]["品种与数量"]

    resp = client.post(f"/api/logistics/inquiries/{inquiry['id']}/submit")
    submitted = resp.json()
    assert submitted["status"] == "feedback"
    assert submitted["feedback"]["反馈方"]
    assert "元/吨" in submitted["feedback"]["报价"]

    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["status"] == "feedback"
    assert detail["inquiry"]["feedback"] is not None


def test_rejected_plan_cannot_inquiry(client):
    task = _create_demo_task(client)
    client.post(f"/api/logistics/tasks/{task['id']}/match")
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    rejected = next(p for p in detail["plans"] if p["plan_type"] == "rejected")
    resp = client.post(
        f"/api/logistics/tasks/{task['id']}/inquiry", json={"plan_id": rejected["id"]}
    )
    assert resp.status_code == 400
