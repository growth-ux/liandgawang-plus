from app.market.mock_seed import seed_zhan_mock_data
from app.workflow.models import WatchCondition
from app.workflow.seed import seed_demo_watches


def test_seed_demo_watches_idempotent(db_session):
    seed_zhan_mock_data(db_session)
    seed_demo_watches(db_session)
    first = db_session.query(WatchCondition).count()
    seed_demo_watches(db_session)
    assert db_session.query(WatchCondition).count() == first == 2


def test_seed_demo_one_triggered_one_monitoring(db_session):
    seed_zhan_mock_data(db_session)
    seed_demo_watches(db_session)
    watches = db_session.query(WatchCondition).all()
    statuses = {w.status for w in watches}
    assert statuses == {"triggered", "monitoring"}
    assert all(w.data_kind == "user_input" for w in watches)
    assert all(w.mock_dataset_version == "zhan-v1" for w in watches)


def _seed(db_session):
    seed_zhan_mock_data(db_session)
    seed_demo_watches(db_session)
    db_session.commit()


def test_list_watches(client, db_session):
    _seed(db_session)
    resp = client.get("/api/watches")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    w = body[0]
    assert set(w) == {
        "id",
        "watch_code",
        "variety_code",
        "variety_name",
        "spot_code",
        "region_name",
        "quote_type",
        "watch_type",
        "watch_type_label",
        "threshold",
        "status",
        "current_value",
        "triggered_reason",
        "last_checked_at",
        "data_kind",
        "mock_dataset_version",
    }


def test_create_watch_evaluates_immediately(client, db_session):
    _seed(db_session)
    resp = client.post(
        "/api/watches",
        json={
            "variety_code": "corn",
            "spot_code": "ZHAN-V1-CORN-01",
            "watch_type": "price_above",
            "threshold": 99999,
        },
    )
    assert resp.status_code == 200
    w = resp.json()
    assert w["status"] == "monitoring"
    assert w["watch_type_label"] == "价格高于"
    assert w["current_value"] is not None
    assert w["data_kind"] == "user_input"


def test_create_watch_unknown_type_422(client, db_session):
    _seed(db_session)
    resp = client.post(
        "/api/watches",
        json={
            "variety_code": "corn",
            "spot_code": "ZHAN-V1-CORN-01",
            "watch_type": "spread",
            "threshold": 1,
        },
    )
    assert resp.status_code == 422


def test_create_watch_unknown_spot_404(client, db_session):
    _seed(db_session)
    resp = client.post(
        "/api/watches",
        json={
            "variety_code": "corn",
            "spot_code": "NOPE",
            "watch_type": "price_below",
            "threshold": 2300,
        },
    )
    assert resp.status_code == 404


def test_patch_status_and_threshold(client, db_session):
    _seed(db_session)
    wid = client.get("/api/watches").json()[0]["id"]
    resp = client.patch(f"/api/watches/{wid}", json={"status": "paused"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "paused"
    # 暂停后的关注，重新检查不改状态
    resp2 = client.post(f"/api/watches/{wid}/evaluate")
    assert resp2.json()["status"] == "paused"


def test_evaluate_unknown_404(client, db_session):
    _seed(db_session)
    assert client.post("/api/watches/9999/evaluate").status_code == 404


def test_notified_watch_not_reevaluated_to_triggered(client, db_session):
    _seed(db_session)
    body = client.get("/api/watches").json()
    trig = next(w for w in body if w["status"] == "triggered")
    resp = client.patch(f"/api/watches/{trig['id']}", json={"status": "notified"})
    assert resp.json()["status"] == "notified"
    # 重新打开列表时，已通知的关注不应被重算回 triggered
    body2 = client.get("/api/watches").json()
    updated = next(w for w in body2 if w["id"] == trig["id"])
    assert updated["status"] == "notified"
