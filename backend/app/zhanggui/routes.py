"""粮掌柜 HTTP 与 NDJSON 接口。"""

import json
import queue
import threading

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.zhanggui import repository, service
from app.zhanggui.service import MissionStateError

router = APIRouter(prefix="/api/zhanggui", tags=["zhanggui"])


class PreviewRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class MissionCreateRequest(BaseModel):
    raw_request: str = Field(min_length=1, max_length=2000)
    goal: dict
    memory_references: list = Field(default_factory=list)


class GoalConfirmRequest(BaseModel):
    goal: dict


class TeamConfirmRequest(BaseModel):
    team: list


class DecisionSubmitRequest(BaseModel):
    action: str
    note: str = ""


class MissionTerminateRequest(BaseModel):
    reason: str = Field(default="", max_length=500)


def _get_or_404(db: Session, mission_id: int):
    mission = repository.get_mission(db, mission_id)
    if mission is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return mission


def _run_service(db: Session, fn, *args, **kwargs):
    try:
        return fn(db, *args, **kwargs)
    except MissionStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/missions/preview")
def preview(req: PreviewRequest, db: Session = Depends(get_db)):
    """解析自然语言目标，返回待确认字段、问题与企业记忆引用。"""
    return _run_service(db, service.preview_mission, req.text).model_dump(mode="json")


@router.post("/missions")
def create_mission(req: MissionCreateRequest, db: Session = Depends(get_db)):
    return _run_service(
        db, service.create_mission_from_preview, req.raw_request, req.goal, req.memory_references,
    )


@router.get("/missions")
def list_missions(db: Session = Depends(get_db)):
    return repository.list_missions(db)


@router.get("/missions/{mission_id}")
def get_mission(mission_id: int, db: Session = Depends(get_db)):
    _get_or_404(db, mission_id)
    return repository.get_mission_snapshot(db, mission_id)


@router.post("/missions/{mission_id}/confirm-goal")
def confirm_goal(mission_id: int, req: GoalConfirmRequest, db: Session = Depends(get_db)):
    _get_or_404(db, mission_id)
    return _run_service(db, service.confirm_goal, mission_id, req.goal)


@router.post("/missions/{mission_id}/confirm-team")
def confirm_team(mission_id: int, req: TeamConfirmRequest, db: Session = Depends(get_db)):
    _get_or_404(db, mission_id)
    return _run_service(db, service.confirm_team, mission_id, req.team)


@router.post("/missions/{mission_id}/run")
def run_mission(mission_id: int, db: Session = Depends(get_db)):
    """同步降级入口：运行到下一人工闸门，不返回进度流。"""
    _get_or_404(db, mission_id)
    return _run_service(db, service.run_until_gate, mission_id, lambda event: None)


@router.post("/missions/{mission_id}/decisions/{decision_id}")
def submit_decision(mission_id: int, decision_id: int, req: DecisionSubmitRequest, db: Session = Depends(get_db)):
    _get_or_404(db, mission_id)
    return _run_service(db, service.submit_decision, mission_id, decision_id, req.action, req.note)


@router.post("/missions/{mission_id}/terminate")
def terminate_mission(mission_id: int, req: MissionTerminateRequest, db: Session = Depends(get_db)):
    _get_or_404(db, mission_id)
    return _run_service(db, service.terminate_mission, mission_id, req.reason)


@router.post("/missions/{mission_id}/action-tasks/{action_task_id}/cancel")
def cancel_action_task(mission_id: int, action_task_id: int, db: Session = Depends(get_db)):
    _get_or_404(db, mission_id)
    return _run_service(db, service.cancel_action_task, mission_id, action_task_id)


def _ndjson_line(event: dict) -> str:
    return json.dumps(event, ensure_ascii=False) + "\n"


@router.get("/missions/{mission_id}/events")
def mission_events(mission_id: int, db: Session = Depends(get_db)):
    """NDJSON 进度流：办理中任务实时推送事件；已到闸门只回放快照。"""
    mission = _get_or_404(db, mission_id)

    def generate():
        if mission.status != "running":
            snapshot = repository.get_mission_snapshot(db, mission_id)
            yield _ndjson_line({"type": "snapshot", "mission_id": mission_id, "agent_id": None, "payload": snapshot})
            if mission.status in ("awaiting_decision", "partially_completed"):
                yield _ndjson_line({
                    "type": "decision_required", "mission_id": mission_id, "agent_id": None,
                    "payload": {"recommendation": snapshot.get("recommendation")},
                })
            return

        events: queue.Queue = queue.Queue()

        def worker():
            try:
                service.run_until_gate(db, mission_id, events.put)
            except MissionStateError as exc:
                events.put({"type": "error", "mission_id": mission_id, "agent_id": None, "payload": {"message": str(exc)}})
            finally:
                events.put(None)

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        while True:
            event = events.get()
            if event is None:
                break
            yield _ndjson_line(event)
        thread.join(timeout=1)

    return StreamingResponse(generate(), media_type="application/x-ndjson")
