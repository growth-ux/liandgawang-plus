from sqlalchemy import select
from sqlalchemy.orm import Session

from app.market.models import MarketPriceSeries, MarketSpotPrice


def list_spots(db: Session, variety_code: str) -> list[MarketSpotPrice]:
    """按品种返回全部库点现货价，保持 seed 顺序（id 升序）。"""
    return db.scalars(
        select(MarketSpotPrice)
        .where(MarketSpotPrice.variety_code == variety_code)
        .order_by(MarketSpotPrice.id)
    ).all()


def get_spot(db: Session, variety_code: str, spot_code: str) -> MarketSpotPrice | None:
    """按品种 + 库点取现货价，不存在返回 None。"""
    return db.scalars(
        select(MarketSpotPrice).where(
            MarketSpotPrice.variety_code == variety_code,
            MarketSpotPrice.spot_code == spot_code,
        )
    ).first()


def get_price_series(db: Session, spot_code: str) -> list[MarketPriceSeries]:
    """按库点返回历史价格序列，按演示日期升序。"""
    return db.scalars(
        select(MarketPriceSeries)
        .where(MarketPriceSeries.spot_code == spot_code)
        .order_by(MarketPriceSeries.observed_date)
    ).all()
