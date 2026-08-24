from app.costing import llm
from app.costing.rules import compare_schemes
from tests.costing.test_rules import make_scheme


def test_fallback_extracts_two_quotes_and_asks_tax_basis(monkeypatch):
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    result = llm.extract_schemes(
        "方案A：玉米300吨，2300元/吨，运费160元/吨；"
        "方案B：玉米300吨，2320元/吨，运费130元/吨"
    )
    assert result["llm_available"] is False
    assert len(result["schemes"]) == 2
    assert "含税" in "".join(result["questions"])
    assert result["schemes"][0]["loss_rate_pct"] is None


def test_explanation_fallback_only_uses_calculated_numbers(monkeypatch):
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    comparison = compare_schemes([make_scheme()])
    text = llm.explain_comparison(comparison)
    assert comparison.recommended_scheme_id in text
    assert "预计节省" not in text


def test_profit_question_fallback_extracts_price_drop(monkeypatch):
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    assert llm.extract_profit_change("售价跌30元还能不能做？") == {
        "selling_price_delta_yuan_per_ton": "-30"
    }
