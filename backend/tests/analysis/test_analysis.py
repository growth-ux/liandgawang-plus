from datetime import timedelta

import pytest

from app.market.mock_seed import PRICE_DATE, seed_zhan_mock_data


@pytest.fixture(autouse=True)
def _no_llm(monkeypatch):
    """测试隔离真实大模型调用，避免依赖网络与本地 .env 配置。"""
    monkeypatch.setattr("app.analysis.llm.QWEN_API_KEY", "")

CORN_15D = {
    "variety_code": "corn",
    "quantity_tons": "120",
    "deadline_date": (PRICE_DATE + timedelta(days=15)).isoformat(),
    "target_region": "东北",
}


def test_preview_corn_15d_stable_split(client, db_session):
    """代表场景：15 天内采购 120 吨玉米，稳定得到分批采购建议。"""
    seed_zhan_mock_data(db_session)
    resp = client.post("/api/analysis/preview", json=CORN_15D)
    assert resp.status_code == 200
    body = resp.json()
    assert body["data_kind"] == "simulated"
    assert body["mock_dataset_version"] == "zhan-v1"
    assert body["action"] == "split"
    assert body["ratio_low"] is not None and body["ratio_high"] is not None
    assert 20 <= body["ratio_low"] < body["ratio_high"] <= 60
    assert body["time_window"]
    assert body["supporting"] and body["summary"]
    assert body["invalidation"] and body["watch_metrics"]
    # 常规研判不输出数据缺失项，不在页面自报数据短板
    assert body["missing_data"] == []


def test_preview_without_api_key_falls_back_to_rule(client, db_session):
    """未配置 QWEN_API_KEY：解读为空、标记规则版，骨架仍完整。"""
    seed_zhan_mock_data(db_session)
    body = client.post("/api/analysis/preview", json=CORN_15D).json()
    assert body["ai_source"] == "rule"
    assert body["interpretation"] is None
    assert body["action"] == "split"


def test_qwen_interpretation_used_when_available(client, db_session, monkeypatch):
    """模拟 Qwen 可用：解读随结果返回并随研判保存。"""
    seed_zhan_mock_data(db_session)
    monkeypatch.setattr(
        "app.analysis.routes.interpret_judgment", lambda j, c: "模拟大模型解读"
    )
    preview = client.post("/api/analysis/preview", json=CORN_15D).json()
    assert preview["ai_source"] == "qwen"
    assert preview["interpretation"] == "模拟大模型解读"

    saved = client.post("/api/analysis", json=CORN_15D).json()
    assert saved["ai_source"] == "qwen"
    assert saved["interpretation"] == "模拟大模型解读"


def test_preview_tight_deadline_buy_now(client, db_session):
    """最晚时间仅剩 2 天：不赌方向，立即采购。"""
    seed_zhan_mock_data(db_session)
    resp = client.post(
        "/api/analysis/preview",
        json={**CORN_15D, "deadline_date": (PRICE_DATE + timedelta(days=2)).isoformat()},
    )
    body = resp.json()
    assert body["action"] == "buy_now"
    assert (body["ratio_low"], body["ratio_high"]) == (100, 100)


def test_preview_without_seed_is_verify(client, db_session):
    """行情未初始化：证据不足，不输出强行动建议。"""
    resp = client.post("/api/analysis/preview", json=CORN_15D)
    body = resp.json()
    assert body["action"] == "verify"
    assert body["evidence_completeness"] == "low"


def test_create_and_list_analysis(client, db_session):
    """保存研判 → 列表与详情可查，条件与结论快照完整。"""
    seed_zhan_mock_data(db_session)
    resp = client.post(
        "/api/analysis",
        json={**CORN_15D, "target_region": "锦州", "budget_price": "2600"},
    )
    assert resp.status_code == 200
    body = resp.json()
    record_id = body["record_id"]
    assert body["variety_name"] == "玉米"
    assert body["quantity_tons"] == "120"
    assert body["action"] == "split"
    assert isinstance(body["supporting"], list)

    listed = client.get("/api/analysis").json()
    assert any(r["id"] == record_id for r in listed)

    detail = client.get(f"/api/analysis/{record_id}").json()
    assert detail["id"] == record_id
    assert detail["deadline_date"] == CORN_15D["deadline_date"]


def test_analysis_validation(client, db_session):
    seed_zhan_mock_data(db_session)
    # 未知品种
    assert client.post("/api/analysis/preview", json={**CORN_15D, "variety_code": "x"}).status_code == 404
    # 数量为 0
    assert client.post("/api/analysis/preview", json={**CORN_15D, "quantity_tons": "0"}).status_code == 422
    # 缺少必填（数量/最晚时间/目标地区）
    assert client.post("/api/analysis/preview", json={"variety_code": "corn"}).status_code == 422
    assert (
        client.post(
            "/api/analysis/preview", json={**CORN_15D, "target_region": ""}
        ).status_code
        == 422
    )
    # 不存在的记录
    assert client.get("/api/analysis/9999").status_code == 404
