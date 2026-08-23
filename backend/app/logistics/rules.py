"""物流确定性规则：正式匹配（完整层）。

模型只解释这里的结构化结果，不参与排序与数字生成。
"""

from __future__ import annotations

from datetime import date

MODE_NAMES = {"road": "公路", "rail": "铁路", "water": "水运", "combined": "公水联运"}

DECISION_PREFERENCES = {"on_time", "cost", "balanced"}


def normalize_preference(value: str | None) -> str:
    return value if value in DECISION_PREFERENCES else "balanced"


def _mid_price(candidate: dict) -> float:
    return (candidate["price_low"] + candidate["price_high"]) / 2


def plan_sort_key(candidate: dict, preference: str) -> tuple:
    preference = normalize_preference(preference)
    if preference == "on_time":
        return candidate["days_high"], _mid_price(candidate), candidate["transship_count"]
    return _mid_price(candidate), candidate["days_high"], candidate["transship_count"]


def remove_dominated(candidates: list[dict]) -> list[dict]:
    return [
        candidate
        for candidate in candidates
        if not any(
            other is not candidate
            and _mid_price(other) <= _mid_price(candidate)
            and other["days_high"] <= candidate["days_high"]
            and (
                _mid_price(other) < _mid_price(candidate)
                or other["days_high"] < candidate["days_high"]
            )
            for other in candidates
        )
    ]


def _make_result(mode: str, legs: list, transship_count: int) -> dict:
    price_low = sum(l.price_low for l in legs)
    price_high = sum(l.price_high for l in legs)
    days_low = sum(l.days_low for l in legs)
    days_high = sum(l.days_high for l in legs)
    return {
        "mode": mode,
        "mode_name": MODE_NAMES[mode],
        "legs": [
            {
                "origin": l.origin,
                "destination": l.destination,
                "mode": l.mode,
                "mode_name": MODE_NAMES[l.mode],
                "distance_km": l.distance_km,
            }
            for l in legs
        ],
        "price_low": int(price_low),
        "price_high": int(price_high),
        "price_unit": "元/吨",
        "days_low": days_low,
        "days_high": days_high,
        "transship_count": transship_count,
        "risk_note": "；".join(l.risk_note for l in legs if l.risk_note),
        "deadline_ok": None,
        "over_days": 0,
        "tags": [],
    }


def compose_candidates(segments: list, origin: str, destination: str) -> list[dict]:
    """组合候选：直达各方式 + 公水联运（公路段接水运段）。不做任何过滤。"""
    results = []
    for mode in ("road", "rail", "water"):
        direct = [
            s for s in segments
            if s.origin == origin and s.destination == destination and s.mode == mode
        ]
        if direct:
            results.append(_make_result(mode, [direct[0]], 0))
    for road in [s for s in segments if s.origin == origin and s.mode == "road"]:
        for water in [
            s for s in segments
            if s.origin == road.destination and s.destination == destination and s.mode == "water"
        ]:
            results.append(_make_result("combined", [road, water], 1))
    return results


def _find_service(services: list, segment_code: str, variety_code: str):
    return next(
        (
            s for s in services
            if s.segment_code == segment_code and variety_code in s.varieties.split(",")
        ),
        None,
    )


def match_plans(segments: list, services: list, req: dict) -> dict:
    """正式匹配（完整层）：硬条件过滤 → 比较 → 主推/备选/未入选。

    req: origin / destination / variety_code / quantity_tons /
         deadline_date / allow_split / today
    """
    candidates = compose_candidates(segments, req["origin"], req["destination"])
    allowed = None
    if req.get("deadline_date") and req.get("today"):
        allowed = (req["deadline_date"] - req["today"]).days

    feasible, rejected = [], []
    for c in candidates:
        # 硬条件 1：每段都有适配品种的承运服务
        leg_services = []
        missing_legs = []
        for leg in c["legs"]:
            seg_code = next(
                s.segment_code for s in segments
                if s.origin == leg["origin"] and s.destination == leg["destination"]
                and s.mode == leg["mode"]
            )
            service = _find_service(services, seg_code, req["variety_code"])
            if service is None:
                missing_legs.append(f"{leg['origin']}—{leg['destination']}")
            else:
                leg_services.append(service)
        if missing_legs:
            rejected.append({**c, "reason": f"无适配该品种的承运服务（{'/'.join(missing_legs)}）"})
            continue
        # 硬条件 2：吨位（不允许分批时按单批校验）
        max_cap = min(s.tonnage_max for s in leg_services)
        if req["quantity_tons"] > max_cap and not req.get("allow_split", True):
            rejected.append({**c, "reason": f"单批吨位超出承运能力上限 {max_cap} 吨，且不允许分批"})
            continue
        # 硬条件 3：最晚到货
        if allowed is not None and c["days_high"] > allowed:
            rejected.append({**c, "reason": f"预计超期 {c['days_high'] - allowed} 天，无法满足最晚到货"})
            continue
        feasible.append(c)

    # 比较：到货已由硬条件保证，此后按决策偏好排序（默认 balanced）
    preference = normalize_preference(req.get("decision_preference"))
    if preference == "balanced":
        rankable = remove_dominated(feasible)
        dominated = [candidate for candidate in feasible if candidate not in rankable]
        feasible = rankable
        for candidate in dominated:
            rejected.append(
                {**candidate, "reason": "费用与时效同时弱于其他可行方案，作为比较参照"}
            )

    feasible.sort(key=lambda candidate: plan_sort_key(candidate, preference))

    primary = feasible[0] if feasible else None
    backup = feasible[1] if len(feasible) > 1 else None
    for c in feasible[2:]:
        rejected.append({**c, "reason": "存在时效更稳或费用更优的组合，未入选"})

    suggestions = []
    if primary is None and allowed is not None:
        suggestions.append(f"将最晚到货放宽至 {allowed + 3} 天以上，可纳入公水联运等低成本方式")
    if primary is None and not suggestions:
        suggestions.append("放宽到货期限或更换起终节点后重新匹配")

    return {
        "primary": primary,
        "backup": backup,
        "rejected": rejected,
        "suggestions": suggestions,
        "check_items": [
            "参考运价需询运确认实时报价",
            "确认发运窗口与车/船排期",
            "确认收货端卸货能力与作业时间",
        ],
    }
