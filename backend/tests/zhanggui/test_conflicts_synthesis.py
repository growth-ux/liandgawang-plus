from datetime import date

from app.zhanggui.conflict_rules import detect_conflicts
from app.zhanggui.schemas import AgentResult
from app.zhanggui.synthesizer import build_recommendation


def test_cost_risk_conflict_becomes_conditional_recommendation(demo_goal, all_agent_results):
    conflicts = detect_conflicts(demo_goal, all_agent_results)
    conflict = next(item for item in conflicts if item.kind == "cost_vs_risk")
    assert set(conflict.agent_ids) == {"suan", "an"}
    assert conflict.requires_human is True

    recommendation = build_recommendation(demo_goal, all_agent_results, conflicts)
    assert recommendation.primary_scheme_id == "A"
    assert recommendation.backup_scheme_id == "B"
    assert "履约担保" in recommendation.condition
    assert recommendation.fallback_trigger == "今日无法完成核验或核验不通过"


def test_recommendation_contains_four_action_drafts(demo_goal, all_agent_results):
    conflicts = detect_conflicts(demo_goal, all_agent_results)
    recommendation = build_recommendation(demo_goal, all_agent_results, conflicts)
    codes = [action.action_code for action in recommendation.next_actions]
    assert codes == ["ACT-VERIFY-A", "ACT-INQUIRY-A", "ACT-BACKUP-B", "ACT-TRANSPORT-A"]
    verify, *followups = recommendation.next_actions
    assert verify.requires_prerequisite is False
    assert all(action.requires_prerequisite for action in followups)


def test_price_vs_deadline_conflict_detected(demo_goal, all_agent_results):
    suan = all_agent_results["suan"]
    facts = dict(suan.facts)
    facts["latest_ship_dates"] = {"A": "2026-09-10"}  # 晚于 2026-09-08 最晚到货
    results = dict(all_agent_results)
    results["suan"] = suan.model_copy(update={"facts": facts})
    conflicts = detect_conflicts(demo_goal, results)
    kinds = [c.kind for c in conflicts]
    assert "price_vs_deadline" in kinds
    # 同一 kind + scheme 只保留一条
    assert kinds.count("price_vs_deadline") == 1


def test_market_wait_vs_stock_conflict_detected(demo_goal, all_agent_results):
    goal = demo_goal.model_copy(update={"stock_days": 5})
    zhan = all_agent_results["zhan"]
    facts = dict(zhan.facts)
    facts["action"] = "wait"
    results = dict(all_agent_results)
    results["zhan"] = zhan.model_copy(update={"facts": facts})
    conflicts = detect_conflicts(goal, results)
    assert any(c.kind == "market_wait_vs_stock" for c in conflicts)


def test_finance_cycle_vs_deadline_conflict_detected(demo_goal, all_agent_results):
    qian = AgentResult(
        agent_id="qian",
        status="completed",
        summary="主推粮采周转贷",
        facts={"product_code": "QIAN-V1-PW-01", "approval_days": 20, "estimated_cost_yuan": "5120"},
    )
    results = dict(all_agent_results)
    results["qian"] = qian
    conflicts = detect_conflicts(demo_goal, results)
    assert any(c.kind == "finance_cycle_vs_deadline" for c in conflicts)


def test_quality_vs_delivered_cost_conflict_detected(demo_goal, all_agent_results):
    liang = all_agent_results["liang"]
    candidates = [dict(c) for c in liang.facts["candidates"]]
    # 质量更优的主推到厂成本明显偏高
    candidates[0]["delivered_price"] = "2560.00"
    candidates[1]["delivered_price"] = "2470.00"
    facts = dict(liang.facts)
    facts["candidates"] = candidates
    results = dict(all_agent_results)
    results["liang"] = liang.model_copy(update={"facts": facts})
    conflicts = detect_conflicts(demo_goal, results)
    assert any(c.kind == "quality_vs_delivered_cost" for c in conflicts)


def test_no_conflict_recommendation_has_no_condition(demo_goal, all_agent_results):
    an = all_agent_results["an"]
    results = dict(all_agent_results)
    # 移除风险异议后不再有冲突
    results["an"] = an.model_copy(update={
        "status": "completed",
        "risks": [],
        "summary": "候选供应方履约证据完整",
    })
    conflicts = detect_conflicts(demo_goal, results)
    assert not any(c.kind == "cost_vs_risk" for c in conflicts)
    recommendation = build_recommendation(demo_goal, results, conflicts)
    assert recommendation.condition is None
    assert recommendation.fallback_trigger is None
