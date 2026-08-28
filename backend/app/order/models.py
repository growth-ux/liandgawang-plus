from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MarketOrder(Base):
    """市场交易单：粮源采购单、物流订舱单、资金申请单，统一沉淀。"""

    __tablename__ = "market_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    # grain_purchase / transport_booking / finance_application
    order_type: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(128))
    subject_ref: Mapped[str] = mapped_column(String(128), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="submitted", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
