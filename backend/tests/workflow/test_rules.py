from decimal import Decimal

import pytest

from app.workflow.rules import (
    build_trigger_reason,
    evaluate_watch_condition,
    format_threshold,
)


def test_price_above():
    assert evaluate_watch_condition("price_above", Decimal("2300"), Decimal("2310")) is True
    assert evaluate_watch_condition("price_above", Decimal("2300"), Decimal("2300")) is True
    assert evaluate_watch_condition("price_above", Decimal("2300"), Decimal("2290")) is False


def test_price_below():
    assert evaluate_watch_condition("price_below", Decimal("2300"), Decimal("2290")) is True
    assert evaluate_watch_condition("price_below", Decimal("2300"), Decimal("2310")) is False


def test_day_change_uses_absolute_value():
    assert evaluate_watch_condition("day_change", Decimal("1.0"), Decimal("-1.5")) is True
    assert evaluate_watch_condition("day_change", Decimal("1.0"), Decimal("0.5")) is False


def test_week_change_uses_absolute_value():
    assert evaluate_watch_condition("week_change", Decimal("2.0"), Decimal("2.5")) is True
    assert evaluate_watch_condition("week_change", Decimal("2.0"), Decimal("-2.5")) is True
    assert evaluate_watch_condition("week_change", Decimal("2.0"), Decimal("1.9")) is False


def test_unknown_type_raises():
    with pytest.raises(ValueError):
        evaluate_watch_condition("spread", Decimal("1"), Decimal("1"))


def test_format_threshold():
    assert format_threshold("price_below", Decimal("2300")) == "2300 元/吨"
    assert format_threshold("day_change", Decimal("2")) == "2%"


def test_build_trigger_reason_contains_state():
    reason = build_trigger_reason("price_below", Decimal("2300"), Decimal("2290"), True)
    assert "已触发" in reason
    assert "2300 元/吨" in reason
