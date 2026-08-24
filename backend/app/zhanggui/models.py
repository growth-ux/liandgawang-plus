"""粮掌柜持久化模型：采购任务、小二办理记录、人工决策、行动任务。"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProcurementMission(Base):
    __tablename__ = "procurement_missions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mission_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(128), default="复杂采购任务")
    raw_request: Mapped[str] = mapped_column(Text)
    goal_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    memory_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    team_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    conflict_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    recommendation_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    phase: Mapped[str] = mapped_column(String(32), default="goal_confirmation")
    status: Mapped[str] = mapped_column(String(32), default="awaiting_goal_confirmation")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    agent_runs: Mapped[list["MissionAgentRun"]] = relationship(order_by="MissionAgentRun.id")
    decisions: Mapped[list["MissionDecision"]] = relationship(order_by="MissionDecision.id")
    action_tasks: Mapped[list["MissionActionTask"]] = relationship(order_by="MissionActionTask.id")


class MissionAgentRun(Base):
    __tablename__ = "mission_agent_runs"
    __table_args__ = (UniqueConstraint("mission_id", "agent_id", name="uq_mission_agent_run"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mission_id: Mapped[int] = mapped_column(Integer, ForeignKey("procurement_missions.id"), index=True)
    agent_id: Mapped[str] = mapped_column(String(16))
    participation_reason: Mapped[str] = mapped_column(String(256), default="")
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending/running/completed/completed_with_objection/failed
    input_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    output_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class MissionDecision(Base):
    __tablename__ = "mission_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mission_id: Mapped[int] = mapped_column(Integer, ForeignKey("procurement_missions.id"), index=True)
    gate_type: Mapped[str] = mapped_column(String(32))  # goal/team/plan
    prompt: Mapped[str] = mapped_column(Text)
    options: Mapped[list] = mapped_column(JSON, default=list)
    ai_recommendation: Mapped[str] = mapped_column(Text, default="")
    selected_action: Mapped[str | None] = mapped_column(String(32), nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending/confirmed
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class MissionActionTask(Base):
    __tablename__ = "mission_action_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mission_id: Mapped[int] = mapped_column(Integer, ForeignKey("procurement_missions.id"), index=True)
    action_code: Mapped[str] = mapped_column(String(32))
    agent_id: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(128))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="ready")  # ready/waiting_prerequisite/completed/cancelled
    scheme_id: Mapped[str | None] = mapped_column(String(8), nullable=True)
    prerequisite_action_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
