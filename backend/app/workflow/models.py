from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WatchCondition(Base):
    """行情关注条件：用户针对某库点设置的价格或涨跌阈值关注。"""

    __tablename__ = "watch_conditions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    watch_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    variety_code: Mapped[str] = mapped_column(String(32), index=True)
    variety_name: Mapped[str] = mapped_column(String(32))
    spot_code: Mapped[str] = mapped_column(String(64), index=True)
    region_name: Mapped[str] = mapped_column(String(64))
    quote_type: Mapped[str] = mapped_column(String(16))
    watch_type: Mapped[str] = mapped_column(String(32))
    threshold: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(16), default="monitoring")
    current_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    triggered_reason: Mapped[str] = mapped_column(Text, default="")
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    data_kind: Mapped[str] = mapped_column(String(16), default="user_input")
    mock_dataset_version: Mapped[str] = mapped_column(String(32), default="zhan-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
