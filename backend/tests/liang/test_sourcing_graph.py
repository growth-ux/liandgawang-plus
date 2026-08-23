from app.liang.sourcing_graph import run_sourcing_graph


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
        "earliest_ship_at": "2026-08-24",
        "latest_ship_at": "2026-08-28",
        "moisture_pct": "13.80",
        "test_weight_g_l": "690",
        "impurity_pct": "0.50",
    }
    return {**data, **overrides}


def test_sourcing_graph_generates_trace_and_recommendation(monkeypatch):
    monkeypatch.setattr("app.liang.sourcing_graph.extract_sourcing_need", lambda _text, fallback: (fallback, "llm"))
    monkeypatch.setattr("app.liang.sourcing_graph.review_sourcing_ranking", lambda _need, _primary, _backup: {"summary": "LLM 排序复核完成", "decision_basis": ["综合到厂成本更优"], "procurement_advice": "优先锁定库存", "source": "llm"})
    result = run_sourcing_graph(
        "120吨二等玉米，7天内可发，预算2400",
        [_listing(), _listing(id=2, listing_code="LS002", price="2390.00")],
    )

    assert [item["node"] for item in result["trace"]] == ["parse", "load", "filter", "sort", "eliminate", "pick", "review", "verify"]
    assert result["plan"]["primary"]["listing_code"] == "LS001"
    assert result["plan"]["backup"]["listing_code"] == "LS002"
    assert result["parser_source"] == "llm"
    assert result["plan"]["ranking_review"]["source"] == "llm"


def test_sourcing_graph_skips_execution_when_no_need_is_extracted(monkeypatch):
    monkeypatch.setattr("app.liang.sourcing_graph.extract_sourcing_need", lambda _text, fallback: (fallback, "rule"))
    result = run_sourcing_graph("帮我看看有没有合适的粮源", [_listing()])

    assert result["plan"]["primary"] is None
    assert result["trace"][0]["node"] == "parse"
    assert all(item["status"] == "skipped" for item in result["trace"][1:])
