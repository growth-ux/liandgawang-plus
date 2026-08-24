from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CostingRecord(Base):
    __tablename__ = "costing_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    record_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(16), index=True)  # pending/calculated/completed
    source_text: Mapped[str] = mapped_column(Text, default="")
    schemes_snapshot: Mapped[list] = mapped_column(JSON)
    calculation_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    selected_scheme_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    profit_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ai_explanation: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
