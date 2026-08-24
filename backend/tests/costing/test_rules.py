from decimal import Decimal

import pytest

from app.costing.rules import calculate_scheme, compare_schemes, calculate_profit
from app.costing.schemas import ProfitRequest, SchemeInput


def make_scheme(**changes) -> SchemeInput:
    data = {
        "scheme_id": "A",
        "name": "吉林粮源 A + 铁路方案",
        "variety_name": "玉米",
        "quantity_tons": Decimal("300"),
        "purchase_price_yuan_per_ton": Decimal("2300"),
        "tax_included": True,
        "quality_discount_yuan_per_ton": Decimal("12"),
        "freight_yuan_per_ton": Decimal("160"),
        "loading_yuan_per_ton": Decimal("8"),
        "loss_rate_pct": Decimal("0.5"),
        "financing_cost_yuan": Decimal("6000"),
        "other_cost_yuan": Decimal("0"),
        "constraints_met": True,
        "pending_items": [],
        "field_meta": {},
    }
    data.update(changes)
    return SchemeInput(**data)


def test_calculate_scheme_uses_loss_once():
    result = calculate_scheme(make_scheme())
    assert result.purchase_total_yuan == Decimal("690000.00")
    assert result.total_cost_yuan == Decimal("750000.00")
    assert result.usable_quantity_tons == Decimal("298.5000")
    assert result.delivered_cost_yuan_per_ton == Decimal("2512.56")


def test_compare_schemes_excludes_failed_hard_condition():
    result = compare_schemes([
        make_scheme(),
        make_scheme(scheme_id="B", name="不满足质量条件", constraints_met=False),
    ])
    assert result.recommended_scheme_id == "A"
    assert result.results[1].eligible is False


def test_profit_scenario_returns_margin_and_break_even():
    profit = calculate_profit(
        make_scheme(),
        ProfitRequest(
            selling_price_yuan_per_ton=Decimal("2600"),
            sales_fulfillment_cost_yuan=Decimal("3000"),
        ),
    )
    assert profit.total_profit_yuan == Decimal("23100.00")
    assert profit.profit_yuan_per_ton == Decimal("77.39")
    assert profit.break_even_price_yuan_per_ton == Decimal("2522.61")


def test_comparison_rejects_mixed_tax_basis():
    with pytest.raises(ValueError, match="含税口径"):
        compare_schemes([make_scheme(), make_scheme(scheme_id="B", tax_included=False)])
