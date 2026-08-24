import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.costing.models import CostingRecord


def _generate_code() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    suffix = uuid.uuid4().hex[:6].upper()
    return f"COST-{ts}-{suffix}"


def _derive_status(
    calculation_snapshot: dict | None,
    selected_scheme_id: str | None,
    profit_snapshot: dict | None,
) -> str:
    if selected_scheme_id or profit_snapshot:
        return "completed"
    if calculation_snapshot:
        return "calculated"
    return "pending"


def _to_dict(row: CostingRecord) -> dict:
    return {
        "id": row.id,
        "record_code": row.record_code,
        "title": row.title,
        "status": row.status,
        "source_text": row.source_text,
        "schemes": row.schemes_snapshot,
        "calculation": row.calculation_snapshot,
        "selected_scheme_id": row.selected_scheme_id,
        "profit": row.profit_snapshot,
        "ai_explanation": row.ai_explanation,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def create_record(
    db: Session,
    *,
    title: str,
    source_text: str,
    schemes_snapshot: list,
    calculation_snapshot: dict | None,
    selected_scheme_id: str | None,
    ai_explanation: str = "",
) -> dict:
    status = _derive_status(calculation_snapshot, selected_scheme_id, None)
    row = CostingRecord(
        record_code=_generate_code(),
        title=title,
        status=status,
        source_text=source_text,
        schemes_snapshot=schemes_snapshot,
        calculation_snapshot=calculation_snapshot,
        selected_scheme_id=selected_scheme_id,
        ai_explanation=ai_explanation,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_dict(row)


def list_records(db: Session) -> list[dict]:
    rows = db.query(CostingRecord).order_by(CostingRecord.id.desc()).all()
    return [_to_dict(r) for r in rows]


def get_record(db: Session, record_id: int) -> CostingRecord | None:
    return db.query(CostingRecord).filter(CostingRecord.id == record_id).first()


def get_record_dict(db: Session, record_id: int) -> dict | None:
    row = get_record(db, record_id)
    return _to_dict(row) if row else None


def update_profit(
    db: Session, record: CostingRecord, profit_snapshot: dict
) -> dict:
    record.profit_snapshot = profit_snapshot
    record.status = "completed"
    db.commit()
    db.refresh(record)
    return _to_dict(record)


def clone_record(db: Session, record: CostingRecord) -> dict:
    row = CostingRecord(
        record_code=_generate_code(),
        title=f"{record.title}（副本）",
        status="pending",
        source_text=record.source_text,
        schemes_snapshot=record.schemes_snapshot,
        calculation_snapshot=None,
        selected_scheme_id=None,
        profit_snapshot=None,
        ai_explanation="",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_dict(row)
