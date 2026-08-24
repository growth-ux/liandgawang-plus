from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.handoff.models import AgentHandoff

router = APIRouter(prefix="/api/handoffs", tags=["handoffs"])


class HandoffCreate(BaseModel):
    source_agent: str = Field(min_length=1, max_length=16)
    target_agent: str = Field(min_length=1, max_length=16)
    source_ref: str = Field(default="", max_length=128)
    title: str = Field(min_length=1, max_length=128)
    summary: str = Field(default="", max_length=1000)
    payload: dict = Field(default_factory=dict)


def _serialize(row: AgentHandoff) -> dict:
    return {
        "id": row.id, "handoff_code": row.handoff_code,
        "source_agent": row.source_agent, "target_agent": row.target_agent,
        "source_ref": row.source_ref, "title": row.title, "summary": row.summary,
        "payload": row.payload or {}, "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "accepted_at": row.accepted_at.isoformat() if row.accepted_at else None,
    }


def _get_or_404(db: Session, handoff_id: int) -> AgentHandoff:
    row = db.get(AgentHandoff, handoff_id)
    if row is None:
        raise HTTPException(status_code=404, detail="交接单不存在")
    return row


@router.post("")
def create_handoff(body: HandoffCreate, db: Session = Depends(get_db)):
    prefix = f"HJ{datetime.now().strftime('%Y%m%d')}"
    count = db.query(AgentHandoff).filter(AgentHandoff.handoff_code.like(f"{prefix}%")).count()
    row = AgentHandoff(handoff_code=f"{prefix}-{count + 1:03d}", **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.get("/{handoff_id}")
def get_handoff(handoff_id: int, db: Session = Depends(get_db)):
    return _serialize(_get_or_404(db, handoff_id))


@router.post("/{handoff_id}/accept")
def accept_handoff(handoff_id: int, db: Session = Depends(get_db)):
    row = _get_or_404(db, handoff_id)
    if row.status == "ignored":
        raise HTTPException(status_code=409, detail="该交接单已忽略")
    if row.status == "pending":
        row.status = "accepted"
        row.accepted_at = datetime.now()
        db.commit()
        db.refresh(row)
    return _serialize(row)


@router.post("/{handoff_id}/ignore")
def ignore_handoff(handoff_id: int, db: Session = Depends(get_db)):
    row = _get_or_404(db, handoff_id)
    if row.status == "pending":
        row.status = "ignored"
        db.commit()
        db.refresh(row)
    return _serialize(row)
