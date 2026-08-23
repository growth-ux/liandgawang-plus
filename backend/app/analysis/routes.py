import json
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analysis.llm import interpret_judgment
from app.analysis.models import AnalysisRecord
from app.analysis.rules import build_procurement_judgment, pick_baseline_spot
from app.database import get_db
from app.market import repository
from app.market.mock_seed import MOCK_DATASET_VERSION, MOCK_GENERATED_AT
from app.market.routes import VARIETY_NAMES

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

RISK_PREFERENCES = {"稳健", "积极", "保守"}


class AnalysisRequest(BaseModel):
    variety_code: str
    quantity_tons: Decimal = Field(gt=0)
    deadline_date: date
    grade: str | None = Field(default=None, max_length=32)
    target_region: str = Field(min_length=1, max_length=64)
    budget_price: Decimal | None = Field(default=None, gt=0)
    stock_days: int | None = Field(default=None, ge=0)
    risk_preference: str | None = None
    remark: str | None = Field(default=None, max_length=256)


def _compute(req: AnalysisRequest, db: Session) -> dict:
    """读取行情数据并计算研判骨架，预览与保存共用。"""
    variety_name = VARIETY_NAMES[req.variety_code]
    spots = repository.list_spots(db, req.variety_code)
    events = repository.list_events(db, req.variety_code)
    baseline = pick_baseline_spot(spots, req.target_region)
    series_prices = (
        [p.price for p in repository.get_price_series(db, baseline.spot_code)]
        if baseline is not None
        else []
    )
    return build_procurement_judgment(
        variety_name=variety_name,
        quantity_tons=req.quantity_tons,
        deadline_date=req.deadline_date,
        spots=spots,
        series_prices=series_prices,
        events=events,
        baseline_spot=baseline,
        budget_price=req.budget_price,
        stock_days=req.stock_days,
        risk_preference=req.risk_preference,
    )


def _validate(req: AnalysisRequest) -> None:
    if req.variety_code not in VARIETY_NAMES:
        raise HTTPException(status_code=404, detail="品种不存在")
    if req.risk_preference and req.risk_preference not in RISK_PREFERENCES:
        raise HTTPException(status_code=422, detail="风险偏好仅支持：稳健 / 积极 / 保守")


def _conditions_payload(req: AnalysisRequest) -> dict:
    """拼给大模型的用户条件描述。"""
    extra_parts = []
    if req.grade:
        extra_parts.append(f"等级{req.grade}")
    if req.target_region:
        extra_parts.append(f"目标地区{req.target_region}")
    if req.budget_price is not None:
        extra_parts.append(f"预算{_fmt_decimal(req.budget_price)}元/吨")
    if req.stock_days is not None:
        extra_parts.append(f"库存可用{req.stock_days}天")
    if req.risk_preference:
        extra_parts.append(f"风险偏好{req.risk_preference}")
    if req.remark:
        extra_parts.append(req.remark)
    return {
        "variety_name": VARIETY_NAMES[req.variety_code],
        "quantity_tons": _fmt_decimal(req.quantity_tons),
        "deadline_date": req.deadline_date.isoformat(),
        "extra": "，".join(extra_parts),
    }


def _with_llm(j: dict, req: AnalysisRequest) -> dict:
    """在规则骨架上叠加 Qwen 解读，失败回退规则版。"""
    interpretation = interpret_judgment(j, _conditions_payload(req))
    return {
        **j,
        "interpretation": interpretation,
        "ai_source": "qwen" if interpretation else "rule",
    }


def _judgment_payload(j: dict) -> dict:
    return {
        "data_kind": "simulated",
        "mock_dataset_version": MOCK_DATASET_VERSION,
        "mock_generated_at": MOCK_GENERATED_AT.isoformat(),
        **j,
    }


@router.post("/preview")
def preview_analysis(req: AnalysisRequest, db: Session = Depends(get_db)):
    """只计算不写库：规则骨架 + Qwen 解读，供用户确认。"""
    _validate(req)
    j = _with_llm(_compute(req, db), req)
    return _judgment_payload(j)


@router.post("")
def create_analysis(req: AnalysisRequest, db: Session = Depends(get_db)):
    """确认后保存研判记录：条件与结果快照落库，重新研判新建记录。"""
    _validate(req)
    j = _with_llm(_compute(req, db), req)
    record = AnalysisRecord(
        variety_code=req.variety_code,
        variety_name=VARIETY_NAMES[req.variety_code],
        quantity_tons=req.quantity_tons,
        deadline_date=req.deadline_date,
        grade=req.grade,
        target_region=req.target_region,
        budget_price=req.budget_price,
        stock_days=req.stock_days,
        risk_preference=req.risk_preference,
        remark=req.remark,
        action=j["action"],
        ratio_low=j["ratio_low"],
        ratio_high=j["ratio_high"],
        time_window=j["time_window"],
        summary=j["summary"],
        interpretation=j["interpretation"],
        supporting=json.dumps(j["supporting"], ensure_ascii=False),
        opposing=json.dumps(j["opposing"], ensure_ascii=False),
        invalidation=json.dumps(j["invalidation"], ensure_ascii=False),
        watch_metrics=json.dumps(j["watch_metrics"], ensure_ascii=False),
        missing_data=json.dumps(j["missing_data"], ensure_ascii=False),
        evidence_completeness=j["evidence_completeness"],
        dataset_version=MOCK_DATASET_VERSION,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"record_id": record.id, **_serialize(record)}


def _fmt_decimal(v: Decimal | None) -> str | None:
    """去掉 Numeric 尾零：120.00 -> 120。"""
    return format(v.normalize(), "f") if v is not None else None


def _serialize(r: AnalysisRecord) -> dict:
    return {
        "id": r.id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "variety_code": r.variety_code,
        "variety_name": r.variety_name,
        "quantity_tons": _fmt_decimal(r.quantity_tons),
        "deadline_date": r.deadline_date.isoformat(),
        "grade": r.grade,
        "target_region": r.target_region,
        "budget_price": _fmt_decimal(r.budget_price),
        "stock_days": r.stock_days,
        "risk_preference": r.risk_preference,
        "remark": r.remark,
        "action": r.action,
        "ratio_low": r.ratio_low,
        "ratio_high": r.ratio_high,
        "time_window": r.time_window,
        "summary": r.summary,
        "interpretation": r.interpretation,
        "ai_source": "qwen" if r.interpretation else "rule",
        "supporting": json.loads(r.supporting),
        "opposing": json.loads(r.opposing),
        "invalidation": json.loads(r.invalidation),
        "watch_metrics": json.loads(r.watch_metrics),
        "missing_data": json.loads(r.missing_data),
        "evidence_completeness": r.evidence_completeness,
        "dataset_version": r.dataset_version,
    }


@router.get("")
def list_analysis(db: Session = Depends(get_db)):
    """研判记录：按保存时间倒序返回。"""
    records = db.scalars(select(AnalysisRecord).order_by(AnalysisRecord.id.desc())).all()
    return [_serialize(r) for r in records]


@router.get("/{record_id}")
def get_analysis(record_id: int, db: Session = Depends(get_db)):
    record = db.get(AnalysisRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="研判记录不存在")
    return _serialize(record)
