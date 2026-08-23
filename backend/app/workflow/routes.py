import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.market.repository import get_spot
from app.workflow import repository
from app.workflow.models import WatchCondition
from app.workflow.rules import WATCH_TYPE_LABELS, WATCH_TYPES

router = APIRouter(prefix="/api/watches", tags=["watches"])


class WatchCreate(BaseModel):
    variety_code: str
    spot_code: str
    watch_type: str
    threshold: float = Field(gt=0)


class WatchUpdate(BaseModel):
    status: str | None = None
    threshold: float | None = Field(default=None, gt=0)


def _serialize(watch: WatchCondition) -> dict:
    return {
        "id": watch.id,
        "watch_code": watch.watch_code,
        "variety_code": watch.variety_code,
        "variety_name": watch.variety_name,
        "spot_code": watch.spot_code,
        "region_name": watch.region_name,
        "quote_type": watch.quote_type,
        "watch_type": watch.watch_type,
        "watch_type_label": WATCH_TYPE_LABELS.get(watch.watch_type, watch.watch_type),
        "threshold": str(watch.threshold),
        "status": watch.status,
        "current_value": str(watch.current_value) if watch.current_value is not None else None,
        "triggered_reason": watch.triggered_reason,
        "last_checked_at": watch.last_checked_at.isoformat() if watch.last_checked_at else None,
        "data_kind": watch.data_kind,
        "mock_dataset_version": watch.mock_dataset_version,
    }


@router.get("")
def list_watches(db: Session = Depends(get_db)):
    """打开页面时用当前演示行情重算每条关注状态。"""
    watches = repository.list_watches(db)
    for w in watches:
        repository.refresh_watch(db, w)
    db.commit()
    return [_serialize(w) for w in watches]


@router.post("")
def create_watch(body: WatchCreate, db: Session = Depends(get_db)):
    if body.watch_type not in WATCH_TYPES:
        raise HTTPException(status_code=422, detail="未知关注类型")
    spot = get_spot(db, body.variety_code, body.spot_code)
    if spot is None:
        raise HTTPException(status_code=404, detail="库点不存在")
    watch = WatchCondition(
        watch_code=f"WATCH-{uuid.uuid4().hex[:8].upper()}",
        variety_code=spot.variety_code,
        variety_name=spot.variety_name,
        spot_code=spot.spot_code,
        region_name=spot.region_name,
        quote_type=spot.quote_type,
        watch_type=body.watch_type,
        threshold=Decimal(str(round(body.threshold, 2))),
        status="monitoring",
        data_kind="user_input",
        mock_dataset_version="zhan-v1",
    )
    db.add(watch)
    db.flush()
    repository.refresh_watch(db, watch)
    db.commit()
    db.refresh(watch)
    return _serialize(watch)


@router.patch("/{watch_id}")
def update_watch(watch_id: int, body: WatchUpdate, db: Session = Depends(get_db)):
    watch = repository.get_watch(db, watch_id)
    if watch is None:
        raise HTTPException(status_code=404, detail="关注不存在")
    if body.status is not None:
        if body.status not in ("monitoring", "paused", "closed", "notified"):
            raise HTTPException(status_code=422, detail="未知状态")
        watch.status = body.status
    if body.threshold is not None:
        watch.threshold = Decimal(str(round(body.threshold, 2)))
    repository.refresh_watch(db, watch)
    db.commit()
    db.refresh(watch)
    return _serialize(watch)


@router.post("/{watch_id}/evaluate")
def evaluate_watch(watch_id: int, db: Session = Depends(get_db)):
    watch = repository.get_watch(db, watch_id)
    if watch is None:
        raise HTTPException(status_code=404, detail="关注不存在")
    repository.refresh_watch(db, watch)
    db.commit()
    db.refresh(watch)
    return _serialize(watch)
