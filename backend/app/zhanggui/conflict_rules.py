"""五类跨专业冲突的确定性检测：只识别、不调和，最终由用户确认。"""

from datetime import date

from app.zhanggui import demo_data
from app.zhanggui.schemas import AgentResult, MissionConflict, MissionGoal

# 市场建议等待时，库存缓冲必须比剩余窗口多出的安全天数
_STOCK_SAFETY_DAYS = 7
# 融资审批需要预留的采购执行天数
_FINANCE_BUFFER_DAYS = 5
# 质量更优候选的到厂成本偏高阈值（元/吨）
_QUALITY_COST_GAP = 40


def _days_left(goal: MissionGoal) -> int | None:
    if not goal.deadline_date:
        return None
    return (date.fromisoformat(goal.deadline_date) - demo_data.DEMO_TODAY).days


def _add(conflicts: list[MissionConflict], seen: set, conflict: MissionConflict) -> None:
    """同一 kind + scheme_id 只生成一条。"""
    key = (conflict.kind, conflict.scheme_id)
    if key in seen:
        return
    seen.add(key)
    conflicts.append(conflict)


def _detect_cost_vs_risk(goal, results, conflicts, seen) -> None:
    suan, an = results.get("suan"), results.get("an")
    if not suan or suan.status == "failed" or not an:
        return
    recommended = suan.facts.get("recommended_scheme_id")
    if not recommended:
        return
    for risk in an.risks:
        if risk.get("scheme_id") != recommended:
            continue
        _add(conflicts, seen, MissionConflict(
            kind="cost_vs_risk",
            scheme_id=recommended,
            agent_ids=["suan", "an"],
            title=f"方案 {recommended} 成本最低，但履约风险更高",
            detail=(
                f"算小二推荐综合成本最低的方案 {recommended}，"
                f"安小二对 {risk.get('supplier_name', '该供应方')} 提出履约证据不足的异议。"
            ),
            evidence=[risk.get("detail", "")],
            severity="high",
        ))


def _detect_price_vs_deadline(goal, results, conflicts, seen) -> None:
    suan, liang = results.get("suan"), results.get("liang")
    if not suan or suan.status == "failed" or not goal.deadline_date:
        return
    ship_dates: dict[str, str] = dict(suan.facts.get("latest_ship_dates") or {})
    if liang and liang.status != "failed":
        for candidate in liang.facts.get("candidates", []):
            scheme_id = candidate.get("scheme_id")
            if scheme_id and candidate.get("latest_ship_at") and scheme_id not in ship_dates:
                ship_dates[scheme_id] = candidate["latest_ship_at"]
    recommended = suan.facts.get("recommended_scheme_id")
    for scheme_id in (recommended, *ship_dates.keys()):
        ship_at = ship_dates.get(scheme_id or "")
        if scheme_id and ship_at and ship_at > goal.deadline_date:
            _add(conflicts, seen, MissionConflict(
                kind="price_vs_deadline",
                scheme_id=scheme_id,
                agent_ids=["suan", "liang"],
                title=f"方案 {scheme_id} 价格更优，但交期可能不满足",
                detail=f"方案 {scheme_id} 的最晚发运 {ship_at} 晚于最晚到货 {goal.deadline_date}。",
                evidence=[f"最晚发运：{ship_at}", f"最晚到货：{goal.deadline_date}"],
                severity="high",
            ))


def _detect_market_wait_vs_stock(goal, results, conflicts, seen) -> None:
    zhan = results.get("zhan")
    if not zhan or zhan.status == "failed":
        return
    if zhan.facts.get("action") != "wait" or goal.stock_days is None:
        return
    days_left = _days_left(goal)
    if days_left is None:
        return
    if goal.stock_days < days_left - _STOCK_SAFETY_DAYS:
        _add(conflicts, seen, MissionConflict(
            kind="market_wait_vs_stock",
            scheme_id=None,
            agent_ids=["zhan"],
            title="行情建议等待，但库存缓冲偏紧",
            detail=(
                f"瞻小二建议暂缓观望，但现有库存仅可支撑 {goal.stock_days} 天，"
                f"距离最晚到货还有 {days_left} 天，等待空间有限。"
            ),
            evidence=[f"库存可用 {goal.stock_days} 天", f"剩余采购窗口 {days_left} 天"],
            severity="medium",
        ))


def _detect_finance_cycle_vs_deadline(goal, results, conflicts, seen) -> None:
    qian = results.get("qian")
    if not qian or qian.status == "failed":
        return
    approval_days = qian.facts.get("approval_days")
    days_left = _days_left(goal)
    if approval_days is None or days_left is None:
        return
    if approval_days > days_left - _FINANCE_BUFFER_DAYS:
        _add(conflicts, seen, MissionConflict(
            kind="finance_cycle_vs_deadline",
            scheme_id=None,
            agent_ids=["qian"],
            title="资金审批周期可能超过采购窗口",
            detail=(
                f"主推资金产品预计审批 {approval_days} 天，而采购窗口仅剩 {days_left} 天，"
                "放款节奏可能影响付款安排。"
            ),
            evidence=[f"预计审批 {approval_days} 天", f"剩余采购窗口 {days_left} 天"],
            severity="medium",
        ))


def _detect_quality_vs_delivered_cost(goal, results, conflicts, seen) -> None:
    liang = results.get("liang")
    if not liang or liang.status == "failed":
        return
    candidates = liang.facts.get("candidates", [])
    if len(candidates) < 2:
        return
    primary, backup = candidates[0], candidates[1]
    try:
        gap = float(primary.get("delivered_price") or 0) - float(backup.get("delivered_price") or 0)
    except (TypeError, ValueError):
        return
    if gap >= _QUALITY_COST_GAP:
        _add(conflicts, seen, MissionConflict(
            kind="quality_vs_delivered_cost",
            scheme_id=primary.get("scheme_id"),
            agent_ids=["liang", "suan"],
            title="质量更优的粮源到厂成本明显偏高",
            detail=(
                f"{primary.get('supplier_name', '主推粮源')}质量更优，但到厂成本比 "
                f"{backup.get('supplier_name', '备选粮源')} 高约 {gap:.0f} 元/吨。"
            ),
            evidence=[
                f"主推到厂成本 {primary.get('delivered_price')} 元/吨",
                f"备选到厂成本 {backup.get('delivered_price')} 元/吨",
            ],
            severity="medium",
        ))


def detect_conflicts(goal: MissionGoal, results: dict[str, AgentResult]) -> list[MissionConflict]:
    conflicts: list[MissionConflict] = []
    seen: set = set()
    _detect_cost_vs_risk(goal, results, conflicts, seen)
    _detect_price_vs_deadline(goal, results, conflicts, seen)
    _detect_market_wait_vs_stock(goal, results, conflicts, seen)
    _detect_finance_cycle_vs_deadline(goal, results, conflicts, seen)
    _detect_quality_vs_delivered_cost(goal, results, conflicts, seen)
    return conflicts
