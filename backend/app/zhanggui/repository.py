"""粮掌柜领域唯一持久化入口：任务、办理记录、决策与行动任务。"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.zhanggui.models import MissionActionTask, MissionAgentRun, MissionDecision, ProcurementMission

# set_mission_state 的快照关键字到模型字段的映射
_SNAPSHOT_FIELDS = {
    "goal": "goal_snapshot",
    "memory": "memory_snapshot",
    "team": "team_snapshot",
    "conflicts": "conflict_snapshot",
    "recommendation": "recommendation_snapshot",
}


def _next_mission_code(db: Session) -> str:
    """任务编号：ZG + 日期 + 当日 3 位序号。"""
    prefix = f"ZG{datetime.now().strftime('%Y%m%d')}-"
    count = (
        db.query(ProcurementMission)
        .filter(ProcurementMission.mission_code.like(f"{prefix}%"))
        .count()
    )
    return f"{prefix}{count + 1:03d}"


def create_mission(
    db: Session,
    *,
    raw_request: str,
    goal: dict,
    title: str | None = None,
    memory_references: list | None = None,
) -> ProcurementMission:
    mission = ProcurementMission(
        mission_code=_next_mission_code(db),
        title=title or _default_title(goal),
        raw_request=raw_request,
        goal_snapshot=goal or {},
        memory_snapshot=memory_references or [],
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)
    return mission


def _default_title(goal: dict) -> str:
    parts = []
    if goal.get("deadline_date"):
        parts.append(f"{goal['deadline_date']} 前")
    if goal.get("quantity_tons"):
        parts.append(f"采购 {goal['quantity_tons']} 吨")
    parts.append(goal.get("variety_name") or "粮食")
    if goal.get("destination"):
        parts.append(f"到{goal['destination']}")
    return "".join(parts) if parts else "复杂采购任务"


def get_mission(db: Session, mission_id: int) -> ProcurementMission | None:
    return db.get(ProcurementMission, mission_id)


def list_missions(db: Session) -> list[dict]:
    """历史任务列表：只返回指挥舱需要的摘要字段。"""
    rows = db.query(ProcurementMission).order_by(ProcurementMission.id.desc()).all()
    result = []
    for mission in rows:
        pending = (
            db.query(MissionDecision)
            .filter(MissionDecision.mission_id == mission.id, MissionDecision.status == "pending")
            .count()
        )
        recommendation = mission.recommendation_snapshot or {}
        result.append({
            "id": mission.id,
            "mission_code": mission.mission_code,
            "title": mission.title,
            "raw_request": mission.raw_request,
            "phase": mission.phase,
            "status": mission.status,
            "primary_scheme_id": recommendation.get("primary_scheme_id"),
            "pending_decision_count": pending,
            "created_at": mission.created_at.isoformat() if mission.created_at else None,
            "updated_at": mission.updated_at.isoformat() if mission.updated_at else None,
        })
    return result


def set_mission_state(db: Session, mission: ProcurementMission, *, phase: str | None = None, status: str | None = None, **snapshots) -> ProcurementMission:
    """更新阶段、状态和各类快照；快照关键字见 _SNAPSHOT_FIELDS。"""
    if phase is not None:
        mission.phase = phase
    if status is not None:
        mission.status = status
    for key, value in snapshots.items():
        column = _SNAPSHOT_FIELDS.get(key)
        if column is None:
            raise ValueError(f"未知快照字段：{key}")
        setattr(mission, column, value)
    db.commit()
    db.refresh(mission)
    return mission


def upsert_agent_run(db: Session, mission_id: int, agent_id: str, **fields) -> MissionAgentRun:
    """同一任务同一小二只保留一条办理记录，重复调用更新字段。"""
    run = (
        db.query(MissionAgentRun)
        .filter(MissionAgentRun.mission_id == mission_id, MissionAgentRun.agent_id == agent_id)
        .first()
    )
    if run is None:
        run = MissionAgentRun(mission_id=mission_id, agent_id=agent_id)
        db.add(run)
    for key, value in fields.items():
        setattr(run, key, value)
    db.commit()
    db.refresh(run)
    return run


def create_decision(
    db: Session,
    mission_id: int,
    gate_type: str,
    prompt: str,
    options: list,
    recommendation: str,
) -> MissionDecision:
    decision = MissionDecision(
        mission_id=mission_id,
        gate_type=gate_type,
        prompt=prompt,
        options=options or [],
        ai_recommendation=recommendation or "",
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision


def get_decision(db: Session, decision_id: int) -> MissionDecision | None:
    return db.get(MissionDecision, decision_id)


def confirm_decision(db: Session, decision: MissionDecision, selected_action: str, note: str) -> MissionDecision:
    decision.selected_action = selected_action
    decision.note = note or ""
    decision.status = "confirmed"
    decision.decided_at = datetime.now()
    db.commit()
    db.refresh(decision)
    return decision


def cancel_pending_decisions(db: Session, mission_id: int, reason: str) -> None:
    """任务被终止时关闭仍待处理的人工闸门，避免历史记录显示为待确认。"""
    decisions = (
        db.query(MissionDecision)
        .filter(MissionDecision.mission_id == mission_id, MissionDecision.status == "pending")
        .all()
    )
    for decision in decisions:
        decision.selected_action = "terminate"
        decision.note = reason
        decision.status = "cancelled"
        decision.decided_at = datetime.now()
    db.commit()


def get_action_task(db: Session, task_id: int) -> MissionActionTask | None:
    return db.get(MissionActionTask, task_id)


def create_action_tasks(db: Session, mission_id: int, actions: list[dict]) -> list[MissionActionTask]:
    tasks = []
    for item in actions:
        task = MissionActionTask(
            mission_id=mission_id,
            action_code=item["action_code"],
            agent_id=item["agent_id"],
            title=item["title"],
            payload=item.get("payload") or {},
            status=item.get("status") or "ready",
            scheme_id=item.get("scheme_id"),
            prerequisite_action_id=item.get("prerequisite_action_id"),
        )
        db.add(task)
        tasks.append(task)
    db.commit()
    for task in tasks:
        db.refresh(task)
    return tasks


def set_action_task_status(db: Session, task: MissionActionTask, status: str) -> MissionActionTask:
    task.status = status
    db.commit()
    db.refresh(task)
    return task


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _run_dict(run: MissionAgentRun) -> dict:
    return {
        "agent_id": run.agent_id,
        "participation_reason": run.participation_reason,
        "status": run.status,
        "input_snapshot": run.input_snapshot or {},
        "output_snapshot": run.output_snapshot,
        "error_message": run.error_message,
        "started_at": _iso(run.started_at),
        "finished_at": _iso(run.finished_at),
    }


def _decision_dict(decision: MissionDecision) -> dict:
    return {
        "id": decision.id,
        "gate_type": decision.gate_type,
        "prompt": decision.prompt,
        "options": decision.options or [],
        "ai_recommendation": decision.ai_recommendation,
        "selected_action": decision.selected_action,
        "note": decision.note,
        "status": decision.status,
        "decided_at": _iso(decision.decided_at),
    }


def _action_dict(task: MissionActionTask) -> dict:
    return {
        "id": task.id,
        "action_code": task.action_code,
        "agent_id": task.agent_id,
        "title": task.title,
        "payload": task.payload or {},
        "status": task.status,
        "scheme_id": task.scheme_id,
        "prerequisite_action_id": task.prerequisite_action_id,
    }


def get_mission_snapshot(db: Session, mission_id: int) -> dict | None:
    """返回指挥舱使用的完整任务快照；不存在返回 None。"""
    mission = db.get(ProcurementMission, mission_id)
    if mission is None:
        return None
    runs = (
        db.query(MissionAgentRun)
        .filter(MissionAgentRun.mission_id == mission_id)
        .order_by(MissionAgentRun.id)
        .all()
    )
    decisions = (
        db.query(MissionDecision)
        .filter(MissionDecision.mission_id == mission_id)
        .order_by(MissionDecision.id)
        .all()
    )
    tasks = (
        db.query(MissionActionTask)
        .filter(MissionActionTask.mission_id == mission_id)
        .order_by(MissionActionTask.id)
        .all()
    )
    return {
        "id": mission.id,
        "mission_code": mission.mission_code,
        "title": mission.title,
        "raw_request": mission.raw_request,
        "goal": mission.goal_snapshot or {},
        "memory_references": mission.memory_snapshot or [],
        "team": mission.team_snapshot or [],
        "conflicts": mission.conflict_snapshot or [],
        "recommendation": mission.recommendation_snapshot,
        "phase": mission.phase,
        "status": mission.status,
        "created_at": _iso(mission.created_at),
        "updated_at": _iso(mission.updated_at),
        "agent_runs": [_run_dict(run) for run in runs],
        "decisions": [_decision_dict(d) for d in decisions],
        "action_tasks": [_action_dict(t) for t in tasks],
    }
