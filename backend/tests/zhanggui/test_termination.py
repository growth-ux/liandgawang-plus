import pytest

from app.zhanggui import repository
from app.zhanggui.service import MissionStateError, cancel_action_task, create_mission_from_preview, terminate_mission


DEMO_GOAL = {
    "variety_code": "corn",
    "variety_name": "玉米",
    "grade": "二等",
    "quantity_tons": "200",
    "deadline_date": "2026-09-08",
    "destination": "潍坊",
    "budget_yuan_per_ton": "2500",
    "priority": "supply",
    "hard_constraints": ["不能影响生产连续性"],
}


def test_terminate_mission_keeps_record_and_closes_pending_decision(db_session):
    created = create_mission_from_preview(db_session, "采购玉米", DEMO_GOAL, [])
    decision = repository.create_decision(
        db_session, created["id"], "plan", "请确认方案", [{"action": "verify_a", "label": "确认"}], "建议确认",
    )

    snapshot = terminate_mission(db_session, created["id"], "计划调整")

    assert snapshot["status"] == "terminated"
    closed = next(item for item in snapshot["decisions"] if item["id"] == decision.id)
    assert closed["status"] == "cancelled"
    assert closed["note"] == "计划调整"
    with pytest.raises(MissionStateError, match="已结束"):
        terminate_mission(db_session, created["id"])


def test_cancel_action_task_only_changes_the_target_task(db_session):
    created = create_mission_from_preview(db_session, "采购玉米", DEMO_GOAL, [])
    tasks = repository.create_action_tasks(db_session, created["id"], [
        {"action_code": "ACT-A", "agent_id": "liang", "title": "询价", "status": "ready"},
        {"action_code": "ACT-B", "agent_id": "yun", "title": "运输", "status": "waiting_prerequisite"},
    ])

    snapshot = cancel_action_task(db_session, created["id"], tasks[0].id)
    states = {task["id"]: task["status"] for task in snapshot["action_tasks"]}

    assert states[tasks[0].id] == "cancelled"
    assert states[tasks[1].id] == "waiting_prerequisite"
