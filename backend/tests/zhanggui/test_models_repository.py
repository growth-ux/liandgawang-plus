from app.zhanggui import repository


def test_mission_snapshot_contains_runs_decisions_and_actions(db_session):
    mission = repository.create_mission(
        db_session,
        raw_request="未来15天采购200吨玉米",
        goal={"variety_name": "玉米", "quantity_tons": "200"},
    )
    repository.upsert_agent_run(
        db_session, mission.id, "liang",
        participation_reason="需要寻找粮源",
        status="completed",
        input_snapshot={"quantity_tons": "200"},
        output_snapshot={"summary": "找到3个候选"},
    )
    decision = repository.create_decision(
        db_session, mission.id, "goal", "请确认目标",
        [{"action": "confirm", "label": "确认"}], "建议确认",
    )
    repository.confirm_decision(db_session, decision, "confirm", "")
    repository.create_action_tasks(db_session, mission.id, [{
        "action_code": "ACT-VERIFY-A", "agent_id": "an", "title": "核验A履约担保",
        "payload": {"supplier_code": "SUP-A"}, "status": "ready",
    }])

    snapshot = repository.get_mission_snapshot(db_session, mission.id)
    assert snapshot["status"] == "awaiting_goal_confirmation"
    assert snapshot["agent_runs"][0]["agent_id"] == "liang"
    assert snapshot["decisions"][0]["selected_action"] == "confirm"
    assert snapshot["action_tasks"][0]["status"] == "ready"


def test_upsert_agent_run_updates_existing_row(db_session):
    mission = repository.create_mission(db_session, raw_request="补库", goal={})
    repository.upsert_agent_run(db_session, mission.id, "zhan", status="running")
    repository.upsert_agent_run(db_session, mission.id, "zhan", status="completed", output_snapshot={"summary": "偏强"})
    snapshot = repository.get_mission_snapshot(db_session, mission.id)
    runs = snapshot["agent_runs"]
    assert len(runs) == 1
    assert runs[0]["status"] == "completed"
    assert runs[0]["output_snapshot"] == {"summary": "偏强"}


def test_set_mission_state_updates_snapshots(db_session):
    mission = repository.create_mission(db_session, raw_request="补库", goal={})
    repository.set_mission_state(
        db_session, mission,
        phase="team_confirmation",
        status="awaiting_team_confirmation",
        team=[{"agent_id": "liang", "selected": True}],
    )
    snapshot = repository.get_mission_snapshot(db_session, mission.id)
    assert snapshot["phase"] == "team_confirmation"
    assert snapshot["status"] == "awaiting_team_confirmation"
    assert snapshot["team"][0]["agent_id"] == "liang"
