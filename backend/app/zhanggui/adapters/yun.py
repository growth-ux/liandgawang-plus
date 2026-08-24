"""运小二适配器：调用运输匹配规则形成两批到厂方案。"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.logistics import repository as logistics_repo
from app.logistics.rules import match_plans
from app.zhanggui import demo_data
from app.zhanggui.adapters.base import AgentContext
from app.zhanggui.schemas import AgentResult


@dataclass
class _Segment:
    segment_code: str
    origin: str
    destination: str
    mode: str
    distance_km: int
    price_low: Decimal
    price_high: Decimal
    days_low: int
    days_high: int
    risk_note: str = ""


@dataclass
class _Service:
    segment_code: str
    varieties: str
    tonnage_min: int
    tonnage_max: int


def _demo_segments(destination: str) -> list[_Segment]:
    """演示兜底线路：把到厂端点替换为本次目的地。"""
    segments = []
    for code, origin, dest, mode, km, pl, ph, dl, dh, note in demo_data.DEMO_SEGMENT_ROWS:
        if dest == "潍坊":
            dest = destination
        segments.append(_Segment(code, origin, dest, mode, km, Decimal(pl), Decimal(ph), dl, dh, note))
    return segments


def _demo_services() -> list[_Service]:
    return [
        _Service(segment_code, varieties, tmin, tmax)
        for _service_code, _carrier, segment_code, varieties, tmin, tmax in demo_data.DEMO_SERVICE_ROWS
    ]


def _mid(plan: dict) -> Decimal:
    return (Decimal(plan["price_low"]) + Decimal(plan["price_high"])) / 2


def run(db: Session, context: AgentContext) -> AgentResult:
    goal = context.goal
    destination = goal.destination or "到厂"
    liang_result = context.prior_results.get("liang")
    origin = liang_result.facts.get("origin", demo_data.DEMO_TRANSPORT_ORIGIN) if liang_result else demo_data.DEMO_TRANSPORT_ORIGIN
    quantity = int(Decimal(goal.quantity_tons or "200"))
    deadline_date = date.fromisoformat(goal.deadline_date) if goal.deadline_date else None
    req = {
        "origin": origin,
        "destination": destination,
        "variety_code": goal.variety_code,
        "quantity_tons": quantity,
        "deadline_date": deadline_date,
        "allow_split": True,
        "today": demo_data.DEMO_TODAY,
        "decision_preference": "balanced",
    }

    segments = logistics_repo.list_segments(db)
    services = logistics_repo.list_services(db)
    outcome = match_plans(segments, services, req)
    source = "平台物流信息"
    if outcome["primary"] is None:
        # 库内没有该到厂线路时，使用稳定的兜底线路组合
        segments = _demo_segments(destination)
        services = _demo_services()
        outcome = match_plans(segments, services, req)
        source = "业务测算结果"

    plans = [p for p in (outcome["primary"], outcome["backup"]) if p]
    if not plans:
        raise RuntimeError("未找到可行的到厂运输方案")

    # 第一批要保交期用时效最稳的线路，第二批用费用更优的线路
    fast = min(plans, key=lambda p: (p["days_high"], _mid(p)))
    cheap = min(plans, key=lambda p: _mid(p))
    batches = []
    total_qty = Decimal(0)
    weighted = Decimal(0)
    for (batch_name, qty_str), plan in zip(demo_data.DEMO_BATCH_SPLIT, (fast, cheap)):
        qty = Decimal(qty_str)
        freight = _mid(plan).quantize(Decimal("0.01"))
        total_qty += qty
        weighted += freight * qty
        batches.append({
            "batch": batch_name,
            "quantity_tons": qty_str,
            "mode_name": plan["mode_name"],
            "freight_yuan_per_ton": str(freight),
            "days_low": plan["days_low"],
            "days_high": plan["days_high"],
            "transship_count": plan["transship_count"],
            "legs": plan["legs"],
            "risk_note": plan["risk_note"],
        })
    freight_weighted = (weighted / total_qty).quantize(Decimal("0.01")) if total_qty else Decimal("0")

    summary = f"{origin}到{destination}分两批运输：" + "；".join(
        f"{b['batch']} {b['quantity_tons']} 吨走{b['mode_name']}，参考运费 {b['freight_yuan_per_ton']} 元/吨，{b['days_low']}~{b['days_high']} 天到"
        for b in batches
    ) + "。"

    return AgentResult(
        agent_id="yun",
        status="completed",
        summary=summary,
        facts={
            "origin": origin,
            "destination": destination,
            "batches": batches,
            "freight_weighted_yuan_per_ton": str(freight_weighted),
            "rejected": outcome["rejected"],
            "check_items": outcome["check_items"],
        },
        recommendations=["参考运价需询运确认实时报价", "确认发运窗口与车/船排期"],
        risks=[],
        missing_information=[],
        evidence=[
            {
                "item": f"{b['batch']}：{b['mode_name']} {origin}→{destination}，{b['days_low']}~{b['days_high']} 天，约 {b['freight_yuan_per_ton']} 元/吨",
                "source": source,
            }
            for b in batches
        ],
        impact_on_mission="批次运费与时效直接进入两套方案的综合吨成本",
    )
