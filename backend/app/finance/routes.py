from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.finance import llm, repository
from app.finance.rules import match_products
from app.finance.schemas import FinanceProductOut, FinanceRequirement, MatchPreview

router = APIRouter(prefix="/api/finance", tags=["finance"])

CATEGORY_NAMES = {
    "purchase_working": "采购周转融资",
    "order_finance": "订单融资",
    "warehouse_finance": "仓单/货权融资",
    "receivable_finance": "应收账款融资",
}


# ─── 市场 API ─────────────────────────────────────────────────────────────────

@router.get("/meta")
def get_meta(db: Session = Depends(get_db)):
    products = repository.list_products(db)
    rates = [p.annual_rate_pct for p in products if p.annual_rate_pct is not None]
    return {
        "product_count": len(products),
        "categories": list(CATEGORY_NAMES),
        "category_names": CATEGORY_NAMES,
        "annual_rate_min_pct": str(min(rates)) if rates else None,
        "annual_rate_max_pct": str(max(rates)) if rates else None,
        "data_updated_at": max((p.data_updated_at for p in products), default=""),
    }


@router.get("/products")
def get_products(category: str | None = None, purpose: str | None = None,
                 amount_yuan: Decimal | None = None, duration_days: int | None = None,
                 guarantee_mode: str | None = None,
                 max_annual_rate_pct: Decimal | None = None,
                 db: Session = Depends(get_db)):
    filters = {
        "category": category,
        "purpose": purpose,
        "amount_yuan": amount_yuan,
        "duration_days": duration_days,
        "guarantee_mode": guarantee_mode,
        "max_annual_rate_pct": max_annual_rate_pct,
    }
    return {"items": [FinanceProductOut.model_validate(row) for row in repository.list_products(db, filters)]}


@router.get("/products/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = repository.get_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="金融产品不存在或已下架")
    return FinanceProductOut.model_validate(product)


# ─── 需求抽取 API ─────────────────────────────────────────────────────────────

class ExtractRequest(BaseModel):
    text: str


@router.post("/requirements/extract")
def extract_requirement_route(body: ExtractRequest):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="请描述本次资金需求")
    return llm.extract_requirement(text)


# ─── 匹配 API ─────────────────────────────────────────────────────────────────

class MatchRequest(BaseModel):
    requirement: FinanceRequirement


def _build_preview(db: Session, requirement: FinanceRequirement) -> MatchPreview:
    products = repository.list_products(db)
    preview = match_products(requirement, products)
    preview.explanation = llm.explain_match(preview)
    return preview


def _serialize_record(row) -> dict:
    return {
        "id": row.id, "match_code": row.match_code,
        "source_type": row.source_type, "source_ref": row.source_ref,
        "requirement": row.requirement_snapshot,
        "result": row.result_snapshot | {"explanation": row.explanation},
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.post("/matches/preview")
def preview_match(body: MatchRequest, db: Session = Depends(get_db)):
    return _build_preview(db, body.requirement)


@router.post("/matches")
def save_match(body: MatchRequest, db: Session = Depends(get_db)):
    preview = _build_preview(db, body.requirement)
    record = repository.create_match_record(db, body.requirement, preview)
    return _serialize_record(record)


@router.get("/matches")
def list_matches(db: Session = Depends(get_db)):
    records = repository.list_match_records(db)
    return {"items": [_serialize_record(r) for r in records]}


@router.get("/matches/{match_id}")
def get_match(match_id: int, db: Session = Depends(get_db)):
    record = repository.get_match_record(db, match_id)
    if record is None:
        raise HTTPException(status_code=404, detail="匹配记录不存在")
    return _serialize_record(record)


@router.post("/matches/{match_id}/handoff/suan")
def handoff_to_suan(match_id: int, db: Session = Depends(get_db)):
    record = repository.get_match_record(db, match_id)
    if record is None:
        raise HTTPException(status_code=404, detail="匹配记录不存在")
    result = record.result_snapshot
    primary = result.get("primary")
    if primary is None:
        raise HTTPException(status_code=422, detail="该匹配没有主推产品，无法交接")
    product = primary["product"]
    req = record.requirement_snapshot
    return {
        "source_agent": "qian",
        "target_agent": "suan",
        "source_match_id": record.id,
        "product_code": product["product_code"],
        "product_name": product["name"],
        "amount_yuan": str(req["amount_yuan"]),
        "duration_days": req["duration_days"],
        "annual_rate_pct": str(product["annual_rate_pct"]) if product.get("annual_rate_pct") is not None else None,
        "reference_cost_yuan": primary.get("estimated_cost_yuan"),
        "fee_note": product.get("fee_note", ""),
        "pending_conditions": primary.get("pending_conditions", []),
    }
