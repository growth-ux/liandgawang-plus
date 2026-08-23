from decimal import Decimal

from app.market.metrics import build_summary, classify_direction, pct_change


def test_pct_change():
    assert pct_change(Decimal("2320"), Decimal("2302")) == Decimal("0.8")
    assert pct_change(Decimal("2300"), Decimal("2320")) == Decimal("-0.9")


def test_classify_direction():
    assert classify_direction(Decimal("2.0")) == "偏强"
    assert classify_direction(Decimal("-2.0")) == "偏弱"
    assert classify_direction(Decimal("0.5")) == "震荡"


def test_build_summary():
    # 31 个点：前 30 天 2000，最后一天 2100 → 日/周/月均 +5.0%，偏强
    prices = [Decimal("2000")] * 30 + [Decimal("2100")]
    s = build_summary(prices)
    assert s["latest_price"] == "2100"
    assert s["day_change_pct"] == "5.0"
    assert s["week_change_pct"] == "5.0"
    assert s["month_change_pct"] == "5.0"
    assert s["range_high"] == "2100"
    assert s["range_low"] == "2000"
    assert s["direction"] == "偏强"
