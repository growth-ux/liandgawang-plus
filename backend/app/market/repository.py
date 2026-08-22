from sqlalchemy import select
from sqlalchemy.orm import Session

from app.market.models import MarketSpotPrice


def list_spots(db: Session, variety_code: str) -> list[MarketSpotPrice]:
    """按品种返回全部库点现货价，保持 seed 顺序（id 升序）。"""
    return db.scalars(
        select(MarketSpotPrice)
        .where(MarketSpotPrice.variety_code == variety_code)
        .order_by(MarketSpotPrice.id)
    ).all()
