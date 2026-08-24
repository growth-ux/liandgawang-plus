from app.liang.sourcing_graph import _hard_fail


def test_budget_uses_delivered_price_instead_of_listing_price():
    listing = {
        "variety_name": "玉米", "available_quantity_tons": 300, "grade": "二等", "crop_year": 2026,
        "price": "2390", "price_type": "出厂价", "moisture_pct": 14.0, "test_weight_g_l": 686,
        "impurity_pct": 1.0, "latest_ship_at": "2026-08-29",
    }

    result = _hard_fail(listing, {"budget_price": 2400})

    assert result is not None
    assert result[0] == "PRICE_OVER_BUDGET"
    assert "综合到厂价" in result[1]
