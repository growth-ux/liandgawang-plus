from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Float, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MarketSpotPrice(Base):
    """库点现货价：某品种在某库点的当前价、指数、环比涨跌与去年同期价。"""

    __tablename__ = "market_spot_prices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    spot_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    variety_code: Mapped[str] = mapped_column(String(32), index=True)
    variety_name: Mapped[str] = mapped_column(String(32))
    region_name: Mapped[str] = mapped_column(String(64))
    region_type: Mapped[str] = mapped_column(String(16))  # 产区 / 销区 / 港口
    quote_type: Mapped[str] = mapped_column(String(16))  # 收购价 / 平仓价 / 到货价
    remark: Mapped[str] = mapped_column(String(32))  # 品质形态，如 二等散粮 / 一等集装箱
    lng: Mapped[float] = mapped_column(Float)  # 经度
    lat: Mapped[float] = mapped_column(Float)  # 纬度
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    change_pct: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    last_year_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_date: Mapped[date] = mapped_column(Date)
    data_kind: Mapped[str] = mapped_column(String(16), default="simulated")
    mock_dataset_version: Mapped[str] = mapped_column(String(32), default="zhan-v1")
    mock_generated_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class MarketEvent(Base):
    """市场关键事件：标题、摘要、影响方向与强度。"""

    __tablename__ = "market_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    variety_code: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(128))
    summary: Mapped[str] = mapped_column(Text)
    event_at: Mapped[datetime] = mapped_column(DateTime)
    impact_regions: Mapped[str] = mapped_column(String(256))  # JSON 数组字符串
    direction: Mapped[str] = mapped_column(String(16))  # bullish / bearish / neutral
    strength: Mapped[str] = mapped_column(String(16))  # strong / moderate / mild
    duration_hint: Mapped[str] = mapped_column(String(32))
    data_kind: Mapped[str] = mapped_column(String(16), default="simulated")
    mock_dataset_version: Mapped[str] = mapped_column(String(32), default="zhan-v1")
    mock_generated_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
