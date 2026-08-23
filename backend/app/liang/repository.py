from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.liang.models import CandidateBasketItem, GrainListing, SourcingTask


def list_listings(db: Session, filters: dict | None = None) -> list[GrainListing]:
    """按筛选条件返回粮源，保持 seed 顺序（id 升序）。"""
    stmt = select(GrainListing).order_by(GrainListing.id)
    if filters:
        if filters.get("variety_name"):
            stmt = stmt.where(GrainListing.variety_name == filters["variety_name"])
        if filters.get("origin_province"):
            stmt = stmt.where(GrainListing.origin_province == filters["origin_province"])
        if filters.get("grade"):
            stmt = stmt.where(GrainListing.grade == filters["grade"])
        if filters.get("crop_year"):
            stmt = stmt.where(GrainListing.crop_year == filters["crop_year"])
        if filters.get("price_type"):
            stmt = stmt.where(GrainListing.price_type == filters["price_type"])
        if filters.get("delivery_type"):
            stmt = stmt.where(GrainListing.delivery_type == filters["delivery_type"])
        if filters.get("min_price") is not None:
            stmt = stmt.where(GrainListing.price >= filters["min_price"])
        if filters.get("max_price") is not None:
            stmt = stmt.where(GrainListing.price <= filters["max_price"])
        if filters.get("min_quantity") is not None:
            stmt = stmt.where(
                GrainListing.available_quantity_tons >= filters["min_quantity"]
            )
    return db.scalars(stmt).all()


def get_listing(db: Session, listing_id: int) -> GrainListing | None:
    return db.get(GrainListing, listing_id)


def list_candidate_basket(db: Session, visitor_id: str) -> list[GrainListing]:
    stmt = (
        select(GrainListing)
        .join(CandidateBasketItem, CandidateBasketItem.listing_id == GrainListing.id)
        .where(CandidateBasketItem.visitor_id == visitor_id)
        .order_by(CandidateBasketItem.created_at, CandidateBasketItem.id)
    )
    return db.scalars(stmt).all()


def add_candidate_basket_item(db: Session, visitor_id: str, listing_id: int) -> bool:
    existing = db.scalar(
        select(CandidateBasketItem).where(
            CandidateBasketItem.visitor_id == visitor_id,
            CandidateBasketItem.listing_id == listing_id,
        )
    )
    if existing is not None:
        return False
    db.add(CandidateBasketItem(visitor_id=visitor_id, listing_id=listing_id))
    db.commit()
    return True


def remove_candidate_basket_item(db: Session, visitor_id: str, listing_id: int) -> bool:
    item = db.scalar(
        select(CandidateBasketItem).where(
            CandidateBasketItem.visitor_id == visitor_id,
            CandidateBasketItem.listing_id == listing_id,
        )
    )
    if item is None:
        return False
    db.delete(item)
    db.commit()
    return True


def clear_candidate_basket(db: Session, visitor_id: str) -> None:
    items = db.scalars(select(CandidateBasketItem).where(CandidateBasketItem.visitor_id == visitor_id)).all()
    for item in items:
        db.delete(item)
    db.commit()


def _next_task_code(db: Session) -> str:
    """生成任务编号：XZ + 日期 + 当日 3 位序号。"""
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"XZ{today}-"
    count = (
        db.query(SourcingTask)
        .filter(SourcingTask.task_code.like(f"{prefix}%"))
        .count()
    )
    return f"{prefix}{count + 1:03d}"


def create_task(db: Session, need: dict, plan: dict) -> SourcingTask:
    task = SourcingTask(task_code=_next_task_code(db), status="completed", need=need, plan=plan)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def list_tasks(db: Session) -> list[SourcingTask]:
    return db.scalars(select(SourcingTask).order_by(SourcingTask.id.desc())).all()


def get_task(db: Session, task_id: int) -> SourcingTask | None:
    return db.get(SourcingTask, task_id)


def delete_task(db: Session, task_id: int) -> bool:
    task = db.get(SourcingTask, task_id)
    if task is None:
        return False
    db.delete(task)
    db.commit()
    return True


def apply_handoff(db: Session, task: SourcingTask, handoff: dict) -> SourcingTask:
    task.handoff = handoff
    task.status = "handed_off"
    db.commit()
    db.refresh(task)
    return task
