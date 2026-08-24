from sqlalchemy.orm import Session

from app.knowledge.models import SharedExperience


def _to_dict(row: SharedExperience) -> dict:
    return {
        "id": row.id,
        "source_record_id": row.source_record_id,
        "content": row.content,
        "tags": row.tags or [],
        "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def create_experience(
    db: Session,
    *,
    source_record_id: int,
    content: str,
    tags: list[str] | None = None,
) -> dict | None:
    """创建经验，source_record_id 唯一约束去重。"""
    existing = (
        db.query(SharedExperience)
        .filter(SharedExperience.source_record_id == source_record_id)
        .first()
    )
    if existing:
        return _to_dict(existing)
    row = SharedExperience(
        source_record_id=source_record_id,
        content=content,
        tags=tags or [],
        status="active",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_dict(row)


def list_experiences(db: Session, *, include_ignored: bool = False) -> list[dict]:
    q = db.query(SharedExperience).order_by(SharedExperience.id.desc())
    if not include_ignored:
        q = q.filter(SharedExperience.status == "active")
    return [_to_dict(r) for r in q.all()]


def get_experience(db: Session, exp_id: int) -> SharedExperience | None:
    return db.query(SharedExperience).filter(SharedExperience.id == exp_id).first()


def update_experience(db: Session, exp: SharedExperience, *, content: str) -> dict:
    exp.content = content
    db.commit()
    db.refresh(exp)
    return _to_dict(exp)


def ignore_experience(db: Session, exp: SharedExperience) -> dict:
    exp.status = "ignored"
    db.commit()
    db.refresh(exp)
    return _to_dict(exp)
