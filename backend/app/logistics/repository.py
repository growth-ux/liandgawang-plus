import json
from datetime import date

from sqlalchemy.orm import Session

from app.logistics.models import (
    Inquiry,
    LogisticsService,
    RouteSegment,
    TransportPlan,
    TransportTask,
)


def list_segments(db: Session) -> list[RouteSegment]:
    return db.query(RouteSegment).all()


def list_services(db: Session) -> list[LogisticsService]:
    return db.query(LogisticsService).all()


def list_nodes(db: Session) -> list[str]:
    rows = db.query(RouteSegment.origin, RouteSegment.destination).all()
    names = {n for row in rows for n in row}
    return sorted(names)


def create_task(db: Session, fields: dict) -> TransportTask:
    task = TransportTask(**fields)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def list_tasks(db: Session) -> list[TransportTask]:
    return db.query(TransportTask).order_by(TransportTask.id.desc()).all()


def get_task(db: Session, task_id: int) -> TransportTask | None:
    return db.get(TransportTask, task_id)


def replace_plans(db: Session, task_id: int, plans: list[dict]) -> None:
    db.query(TransportPlan).filter_by(task_id=task_id).delete()
    for p in plans:
        db.add(TransportPlan(task_id=task_id, **p))
    db.commit()


def list_plans(db: Session, task_id: int) -> list[TransportPlan]:
    return (
        db.query(TransportPlan)
        .filter_by(task_id=task_id)
        .order_by(TransportPlan.id)
        .all()
    )


def get_plan(db: Session, plan_id: int) -> TransportPlan | None:
    return db.get(TransportPlan, plan_id)


def create_inquiry(db: Session, task_id: int, plan_id: int, content: dict) -> Inquiry:
    db.query(Inquiry).filter_by(task_id=task_id).delete()
    inq = Inquiry(
        task_id=task_id,
        plan_id=plan_id,
        content_json=json.dumps(content, ensure_ascii=False),
    )
    db.add(inq)
    db.commit()
    db.refresh(inq)
    return inq


def get_inquiry(db: Session, inquiry_id: int) -> Inquiry | None:
    return db.get(Inquiry, inquiry_id)


def get_inquiry_by_task(db: Session, task_id: int) -> Inquiry | None:
    return (
        db.query(Inquiry)
        .filter_by(task_id=task_id)
        .order_by(Inquiry.id.desc())
        .first()
    )


def list_all_inquiries(db: Session) -> list[Inquiry]:
    return db.query(Inquiry).order_by(Inquiry.id.desc()).all()


def submit_inquiry(db: Session, inquiry: Inquiry, feedback: dict) -> None:
    inquiry.status = "feedback"
    inquiry.feedback_json = json.dumps(feedback, ensure_ascii=False)
    db.commit()
