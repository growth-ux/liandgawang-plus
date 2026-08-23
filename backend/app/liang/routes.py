from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.liang import metrics, repository
from app.liang.llm import interpret_comparison
from app.liang.models import SourcingTask
from app.liang.sourcing_graph import run_sourcing_graph

router = APIRouter(prefix="/api/liang", tags=["liang"])


class ComparisonRequest(BaseModel):
    listing_ids: list[int]


class CandidateBasketCreate(BaseModel):
    listing_id: int


class SourcingRunRequest(BaseModel):
    text: str


def _visitor_id(x_visitor_id: str | None) -> str:
    visitor_id = (x_visitor_id or "").strip()
    if not visitor_id or len(visitor_id) > 64:
        raise HTTPException(status_code=400, detail="缺少有效的访客标识")
    return visitor_id


def _serialize(l):
    return {
        "id": l.id,
        "listing_code": l.listing_code,
        "variety_code": l.variety_code,
        "variety_name": l.variety_name,
        "crop_year": l.crop_year,
        "origin_province": l.origin_province,
        "origin_city": l.origin_city,
        "grade": l.grade,
        "price": str(l.price),
        "price_type": l.price_type,
        "available_quantity_tons": l.available_quantity_tons,
        "delivery_type": l.delivery_type,
        "earliest_ship_at": l.earliest_ship_at.isoformat() if l.earliest_ship_at else None,
        "latest_ship_at": l.latest_ship_at.isoformat() if l.latest_ship_at else None,
        "moisture_pct": str(l.moisture_pct) if l.moisture_pct is not None else None,
        "test_weight_g_l": str(l.test_weight_g_l) if l.test_weight_g_l is not None else None,
        "impurity_pct": str(l.impurity_pct) if l.impurity_pct is not None else None,
        "supplier_name": l.supplier_name,
        "supplier_region": l.supplier_region,
    }


@router.get("/listings")
def get_listings(
    variety_name: str | None = None,
    origin_province: str | None = None,
    grade: str | None = None,
    crop_year: int | None = None,
    price_type: str | None = None,
    delivery_type: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_quantity: int | None = None,
    db: Session = Depends(get_db),
):
    """粮源列表，支持筛选。"""
    filters = {
        "variety_name": variety_name,
        "origin_province": origin_province,
        "grade": grade,
        "crop_year": crop_year,
        "price_type": price_type,
        "delivery_type": delivery_type,
        "min_price": min_price,
        "max_price": max_price,
        "min_quantity": min_quantity,
    }
    listings = repository.list_listings(db, filters)
    return {"items": [_serialize(l) for l in listings]}


@router.get("/listings/{listing_id}")
def get_listing(listing_id: int, db: Session = Depends(get_db)):
    """粮源详情。"""
    listing = repository.get_listing(db, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="粮源不存在")
    return _serialize(listing)


@router.get("/market/summary")
def get_market_summary(db: Session = Depends(get_db)):
    """概览条 + 市场发现。"""
    listings = repository.list_listings(db)
    return {
        "summary": metrics.build_summary(listings),
        "discoveries": metrics.build_discoveries(listings),
    }


