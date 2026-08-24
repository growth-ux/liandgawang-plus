from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AgentHandoff(Base):
    __tablename__ = "agent_handoffs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    handoff_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    source_agent: Mapped[str] = mapped_column(String(16), index=True)
    target_agent: Mapped[str] = mapped_column(String(16), index=True)
    source_ref: Mapped[str] = mapped_column(String(128), default="")
    title: Mapped[str] = mapped_column(String(128))
    summary: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)  # pending/accepted/ignored
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
