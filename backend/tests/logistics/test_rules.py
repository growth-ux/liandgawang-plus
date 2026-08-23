from datetime import date
from types import SimpleNamespace

from app.logistics.rules import MODE_NAMES, quick_estimate_modes


def seg(code, origin, dest, mode, pl, ph, dl, dh):
    return SimpleNamespace(
        segment_code=code, origin=origin, destination=dest, mode=mode,
        price_low=pl, price_high=ph, days_low=dl, days_high=dh, risk_note="",
    )


SEGMENTS = [
    seg("BC-JZ-ROAD", "白城", "锦州港", "road", 210, 250, 1, 2),
    seg("BC-SZ-ROAD", "白城", "深圳港", "road", 1150, 1280, 3, 4),
    seg("BC-SZ-RAIL", "白城", "深圳港", "rail", 500, 570, 5, 7),
    seg("JZ-SZ-WATER", "锦州港", "深圳港", "water", 95, 120, 6, 9),
]


def test_direct_modes_returned():
    results = quick_estimate_modes(SEGMENTS, "白城", "深圳港")
    modes = {r["mode"] for r in results}
    assert modes == {"road", "rail", "combined"}


def test_combined_composes_road_and_water():
    results = quick_estimate_modes(SEGMENTS, "白城", "深圳港")
    combined = next(r for r in results if r["mode"] == "combined")
    assert combined["price_low"] == 305  # 210 + 95
    assert combined["price_high"] == 370  # 250 + 120
    assert combined["days_low"] == 7  # 1 + 6
    assert combined["days_high"] == 11  # 2 + 9
    assert combined["transship_count"] == 1
    assert [l["origin"] for l in combined["legs"]] == ["白城", "锦州港"]


def test_no_route_returns_empty():
    assert quick_estimate_modes(SEGMENTS, "哈尔滨", "深圳港") == []


def test_deadline_flags_overdue():
    today = date(2026, 8, 23)
    deadline = date(2026, 8, 30)  # 7 天
    results = quick_estimate_modes(SEGMENTS, "白城", "深圳港", deadline, today)
    by_mode = {r["mode"]: r for r in results}
    assert by_mode["rail"]["deadline_ok"] is True
    assert by_mode["road"]["deadline_ok"] is True
    assert by_mode["combined"]["deadline_ok"] is False
    assert by_mode["combined"]["over_days"] == 4  # 11 - 7


def test_no_deadline_means_unknown():
    results = quick_estimate_modes(SEGMENTS, "白城", "深圳港")
    assert all(r["deadline_ok"] is None for r in results)


def test_tags_cheapest_and_fastest():
    results = quick_estimate_modes(SEGMENTS, "白城", "深圳港")
    by_mode = {r["mode"]: r for r in results}
    assert "更省钱" in by_mode["combined"]["tags"]
    assert "更快到货" in by_mode["road"]["tags"]


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