@router.get("/candidate-basket")
def get_candidate_basket(
    x_visitor_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    return {"items": [_serialize(item) for item in repository.list_candidate_basket(db, _visitor_id(x_visitor_id))]}


@router.post("/candidate-basket")
def add_candidate_basket(
    body: CandidateBasketCreate,
    x_visitor_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if repository.get_listing(db, body.listing_id) is None:
        raise HTTPException(status_code=404, detail="粮源不存在")
    repository.add_candidate_basket_item(db, _visitor_id(x_visitor_id), body.listing_id)
    return {"items": [_serialize(item) for item in repository.list_candidate_basket(db, _visitor_id(x_visitor_id))]}


@router.delete("/candidate-basket/{listing_id}")
def remove_candidate_basket(
    listing_id: int,
    x_visitor_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    repository.remove_candidate_basket_item(db, _visitor_id(x_visitor_id), listing_id)
    return {"items": [_serialize(item) for item in repository.list_candidate_basket(db, _visitor_id(x_visitor_id))]}


@router.delete("/candidate-basket")
def clear_candidate_basket(
    x_visitor_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    repository.clear_candidate_basket(db, _visitor_id(x_visitor_id))
    return {"items": []}


@router.post("/compare/interpret")
def interpret_candidate_comparison(
    body: ComparisonRequest,
    db: Session = Depends(get_db),
):
    """按候选粮源 ID 生成 AI 深度对比，模型不可用时使用规则解读。"""
    ids = list(dict.fromkeys(body.listing_ids))
    if len(ids) < 2:
        raise HTTPException(status_code=422, detail="至少选择 2 条粮源后才能对比")
    if len(ids) > 8:
        raise HTTPException(status_code=422, detail="单次最多对比 8 条粮源")
    listings = []
    for listing_id in ids:
        listing = repository.get_listing(db, listing_id)
        if listing is None:
            raise HTTPException(status_code=404, detail=f"粮源 {listing_id} 不存在")
        listings.append(_serialize(listing))
    return interpret_comparison(listings)


@router.post("/sourcing-runs")
def run_sourcing_task(body: SourcingRunRequest, db: Session = Depends(get_db)):
    """执行粮小二 LangGraph 寻源状态机并返回节点轨迹与方案。"""
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="请描述寻源需求")
    listings = [_serialize(item) for item in repository.list_listings(db)]
    return run_sourcing_graph(text, listings)


class TaskCreate(BaseModel):
    need: dict
    plan: dict


class HandoffCreate(BaseModel):
    destination: str


def _serialize_task(t: SourcingTask) -> dict:
    return {
        "id": t.id,
        "task_code": t.task_code,
        "status": t.status,
        "need": t.need,
        "plan": t.plan,
        "handoff": t.handoff,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _build_handoff_summary(task: SourcingTask, destination: str) -> dict:
    plan = task.plan or {}
    primary = plan.get("primary") or {}
    need = task.need or {}
    return {
        "variety_name": need.get("variety"),
        "quantity_tons": need.get("quantity_tons"),
        "origin": primary.get("origin"),
        "destination": destination,
        "earliest_ship_at": primary.get("earliest_ship_at"),
        "latest_ship_at": primary.get("latest_ship_at"),
        "primary_listing_code": primary.get("listing_code"),
        "supplier_name": primary.get("supplier_name"),
    }


@router.get("/tasks")
def list_tasks(db: Session = Depends(get_db)):
    """历史运行列表，创建时间倒序。"""
    return {"items": [_serialize_task(t) for t in repository.list_tasks(db)]}


@router.get("/tasks/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = repository.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return _serialize_task(task)


@router.post("/tasks")
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    """保存寻源任务（DAG 执行完成后调用）。"""
    task = repository.create_task(db, body.need, body.plan)
    return _serialize_task(task)


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """删除一条历史寻源任务。"""
    if not repository.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"ok": True}


@router.post("/tasks/{task_id}/handoff")
def handoff_task(task_id: int, body: HandoffCreate, db: Session = Depends(get_db)):
    """交接运小二：生成结构化交接摘要，状态转 handed_off。"""
    task = repository.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status == "handed_off":
        # 幂等：已交接的任务重复交接直接返回既有交接，不覆盖历史
        return _serialize_task(task)
    if not task.plan or not task.plan.get("primary"):
        raise HTTPException(status_code=422, detail="任务尚未生成主推方案，无法交接")
    handoff = {
        "handoff_code": f"YJ{task.task_code[2:]}",
        "handed_off_at": datetime.now().isoformat(),
        "summary": _build_handoff_summary(task, body.destination),
    }
    task = repository.apply_handoff(db, task, handoff)
    return _serialize_task(task)
