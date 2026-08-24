from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.finance.models import FinanceMatchRecord, FinanceProduct
from app.finance.schemas import FinanceRequirement, MatchPreview


def list_products(db: Session, filters: dict | None = None) -> list[FinanceProduct]:
    stmt = select(FinanceProduct).where(FinanceProduct.is_active.is_(True))
    filters = filters or {}
    if filters.get("category"):
        stmt = stmt.where(FinanceProduct.category == filters["category"])
    if filters.get("amount_yuan") is not None:
        amount = filters["amount_yuan"]
        stmt = stmt.where(FinanceProduct.min_amount_yuan <= amount,
                          FinanceProduct.max_amount_yuan >= amount)
    if filters.get("duration_days") is not None:
        days = filters["duration_days"]
        stmt = stmt.where(FinanceProduct.min_days <= days, FinanceProduct.max_days >= days)
    rows = list(db.scalars(stmt.order_by(FinanceProduct.id)).all())
    if filters.get("purpose"):
        rows = [row for row in rows if filters["purpose"] in row.purposes]
    if filters.get("guarantee_mode"):
        rows = [row for row in rows if filters["guarantee_mode"] in row.guarantee_modes]
    if filters.get("max_annual_rate_pct") is not None:
        rows = [row for row in rows if row.annual_rate_pct is not None
                and row.annual_rate_pct <= filters["max_annual_rate_pct"]]
    return rows


def get_product(db: Session, product_id: int) -> FinanceProduct | None:
    product = db.get(FinanceProduct, product_id)
    return product if product is not None and product.is_active else None


# ─── 匹配记录 ───────────────────────────────────────────────────────────────

def _next_match_code(db: Session) -> str:
    prefix = f"QPM{datetime.now():%Y%m%d}-"
    count = db.query(FinanceMatchRecord).filter(
        FinanceMatchRecord.match_code.like(f"{prefix}%")
    ).count()
    return f"{prefix}{count + 1:03d}"


def create_match_record(db: Session, requirement: FinanceRequirement,
                        preview: MatchPreview) -> FinanceMatchRecord:
    row = FinanceMatchRecord(
        match_code=_next_match_code(db), source_type=requirement.source_type,
        source_ref=requirement.source_ref,
        requirement_snapshot=requirement.model_dump(mode="json"),
        result_snapshot=preview.model_dump(mode="json", exclude={"requirement", "explanation"}),
        explanation=preview.explanation,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_match_records(db: Session) -> list[FinanceMatchRecord]:
    return list(db.scalars(select(FinanceMatchRecord).order_by(FinanceMatchRecord.id.desc())).all())


def get_match_record(db: Session, match_id: int) -> FinanceMatchRecord | None:
    return db.get(FinanceMatchRecord, match_id)
