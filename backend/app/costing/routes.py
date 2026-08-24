from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.costing import llm
from app.costing.rules import calculate_profit, calculate_scheme, compare_schemes
from app.costing.schemas import (
    AskRequest,
    CalculateRequest,
    ProfitQuestionRequest,
    ProfitRequest,
    SaveRecordRequest,
    SchemeInput,
)
from app.costing import repository
from app.database import get_db
from app.knowledge import service as knowledge_service

router = APIRouter(prefix="/api/costing", tags=["costing"])


def _maybe_create_experience(db: Session, record_dict: dict):
    """记录进入 completed 状态时沉淀企业经验（source_record_id 去重）。"""
    try:
        schemes = record_dict.get("schemes") or record_dict.get("schemes_snapshot") or []
        variety = next(
            (scheme.get("variety_name") for scheme in schemes if scheme.get("variety_name")),
            "粮食",
        )
        knowledge_service.learn_from_task(
            db,
            source_agent="suan",
            source_type="costing",
            source_id=record_dict["id"],
            source_title=record_dict["title"],
            confirmed=record_dict.get("status") == "completed",
            payload={
                "variety_name": variety,
                "selected_scheme_id": record_dict.get("selected_scheme_id"),
                "calculation": record_dict.get("calculation"),
                "profit": record_dict.get("profit"),
            },
        )
    except Exception:
        import logging
        logging.getLogger("suan.costing").exception("经验沉淀失败，不影响主流程")


def _value_error_to_422(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ─── 测算预览（不落库） ──────────────────────────────────────────────────────

@router.post("/calculate")
def calculate(body: CalculateRequest):
    comparison = _value_error_to_422(compare_schemes, body.schemes)
    comparison.explanation = llm.explain_comparison(comparison)
    return comparison.model_dump(mode="json")


# ─── 报价提取 ────────────────────────────────────────────────────────────────

class ExtractRequest(BaseModel):
    text: str


@router.post("/extract")
def extract(body: ExtractRequest):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="请粘贴报价或描述测算方案")
    return llm.extract_schemes(text)


# ─── 记录 CRUD ───────────────────────────────────────────────────────────────

@router.post("/records")
def save_record(body: SaveRecordRequest, db: Session = Depends(get_db)):
    saved = repository.create_record(
        db,
        title=body.title,
        source_text=body.source_text,
        schemes_snapshot=[s.model_dump(mode="json") for s in body.schemes],
        calculation_snapshot=body.calculation.model_dump(mode="json") if body.calculation else None,
        selected_scheme_id=body.selected_scheme_id,
    )
    _maybe_create_experience(db, saved)
    return saved


@router.get("/records")
def list_records(db: Session = Depends(get_db)):
    return {"items": repository.list_records(db)}


@router.get("/records/{record_id}")
def get_record(record_id: int, db: Session = Depends(get_db)):
    data = repository.get_record_dict(db, record_id)
    if data is None:
        raise HTTPException(status_code=404, detail="测算记录不存在")
    return data


# ─── 盈亏 ────────────────────────────────────────────────────────────────────

# 快照中可能为 null 的 Decimal 字段，恢复时补零
_NULLABLE_DECIMAL_FIELDS = [
    "quality_discount_yuan_per_ton", "freight_yuan_per_ton",
    "loading_yuan_per_ton", "loss_rate_pct",
    "financing_cost_yuan", "other_cost_yuan",
]


def _find_selected_scheme(record, scheme_id: str | None) -> SchemeInput:
    """从记录快照中找到选定方案并构造 SchemeInput"""
    schemes = record.schemes_snapshot or []
    target = None
    for s in schemes:
        if scheme_id and s.get("scheme_id") == scheme_id:
            target = dict(s)
            break
    if target is None:
        # 取第一个完整方案
        for s in schemes:
            if s.get("quantity_tons") and s.get("purchase_price_yuan_per_ton"):
                target = dict(s)
                break
    if target is None:
        raise HTTPException(status_code=422, detail="记录中没有可用于计算的方案")

    # 补默认值：快照中的 null Decimal 字段补 "0"
    for field in _NULLABLE_DECIMAL_FIELDS:
        if target.get(field) is None:
            target[field] = "0"
    if target.get("tax_included") is None:
        target["tax_included"] = True
    if target.get("variety_name") is None:
        target["variety_name"] = "未知"
    if target.get("pending_items") is None:
        target["pending_items"] = []
    if target.get("field_meta") is None:
        target["field_meta"] = {}

    try:
        return SchemeInput(**target)
    except Exception as e:
        import logging
        logging.getLogger("suan.costing").warning(f"方案数据不完整: {e}")
        raise HTTPException(status_code=422, detail=f"方案数据不完整，请先补充关键字段: {e}")


@router.post("/records/{record_id}/profit-preview")
def profit_preview(record_id: int, body: ProfitRequest, db: Session = Depends(get_db)):
    record = repository.get_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="测算记录不存在")
    scheme = _find_selected_scheme(record, record.selected_scheme_id)
    result = calculate_profit(scheme, body)
    return result.model_dump(mode="json")


@router.post("/records/{record_id}/profit")
def profit_save(record_id: int, body: ProfitRequest, db: Session = Depends(get_db)):
    record = repository.get_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="测算记录不存在")
    scheme = _find_selected_scheme(record, record.selected_scheme_id)
    result = calculate_profit(scheme, body)
    updated = repository.update_profit(db, record, result.model_dump(mode="json"))
    _maybe_create_experience(db, updated)
    return updated


@router.post("/records/{record_id}/profit-question")
def profit_question(record_id: int, body: ProfitQuestionRequest, db: Session = Depends(get_db)):
    record = repository.get_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="测算记录不存在")
    scheme = _find_selected_scheme(record, record.selected_scheme_id)

    changes = llm.extract_profit_change(body.question)

    # 基于基准价构造 ProfitRequest，叠加变化量
    sell_price = body.baseline_selling_price_yuan_per_ton
    freight_override = None
    loss_override = None

    delta_price = changes.get("selling_price_delta_yuan_per_ton")
    if delta_price:
        try:
            sell_price = sell_price + Decimal(delta_price)
        except (InvalidOperation, TypeError):
            pass

    delta_freight = changes.get("freight_delta_yuan_per_ton")
    if delta_freight:
        try:
            freight_override = scheme.freight_yuan_per_ton + Decimal(delta_freight)
        except (InvalidOperation, TypeError):
            pass

    delta_loss = changes.get("loss_delta_pct")
    if delta_loss:
        try:
            loss_override = scheme.loss_rate_pct + Decimal(delta_loss)
        except (InvalidOperation, TypeError):
            pass

    req = ProfitRequest(
        selling_price_yuan_per_ton=sell_price,
        sales_fulfillment_cost_yuan=body.sales_fulfillment_cost_yuan,
        freight_yuan_per_ton=freight_override,
        loss_rate_pct=loss_override,
    )
    result = calculate_profit(scheme, req)
    return {
        "changes": changes,
        "result": result.model_dump(mode="json"),
    }


# ─── 克隆 ────────────────────────────────────────────────────────────────────

@router.post("/records/{record_id}/clone")
def clone_record(record_id: int, db: Session = Depends(get_db)):
    record = repository.get_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="测算记录不存在")
    return repository.clone_record(db, record)


# ─── 问答 ────────────────────────────────────────────────────────────────────

@router.post("/ask")
def ask(body: AskRequest, db: Session = Depends(get_db)):
    record_data = None
    if body.record_id:
        record_data = repository.get_record_dict(db, body.record_id)
    answer = llm.answer_with_context(body.tab, body.question, record_data)
    return {"answer": answer}
