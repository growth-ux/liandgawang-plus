from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.knowledge import memory, repository

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class UpdateExperienceRequest(BaseModel):
    content: str


@router.get("/experiences")
def list_experiences(include_ignored: bool = False, db: Session = Depends(get_db)):
    return {"items": repository.list_experiences(db, include_ignored=include_ignored)}


@router.patch("/experiences/{exp_id}")
def update_experience(exp_id: int, body: UpdateExperienceRequest, db: Session = Depends(get_db)):
    exp = repository.get_experience(db, exp_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="经验不存在")
    result = repository.update_experience(db, exp, content=body.content)
    memory.sync_experience(exp)
    return result


@router.post("/experiences/{exp_id}/ignore")
def ignore_experience(exp_id: int, db: Session = Depends(get_db)):
    exp = repository.get_experience(db, exp_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="经验不存在")
    return repository.ignore_experience(db, exp)


class SearchRequest(BaseModel):
    query: str
    limit: int = 5


@router.post("/search")
def search(body: SearchRequest):
    results = memory.search_memories(body.query, body.limit)
    return {"results": results}
