import zlib

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.knowledge import repository, service
from app.knowledge.schemas import (
    AnReviewLearnRequest,
    ManualItemRequest,
    SearchRequest,
    UpdateItemRequest,
)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="知识不存在")


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    repository.repair_internal_action_code_items(db)
    return repository.get_overview(db)


@router.get("/items")
def list_items(
    knowledge_type: str | None = None,
    source_agent: str | None = None,
    status: str | None = Query(default="active"),
    query: str = "",
    db: Session = Depends(get_db),
):
    repository.repair_internal_action_code_items(db)
    rows = repository.list_items(
        db,
        knowledge_type=knowledge_type,
        source_agent=source_agent,
        status=status,
        query=query,
    )
    return {"items": [repository.to_schema(db, row) for row in rows]}


@router.post("/items")
def create_item(body: ManualItemRequest, db: Session = Depends(get_db)):
    return service.add_manual_item(db, **body.model_dump())


@router.get("/items/{item_id}")
def get_item(item_id: int, db: Session = Depends(get_db)):
    repository.repair_internal_action_code_items(db)
    row = repository.get_item(db, item_id)
    if row is None:
        raise _not_found()
    return repository.to_schema(db, row)


@router.patch("/items/{item_id}")
def update_item(item_id: int, body: UpdateItemRequest, db: Session = Depends(get_db)):
    try:
        return service.update_item(db, item_id, **body.model_dump(exclude_none=True))
    except service.KnowledgeNotFoundError as exc:
        raise _not_found() from exc


@router.get("/items/{item_id}/citations")
def item_citations(item_id: int, db: Session = Depends(get_db)):
    if repository.get_item(db, item_id) is None:
        raise _not_found()
    return {
        "items": [
            {
                "id": row.id,
                "knowledge_id": row.knowledge_id,
                "agent_key": row.agent_key,
                "task_type": row.task_type,
                "task_id": row.task_id,
                "effect": row.effect,
                "accepted": row.accepted,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in repository.list_citations(db, item_id)
        ]
    }


@router.post("/search")
def search(body: SearchRequest, db: Session = Depends(get_db)):
    return {
        "items": service.search_for_task(
            db,
            agent_key=body.agent_key,
            task_type=body.task_type,
            task_id=body.task_id,
            query=body.query,
            context=body.context,
            limit=body.limit,
        )
    }


@router.post("/learn/an-review")
def learn_an_review(body: AnReviewLearnRequest, db: Session = Depends(get_db)):
    source_id = zlib.crc32(body.record_id.encode("utf-8")) & 0x7FFFFFFF
    items = service.learn_from_task(
        db,
        source_agent="an",
        source_type="an_review",
        source_id=source_id,
        source_title=f"{body.partner_name}风控复盘 {body.record_id}",
        confirmed=True,
        payload=body.model_dump(),
    )
    return {"items": items}


# 旧经验接口兼容层，算小二页面迁移后仍保留。
class UpdateExperienceRequest(BaseModel):
    content: str


@router.get("/experiences")
def list_experiences(include_ignored: bool = False, db: Session = Depends(get_db)):
    return {"items": repository.list_experiences(db, include_ignored=include_ignored)}


@router.patch("/experiences/{exp_id}")
def update_experience(
    exp_id: int, body: UpdateExperienceRequest, db: Session = Depends(get_db)
):
    try:
        return service.update_item(db, exp_id, content=body.content)
    except service.KnowledgeNotFoundError as exc:
        raise HTTPException(status_code=404, detail="经验不存在") from exc


@router.post("/experiences/{exp_id}/ignore")
def ignore_experience(exp_id: int, db: Session = Depends(get_db)):
    try:
        return service.update_item(db, exp_id, status="ignored")
    except service.KnowledgeNotFoundError as exc:
        raise HTTPException(status_code=404, detail="经验不存在") from exc
