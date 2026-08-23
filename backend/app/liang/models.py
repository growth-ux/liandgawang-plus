from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, Date, DateTime, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GrainListing(Base):
    """粮源挂牌：某供应方在某产地挂牌的一批粮食。"""

    __tablename__ = "grain_listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    listing_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    variety_code: Mapped[str] = mapped_column(String(32), index=True)
    variety_name: Mapped[str] = mapped_column(String(32))
    crop_year: Mapped[int] = mapped_column(Integer)
    origin_province: Mapped[str] = mapped_column(String(64), index=True)
    origin_city: Mapped[str] = mapped_column(String(64))
    grade: Mapped[str] = mapped_column(String(16))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_type: Mapped[str] = mapped_column(String(16))  # 出厂价 / 到库价 / 港口价
    available_quantity_tons: Mapped[int] = mapped_column(Integer)
    delivery_type: Mapped[str] = mapped_column(String(16))  # 散粮 / 集装箱 / 车板
    earliest_ship_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    latest_ship_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    moisture_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    test_weight_g_l: Mapped[Decimal | None] = mapped_column(Numeric(5, 0), nullable=True)
    impurity_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    supplier_name: Mapped[str] = mapped_column(String(64))
    supplier_region: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class SourcingTask(Base):
    """寻源任务：自然语言需求 + DAG 执行得到的方案快照 + 可选交接。"""

    __tablename__ = "sourcing_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="completed")  # completed / handed_off
    need: Mapped[dict] = mapped_column(JSON)  # 需求条件快照
    plan: Mapped[dict] = mapped_column(JSON)  # 方案快照（主推/备选/淘汰/待核验）
    handoff: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # 交接快照
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
