from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SharedExperience(Base):
    __tablename__ = "shared_experiences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_record_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    content: Mapped[str] = mapped_column(Text)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), index=True, default="active")  # active/ignored
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
