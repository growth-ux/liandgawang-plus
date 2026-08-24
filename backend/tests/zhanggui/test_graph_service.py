import pytest

from app.zhanggui import repository
from app.zhanggui.service import (
    MissionStateError,
    confirm_goal,
    confirm_team,
    create_mission_from_preview,
    run_until_gate,
    submit_decision,
)

DEMO_REQUEST = "未来15天采购200吨二等玉米到潍坊，不能影响生产"
DEMO_GOAL = {
    "variety_code": "corn",
    "variety_name": "玉米",
    "grade": "二等",
    "quantity_tons": "200",
    "deadline_date": "2026-09-08",
    "destination": "潍坊",
    "budget_yuan_per_ton": "2500",
    "priority": "supply",
    "hard_constraints": ["不能影响生产连续性", "质量不低于二等"],
}


@pytest.fixture(autouse=True)
def stub_knowledge_dependencies(monkeypatch):
    monkeypatch.setattr("app.knowledge.extractor._extract_with_llm", lambda *args: [])
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: None)


@pytest.fixture()
def created_mission(db_session):
    snapshot = create_mission_from_preview(db_session, DEMO_REQUEST, DEMO_GOAL, [])
    return repository.get_mission(db_session, snapshot["id"])


@pytest.fixture()
def confirmed_goal_mission(db_session, created_mission):
    confirm_goal(db_session, created_mission.id, DEMO_GOAL)
    return repository.get_mission(db_session, created_mission.id)


@pytest.fixture()
def decision_mission(db_session, confirmed_goal_mission):
    confirm_team(db_session, confirmed_goal_mission.id, confirmed_goal_mission.team_snapshot)
    run_until_gate(db_session, confirmed_goal_mission.id, lambda event: None)
    return repository.get_mission(db_session, confirmed_goal_mission.id)


def test_service_cannot_run_before_team_confirmation(db_session, created_mission):
    confirm_goal(db_session, created_mission.id, DEMO_GOAL)
    with pytest.raises(MissionStateError, match="请先确认协作团队"):
        run_until_gate(db_session, created_mission.id, lambda event: None)


def test_cannot_confirm_goal_twice(db_session, confirmed_goal_mission):
    with pytest.raises(MissionStateError):
        confirm_goal(db_session, confirmed_goal_mission.id, DEMO_GOAL)


def test_confirm_team_runs_agents_and_stops_at_decision(db_session, confirmed_goal_mission):
    confirm_team(db_session, confirmed_goal_mission.id, confirmed_goal_mission.team_snapshot)
    events = []
    snapshot = run_until_gate(db_session, confirmed_goal_mission.id, events.append)
    assert snapshot["status"] == "awaiting_decision"
    assert {e["type"] for e in events} >= {"agent_started", "agent_completed", "conflict_found", "decision_required"}
    assert snapshot["recommendation"]["primary_scheme_id"] == "A"
    # 五个小二参与，钱小二待命
    completed = {run["agent_id"] for run in snapshot["agent_runs"] if run["status"] in ("completed", "completed_with_objection")}
    assert completed == {"zhan", "liang", "yun", "suan", "an"}


def test_resume_does_not_rerun_completed_agents(db_session, decision_mission):
    events = []
    snapshot = run_until_gate(db_session, decision_mission.id, events.append)
    assert snapshot["status"] == "awaiting_decision"
    assert not any(e["type"] == "agent_started" for e in events)


def test_confirm_verify_action_creates_blocked_followups(db_session, decision_mission):
    decision = next(d for d in decision_mission.decisions if d.status == "pending")
    snapshot = submit_decision(db_session, decision_mission.id, decision.id, "verify_a", "")
    tasks = {item["action_code"]: item for item in snapshot["action_tasks"]}
    assert tasks["ACT-VERIFY-A"]["status"] == "ready"
    assert tasks["ACT-INQUIRY-A"]["status"] == "waiting_prerequisite"
    assert tasks["ACT-TRANSPORT-A"]["status"] == "waiting_prerequisite"
    assert tasks["ACT-INQUIRY-A"]["prerequisite_action_id"] == tasks["ACT-VERIFY-A"]["id"]
    assert snapshot["status"] == "completed"


def test_choose_b_creates_ready_tasks_without_a_actions(db_session, decision_mission):
    decision = next(d for d in decision_mission.decisions if d.status == "pending")
    snapshot = submit_decision(db_session, decision_mission.id, decision.id, "choose_b", "")
    codes = {item["action_code"]: item["status"] for item in snapshot["action_tasks"]}
    assert "ACT-INQUIRY-A" not in codes
    assert codes["ACT-INQUIRY-B"] == "ready"
    assert codes["ACT-TRANSPORT-B"] == "ready"


def test_submit_decision_requires_pending_gate(db_session, decision_mission):
    decision = next(d for d in decision_mission.decisions if d.status == "pending")
    submit_decision(db_session, decision_mission.id, decision.id, "verify_a", "")
    with pytest.raises(MissionStateError):
        submit_decision(db_session, decision_mission.id, decision.id, "verify_a", "")


def test_confirmed_mission_creates_source_scoped_experience(db_session, decision_mission):
    from app.knowledge import repository as knowledge_repo

    decision = next(d for d in decision_mission.decisions if d.status == "pending")
    submit_decision(db_session, decision_mission.id, decision.id, "verify_a", "")
    items = knowledge_repo.list_experiences(db_session)
    experience = next(item for item in items if item["source_type"] == "zhanggui")
    assert experience["source_record_id"] == decision_mission.id
    assert experience["knowledge_type"] == "decision"
    assert experience["source_agent"] == "zhanggui"
    assert experience["title"]
    assert "玉米采购" in experience["applicable_context"]
    # 同一任务只沉淀一条（来源类型 + 任务 ID 去重）
    zhanggui_items = [item for item in items if item["source_type"] == "zhanggui"]
    assert len(zhanggui_items) == 1
