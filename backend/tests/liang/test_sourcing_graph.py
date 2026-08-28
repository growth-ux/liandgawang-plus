from datetime import date, timedelta

from app.liang.sourcing_graph import run_sourcing_graph

# 发运窗口用相对日期：避免写死日期过期导致测试随时间失败（曾于 2026-08-28 当天边界翻车）
_EARLIEST = (date.today() + timedelta(days=1)).isoformat()
_LATEST = (date.today() + timedelta(days=5)).isoformat()


def _listing(**overrides):
    data = {
        "id": 1,
        "listing_code": "LS001",
        "variety_name": "玉米",
        "grade": "二等",
        "crop_year": 2026,
        "price": "2380.00",
        "price_type": "出厂价",
        "available_quantity_tons": 200,
        "origin_province": "黑龙江",
        "origin_city": "北安",
        "supplier_name": "北安粮贸",
        "earliest_ship_at": _EARLIEST,
        "latest_ship_at": _LATEST,
        "moisture_pct": "13.80",
        "test_weight_g_l": "690",
        "impurity_pct": "0.50",
    }
    return {**data, **overrides}


def test_sourcing_graph_generates_trace_and_recommendation(monkeypatch):
    monkeypatch.setattr("app.liang.sourcing_graph.extract_sourcing_need", lambda _text, fallback: (fallback, "llm"))
    # LLM 比选故意与规则排序相反（主推 LS002），验证最终结果由 AI 决策驱动
    monkeypatch.setattr("app.liang.sourcing_graph.decide_sourcing_picks", lambda _need, _candidates: {"primary_code": "LS002", "backup_code": "LS001", "summary": "AI 比选完成", "decision_basis": ["到厂成本与发运窗口更优"], "procurement_advice": "优先锁定库存", "source": "llm"})
    # 预算需覆盖综合到厂价（挂牌 2380/2390 + 出厂价口径运费 90），否则硬条件会全部淘汰
    result = run_sourcing_graph(
        "120吨二等玉米，7天内可发，预算2500",
        [_listing(), _listing(id=2, listing_code="LS002", price="2390.00")],
    )

    assert [item["node"] for item in result["trace"]] == ["parse", "load", "filter", "sort", "eliminate", "review", "pick", "verify"]
    assert result["plan"]["primary"]["listing_code"] == "LS002"
    assert result["plan"]["backup"]["listing_code"] == "LS001"
    assert result["parser_source"] == "llm"
    assert result["plan"]["ranking_review"]["source"] == "llm"


def test_sourcing_graph_skips_execution_when_no_need_is_extracted(monkeypatch):
    monkeypatch.setattr("app.liang.sourcing_graph.extract_sourcing_need", lambda _text, fallback: (fallback, "rule"))
    result = run_sourcing_graph("帮我看看有没有合适的粮源", [_listing()])

    assert result["plan"]["primary"] is None
    assert result["trace"][0]["node"] == "parse"
    assert all(item["status"] == "skipped" for item in result["trace"][1:])
