from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.order.models import MarketOrder

router = APIRouter(prefix="/api/market-orders", tags=["market-orders"])

# 单据类型 → 单号前缀
_ORDER_PREFIX = {
    "grain_purchase": "CG",
    "transport_booking": "YD",
    "finance_application": "RZ",
}


class OrderCreate(BaseModel):
    order_type: str = Field(min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=128)
    subject_ref: str = Field(default="", max_length=128)
    summary: str = Field(default="", max_length=500)
    payload: dict = Field(default_factory=dict)


def _serialize(row: MarketOrder) -> dict:
    return {
        "id": row.id, "order_code": row.order_code, "order_type": row.order_type,
        "title": row.title, "subject_ref": row.subject_ref, "summary": row.summary,
        "payload": row.payload or {}, "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.post("")
def create_order(body: OrderCreate, db: Session = Depends(get_db)):
    prefix = _ORDER_PREFIX.get(body.order_type)
    if prefix is None:
        raise HTTPException(status_code=400, detail=f"未知单据类型：{body.order_type}")
    date_prefix = f"{prefix}{datetime.now().strftime('%Y%m%d')}"
    count = db.query(MarketOrder).filter(MarketOrder.order_code.like(f"{date_prefix}%")).count()
    row = MarketOrder(
        order_code=f"{date_prefix}{count + 1:03d}",
        order_type=body.order_type,
        title=body.title,
        subject_ref=body.subject_ref,
        summary=body.summary,
        payload=body.payload,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.get("")
def list_orders(order_type: str | None = None, db: Session = Depends(get_db)):
    query = db.query(MarketOrder)
    if order_type:
        query = query.filter(MarketOrder.order_type == order_type)
    rows = query.order_by(MarketOrder.id.desc()).limit(100).all()
    return {"items": [_serialize(r) for r in rows]}


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    row = db.get(MarketOrder, order_id)
    if row is None:
        raise HTTPException(status_code=404, detail="单据不存在")
    return _serialize(row)
