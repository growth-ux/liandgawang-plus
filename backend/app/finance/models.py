from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FinanceProduct(Base):
    __tablename__ = "finance_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(64))
    institution_name: Mapped[str] = mapped_column(String(64))
    category: Mapped[str] = mapped_column(String(32), index=True)
    scenario: Mapped[str] = mapped_column(String(256))
    min_amount_yuan: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    max_amount_yuan: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    min_days: Mapped[int] = mapped_column(Integer)
    max_days: Mapped[int] = mapped_column(Integer)
    annual_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric(7, 3), nullable=True)
    fee_note: Mapped[str] = mapped_column(String(256), default="")
    purposes: Mapped[list] = mapped_column(JSON)
    guarantee_modes: Mapped[list] = mapped_column(JSON)
    required_credentials: Mapped[list] = mapped_column(JSON)
    min_business_years: Mapped[Decimal | None] = mapped_column(Numeric(5, 1), nullable=True)
    requirements: Mapped[list] = mapped_column(JSON)
    data_updated_at: Mapped[str] = mapped_column(String(32))
    dataset_version: Mapped[str] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class FinanceMatchRecord(Base):
    __tablename__ = "finance_match_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    source_type: Mapped[str] = mapped_column(String(16), default="manual")
    source_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    requirement_snapshot: Mapped[dict] = mapped_column(JSON)
    result_snapshot: Mapped[dict] = mapped_column(JSON)
    explanation: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
