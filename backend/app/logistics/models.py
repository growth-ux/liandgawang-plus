from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RouteSegment(Base):
    """物流线路段：起终点间单一运输方式的参考运价与时效区间。"""

    __tablename__ = "logistics_route_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    segment_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    origin: Mapped[str] = mapped_column(String(64), index=True)
    destination: Mapped[str] = mapped_column(String(64), index=True)
    mode: Mapped[str] = mapped_column(String(16))  # road / rail / water
    distance_km: Mapped[int] = mapped_column(Integer)
    price_low: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_high: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    days_low: Mapped[int] = mapped_column(Integer)
    days_high: Mapped[int] = mapped_column(Integer)
    risk_note: Mapped[str] = mapped_column(String(256), default="")
    data_updated_at: Mapped[str] = mapped_column(String(32), default="2026-08-22")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class LogisticsService(Base):
    """物流服务：某线路段上的承运能力（品种适配、吨位、发运窗口）。"""

    __tablename__ = "logistics_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    carrier: Mapped[str] = mapped_column(String(128))
    segment_code: Mapped[str] = mapped_column(String(64), index=True)
    varieties: Mapped[str] = mapped_column(String(128))  # 逗号分隔品种 code
    tonnage_min: Mapped[int] = mapped_column(Integer)
    tonnage_max: Mapped[int] = mapped_column(Integer)
    dispatch_window: Mapped[str] = mapped_column(String(64), default="")
    loading_note: Mapped[str] = mapped_column(String(128), default="")
    performance_note: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class TransportTask(Base):
    """运输任务：正式运输需求从创建到询运结束的全过程。"""

    __tablename__ = "logistics_transport_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    origin: Mapped[str] = mapped_column(String(64))
    destination: Mapped[str] = mapped_column(String(64))
    variety_code: Mapped[str] = mapped_column(String(32))
    variety_name: Mapped[str] = mapped_column(String(32))
    quantity_tons: Mapped[int] = mapped_column(Integer)
    deadline_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    allow_split: Mapped[int] = mapped_column(Integer, default=1)  # 1 允许分批
    source_type: Mapped[str] = mapped_column(String(16), default="self")  # self/handover
    source_ref: Mapped[str] = mapped_column(String(64), default="")
    extra_note: Mapped[str] = mapped_column(Text, default="")
    decision_preference: Mapped[str] = mapped_column(String(16), default="balanced")
    memory_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    memory_effect: Mapped[str] = mapped_column(Text, default="")
    memory_accepted: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(24), default="working")
    blocked_note: Mapped[str] = mapped_column(String(256), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class TransportPlan(Base):
    """运输方案：主推 / 备选 / 未入选，含路线段组合与推荐或淘汰原因。"""

    __tablename__ = "logistics_transport_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(Integer, index=True)
    plan_type: Mapped[str] = mapped_column(String(16))  # primary / backup / rejected
    title: Mapped[str] = mapped_column(String(128))
    legs_json: Mapped[str] = mapped_column(Text)  # JSON 数组
    price_low: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_high: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    days_low: Mapped[int] = mapped_column(Integer)
    days_high: Mapped[int] = mapped_column(Integer)
    transship_count: Mapped[int] = mapped_column(Integer, default=0)
    risk_note: Mapped[str] = mapped_column(String(256), default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    check_items_json: Mapped[str] = mapped_column(Text, default="[]")  # JSON 数组
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Inquiry(Base):
    """询运单：选定方案生成的标准询运需求与人工反馈。"""

    __tablename__ = "logistics_inquiries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(Integer, index=True)
    plan_id: Mapped[int] = mapped_column(Integer)
    content_json: Mapped[str] = mapped_column(Text)  # JSON 对象，字段可编辑
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft / submitted / feedback
    feedback_json: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
