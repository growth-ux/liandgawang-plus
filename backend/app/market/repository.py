from sqlalchemy import select
from sqlalchemy.orm import Session

from app.market.models import MarketEvent, MarketSpotPrice


def list_spots(db: Session, variety_code: str) -> list[MarketSpotPrice]:
    """按品种返回全部库点现货价，保持 seed 顺序（id 升序）。"""
    return db.scalars(
        select(MarketSpotPrice)
        .where(MarketSpotPrice.variety_code == variety_code)
        .order_by(MarketSpotPrice.id)
    ).all()


def list_events(db: Session, variety_code: str) -> list[MarketEvent]:
    """按品种返回事件，按事件时间倒序。"""
    return db.scalars(
        select(MarketEvent)
        .where(MarketEvent.variety_code == variety_code)
        .order_by(MarketEvent.event_at.desc())
    ).all()
