from datetime import date
from types import SimpleNamespace

from app.logistics.rules import MODE_NAMES


def seg(code, origin, dest, mode, pl, ph, dl, dh):
    return SimpleNamespace(
        segment_code=code, origin=origin, destination=dest, mode=mode,
        price_low=pl, price_high=ph, days_low=dl, days_high=dh, risk_note="",
        distance_km=0,
    )


SEGMENTS = [
    seg("BC-JZ-ROAD", "白城", "锦州港", "road", 210, 250, 1, 2),
    seg("BC-SZ-ROAD", "白城", "深圳港", "road", 1150, 1280, 3, 4),
    seg("BC-SZ-RAIL", "白城", "深圳港", "rail", 500, 570, 5, 7),
    seg("JZ-SZ-WATER", "锦州港", "深圳港", "water", 95, 120, 6, 9),
]


def test_mode_names():
    assert MODE_NAMES["combined"] == "公水联运"


# ---------- 正式匹配（完整层） ----------

def svc(code, segment, varieties="corn", tmin=30, tmax=300):
    return SimpleNamespace(
        service_code=code, segment_code=segment, varieties=varieties,
        tonnage_min=tmin, tonnage_max=tmax,
        dispatch_window="每日发运", loading_note="", performance_note="", carrier="测试承运方",
    )


SERVICES = [
    svc("S-BC-JZ", "BC-JZ-ROAD", "corn,wheat", 30, 200),
    svc("S-BC-SZ-R", "BC-SZ-ROAD", "corn,wheat,rice", 30, 150),
    svc("S-BC-SZ-RAIL", "BC-SZ-RAIL", "corn", 60, 2000),
    svc("S-JZ-SZ", "JZ-SZ-WATER", "corn,wheat", 500, 30000),
]

REQ = {
    "origin": "白城", "destination": "深圳港", "variety_code": "corn",
    "quantity_tons": 120, "deadline_date": date(2026, 8, 30),
    "allow_split": True, "today": date(2026, 8, 23),
}


def test_match_primary_backup_rejected():
    from app.logistics.rules import match_plans

    out = match_plans(SEGMENTS, SERVICES, REQ)
    assert out["primary"]["mode"] == "rail"  # 5-7 天满足 7 天且更便宜
    assert out["backup"]["mode"] == "road"
    rejected_modes = {r["mode"] for r in out["rejected"]}
    assert rejected_modes == {"combined"}
    overdue = next(r for r in out["rejected"] if r["mode"] == "combined")
    assert "超期" in overdue["reason"]


def test_overdue_low_price_never_primary():
    from app.logistics.rules import match_plans

    out = match_plans(SEGMENTS, SERVICES, REQ | {"deadline_date": date(2026, 8, 28)})
    assert out["primary"]["mode"] == "road"  # 铁路 5-7 天也超期被拒
    assert {r["mode"] for r in out["rejected"]} == {"rail", "combined"}


def test_variety_not_supported_rejected():
    from app.logistics.rules import match_plans

    out = match_plans(SEGMENTS, SERVICES, {**REQ, "variety_code": "rice"})
    # 仅公路直发承运水稻：铁路/联运无水稻服务
    assert out["primary"]["mode"] == "road"
    reasons = {r["mode"]: r["reason"] for r in out["rejected"]}
    assert "品种" in reasons["rail"]


def test_tonnage_without_split_rejected():
    from app.logistics.rules import match_plans

    out = match_plans(
        SEGMENTS, SERVICES, {**REQ, "quantity_tons": 500, "allow_split": False}
    )
    reasons = {r["mode"]: r["reason"] for r in out["rejected"]}
    assert "吨位" in reasons["road"]  # 公路直发上限 150
    assert out["primary"]["mode"] == "rail"


def test_no_feasible_plan():
    from app.logistics.rules import match_plans

    out = match_plans(SEGMENTS, SERVICES, {**REQ, "deadline_date": date(2026, 8, 24)})
    assert out["primary"] is None
    assert out["backup"] is None
    assert len(out["rejected"]) == 3
    assert out["suggestions"]  # 有放宽建议


def test_stable_result():
    from app.logistics.rules import match_plans

    a = match_plans(SEGMENTS, SERVICES, REQ)
    b = match_plans(SEGMENTS, SERVICES, REQ)
    assert a["primary"]["mode"] == b["primary"]["mode"]
    assert a["primary"]["price_low"] == b["primary"]["price_low"]


def test_decision_preferences_change_primary():
    from app.logistics.rules import match_plans

    base = REQ | {"deadline_date": None}
    cost = match_plans(SEGMENTS, SERVICES, base | {"decision_preference": "cost"})
    on_time = match_plans(
        SEGMENTS, SERVICES, base | {"decision_preference": "on_time"}
    )
    balanced = match_plans(
        SEGMENTS, SERVICES, base | {"decision_preference": "balanced"}
    )

    assert cost["primary"]["mode"] == "combined"
    assert on_time["primary"]["mode"] == "road"
    assert balanced["primary"]["mode"] == "combined"


def test_unknown_preference_falls_back_to_balanced():
    from app.logistics.rules import match_plans

    base = REQ | {"deadline_date": None}
    unknown = match_plans(
        SEGMENTS, SERVICES, base | {"decision_preference": "unknown"}
    )
    balanced = match_plans(
        SEGMENTS, SERVICES, base | {"decision_preference": "balanced"}
    )
    assert unknown["primary"]["mode"] == balanced["primary"]["mode"]


def test_deadline_remains_hard_constraint_for_cost_preference():
    from app.logistics.rules import match_plans

    out = match_plans(
        SEGMENTS,
        SERVICES,
        REQ | {"decision_preference": "cost"},
    )
    assert out["primary"]["mode"] == "rail"
    assert any(r["mode"] == "combined" and "超期" in r["reason"] for r in out["rejected"])
