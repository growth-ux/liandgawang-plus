from app.zhanggui.adapters.base import AgentContext, run_agent


def test_selected_agents_return_structured_results(db_session, demo_goal):
    prior = {}
    for agent_id in ["zhan", "liang", "yun"]:
        result = run_agent(agent_id, db_session, AgentContext(1, demo_goal, prior))
        prior[agent_id] = result
        assert result.agent_id == agent_id
        assert result.status == "completed"
        assert result.summary
        assert result.evidence


def test_suan_and_an_create_cost_and_risk_opinions(db_session, demo_goal, base_agent_results):
    suan = run_agent("suan", db_session, AgentContext(1, demo_goal, base_agent_results))
    an = run_agent("an", db_session, AgentContext(1, demo_goal, base_agent_results | {"suan": suan}))
    assert suan.facts["recommended_scheme_id"] == "A"
    assert suan.facts["saving_total_yuan"] == "3600.00"
    assert an.status == "completed_with_objection"
    assert an.risks[0]["code"] == "supplier_delivery_evidence_missing"


def test_qian_standby_without_financing_gap(db_session, demo_goal, base_agent_results):
    qian = run_agent("qian", db_session, AgentContext(1, demo_goal, base_agent_results))
    assert qian.status == "completed"
    assert "待命" in qian.summary


def test_qian_matches_product_when_gap_exists(db_session, demo_goal, base_agent_results):
    goal = demo_goal.model_copy(update={"financing_gap_yuan": "800000"})
    qian = run_agent("qian", db_session, AgentContext(1, goal, base_agent_results))
    assert qian.status == "completed"
    assert qian.facts["product_code"]


def test_unknown_agent_raises_and_failure_degrades(db_session, demo_goal):
    import pytest

    with pytest.raises(ValueError):
        run_agent("unknown", db_session, AgentContext(1, demo_goal, {}))
    # suan 缺少上游结果时按结构化失败降级
    result = run_agent("suan", db_session, AgentContext(1, demo_goal, {}))
    assert result.status == "failed"
    assert result.available_actions[0]["action"] == "retry"
