from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SharedExperience(Base):
    __tablename__ = "shared_experiences"
    __table_args__ = (
        UniqueConstraint(
            "source_type", "source_record_id", "title", name="uq_experience_source_item"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_type: Mapped[str] = mapped_column(String(32), default="costing", index=True)  # costing/zhanggui
    source_record_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    knowledge_type: Mapped[str] = mapped_column(String(16), default="decision", index=True)
    title: Mapped[str] = mapped_column(String(128), default="企业经验")
    content: Mapped[str] = mapped_column(Text)
    applicable_context: Mapped[list] = mapped_column(JSON, default=list)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    source_agent: Mapped[str] = mapped_column(String(32), default="system", index=True)
    source_title: Mapped[str] = mapped_column(String(128), default="")
    origin: Mapped[str] = mapped_column(String(16), default="ai")
    evidence_count: Mapped[int] = mapped_column(Integer, default=1)
    supporting_sources: Mapped[list] = mapped_column(JSON, default=list)
    memory_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    memory_sync_status: Mapped[str] = mapped_column(String(16), default="pending")
    status: Mapped[str] = mapped_column(String(16), index=True, default="active")  # active/ignored
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class KnowledgeCitation(Base):
    __tablename__ = "knowledge_citations"
    __table_args__ = (
        UniqueConstraint(
            "knowledge_id",
            "agent_key",
            "task_type",
            "task_id",
            name="uq_knowledge_citation_task",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    knowledge_id: Mapped[int] = mapped_column(Integer, index=True)
    agent_key: Mapped[str] = mapped_column(String(32), index=True)
    task_type: Mapped[str] = mapped_column(String(32))
    task_id: Mapped[int] = mapped_column(Integer, index=True)
    effect: Mapped[str] = mapped_column(Text, default="")
    accepted: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
