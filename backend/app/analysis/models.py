from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AnalysisRecord(Base):
    """采购研判记录：用户条件快照 + 确定性研判结果，重新研判新建记录不覆盖。"""

    __tablename__ = "analysis_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── 用户输入快照 ──
    variety_code: Mapped[str] = mapped_column(String(32), index=True)
    variety_name: Mapped[str] = mapped_column(String(32))
    quantity_tons: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    deadline_date: Mapped[date] = mapped_column(Date)  # 最晚采购/使用时间
    grade: Mapped[str | None] = mapped_column(String(32), nullable=True)
    target_region: Mapped[str | None] = mapped_column(String(64), nullable=True)
    budget_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    stock_days: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 现有库存可用天数
    risk_preference: Mapped[str | None] = mapped_column(String(16), nullable=True)  # 稳健/积极/保守
    remark: Mapped[str | None] = mapped_column(String(256), nullable=True)

    # ── 研判结果快照 ──
    action: Mapped[str] = mapped_column(String(16))  # buy_now / split / wait / verify
    ratio_low: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 建议采购比例下限 %
    ratio_high: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_window: Mapped[str | None] = mapped_column(String(128), nullable=True)
    summary: Mapped[str] = mapped_column(Text)
    interpretation: Mapped[str | None] = mapped_column(Text, nullable=True)  # Qwen 解读，无则为空
    supporting: Mapped[str] = mapped_column(Text)  # JSON 数组
    opposing: Mapped[str] = mapped_column(Text)  # JSON 数组
    invalidation: Mapped[str] = mapped_column(Text)  # JSON 数组：失效条件
    watch_metrics: Mapped[str] = mapped_column(Text)  # JSON 数组：继续观察指标
    missing_data: Mapped[str] = mapped_column(Text)  # JSON 数组：数据缺失项
    evidence_completeness: Mapped[str] = mapped_column(String(16))  # high/medium/low
    dataset_version: Mapped[str] = mapped_column(String(32))  # 使用的演示数据集版本

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
