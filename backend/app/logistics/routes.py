import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.logistics import llm, repository
from app.logistics.rules import MODE_NAMES, match_plans, quick_estimate_modes
from app.logistics.seed import DATA_UPDATED_AT, TODAY

router = APIRouter(prefix="/api/logistics", tags=["logistics"])

VARIETIES = [
    {"code": "corn", "name": "玉米"},
    {"code": "wheat", "name": "小麦"},
    {"code": "soybean", "name": "大豆"},
    {"code": "rice", "name": "稻谷"},
]
VARIETY_NAMES = {v["code"]: v["name"] for v in VARIETIES}

# 热门线路近期涨跌（百分比，参考口径）
HOT_CHANGES = {
    "YUN-SEG-JZ-SZ-WATER": 1.8,
    "YUN-SEG-BC-SZ-RAIL": -0.9,
    "YUN-SEG-BC-SZ-ROAD": 0.6,
    "YUN-SEG-JZ-GZ-WATER": 1.2,
    "YUN-SEG-CC-JZ-RAIL": -0.4,
    "YUN-SEG-HRB-SZ-RAIL": 2.1,
}

STATUS_LABELS = {
    "working": "整理需求中",
    "plans_ready": "有方案",
    "inquiry_draft": "询运草稿",
    "submitted": "已提交",
    "feedback": "已反馈",
}


class EstimateBody(BaseModel):
    origin: str
    destination: str
    variety_code: str = "corn"
    quantity_tons: int
    deadline_date: str | None = None


class TaskBody(EstimateBody):
    allow_split: bool = True
    source_type: str = "self"
    source_ref: str = ""
    extra_note: str = ""


class InquiryBody(BaseModel):
    plan_id: int


class ExtractBody(BaseModel):
    text: str


class ExplainBody(BaseModel):
    task_id: int
    question: str = ""


@router.get("/meta")
def get_meta(db: Session = Depends(get_db)):
    return {
        "nodes": repository.list_nodes(db),
        "varieties": VARIETIES,
        "data_updated_at": DATA_UPDATED_AT,
    }


@router.get("/hot-routes")
def get_hot_routes(db: Session = Depends(get_db)):
    items = []
    for s in repository.list_segments(db)[:8]:
        items.append(
            {
                "origin": s.origin,
                "destination": s.destination,
                "mode": s.mode,
                "mode_name": MODE_NAMES[s.mode],
                "price_low": int(s.price_low),
                "price_high": int(s.price_high),
                "days_hint": f"{s.days_low}-{s.days_high} 天",
                "change_pct": HOT_CHANGES.get(s.segment_code, 0.0),
            }
        )
    return items


@router.get("/lines")
def get_lines(db: Session = Depends(get_db)):
    """现有物流线路：路段 + 承运服务，供首页先浏览已有运力。"""
    segments = {s.segment_code: s for s in repository.list_segments(db)}
    items = []
    for svc in repository.list_services(db):
        seg = segments.get(svc.segment_code)
        if seg is None:
            continue
        items.append(
            {
                "origin": seg.origin,
                "destination": seg.destination,
                "mode": seg.mode,
                "mode_name": MODE_NAMES[seg.mode],
                "carrier": svc.carrier,
                "tonnage_min": svc.tonnage_min,
                "tonnage_max": svc.tonnage_max,
                "price_low": int(seg.price_low),
                "price_high": int(seg.price_high),
                "days_low": seg.days_low,
                "days_high": seg.days_high,
                "dispatch_window": svc.dispatch_window,
                "performance_note": svc.performance_note,
            }
        )
    return items


@router.post("/estimates")
def post_estimate(body: EstimateBody, db: Session = Depends(get_db)):
    deadline = date.fromisoformat(body.deadline_date) if body.deadline_date else None
    results = quick_estimate_modes(
        repository.list_segments(db), body.origin, body.destination, deadline, TODAY
    )
    rec = repository.create_estimate(
        db,
        body.origin,
        body.destination,
        body.variety_code,
        VARIETY_NAMES.get(body.variety_code, body.variety_code),
        body.quantity_tons,
        deadline,
        results,
    )
    return {
        "estimate_id": rec.id,
        "results": results,
        "data_updated_at": DATA_UPDATED_AT,
    }


@router.get("/estimates")
def get_estimates(db: Session = Depends(get_db)):
    return [
        {
            "id": e.id,
            "origin": e.origin,
            "destination": e.destination,
            "variety_code": e.variety_code,
            "variety_name": e.variety_name,
            "quantity_tons": e.quantity_tons,
            "deadline_date": e.deadline_date.isoformat() if e.deadline_date else None,
            "results": json.loads(e.results_json),
            "created_at": e.created_at.isoformat() if e.created_at else "",
        }
        for e in repository.list_estimates(db)
    ]


def _task_dict(t):
    return {
        "id": t.id,
        "origin": t.origin,
        "destination": t.destination,
        "variety_code": t.variety_code,
        "variety_name": t.variety_name,
        "quantity_tons": t.quantity_tons,
        "deadline_date": t.deadline_date.isoformat() if t.deadline_date else None,
        "source_type": t.source_type,
        "status": t.status,
        "status_label": STATUS_LABELS.get(t.status, t.status),
        "blocked_note": t.blocked_note,
        "created_at": t.created_at.isoformat() if t.created_at else "",
    }


def _plan_dict(p):
    return {
        "id": p.id,
        "plan_type": p.plan_type,
        "title": p.title,
        "legs": json.loads(p.legs_json),
        "price_low": int(p.price_low),
        "price_high": int(p.price_high),
        "days_low": p.days_low,
        "days_high": p.days_high,
        "transship_count": p.transship_count,
        "risk_note": p.risk_note,
        "reason": p.reason,
        "check_items": json.loads(p.check_items_json),
    }


def _inquiry_dict(inq):
    return {
        "id": inq.id,
        "task_id": inq.task_id,
        "plan_id": inq.plan_id,
        "status": inq.status,
        "content": json.loads(inq.content_json),
        "feedback": json.loads(inq.feedback_json) if inq.feedback_json else None,
    }


@router.post("/tasks")
def post_task(body: TaskBody, db: Session = Depends(get_db)):
    task = repository.create_task(
        db,
        {
            "origin": body.origin,
            "destination": body.destination,
            "variety_code": body.variety_code,
            "variety_name": VARIETY_NAMES.get(body.variety_code, body.variety_code),
            "quantity_tons": body.quantity_tons,
            "deadline_date": date.fromisoformat(body.deadline_date)
            if body.deadline_date
            else None,
            "allow_split": 1 if body.allow_split else 0,
            "source_type": body.source_type,
            "source_ref": body.source_ref,
            "extra_note": body.extra_note,
        },
    )
    return _task_dict(task)


@router.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
    return [_task_dict(t) for t in repository.list_tasks(db)]


@router.get("/tasks/{task_id}")
def get_task_detail(task_id: int, db: Session = Depends(get_db)):
    task = repository.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    inquiry = repository.get_inquiry_by_task(db, task_id)
    return {
        "task": _task_dict(task),
        "plans": [_plan_dict(p) for p in repository.list_plans(db, task_id)],
        "inquiry": _inquiry_dict(inquiry) if inquiry else None,
    }


@router.post("/tasks/{task_id}/match")
def post_match(task_id: int, db: Session = Depends(get_db)):
    task = repository.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    out = match_plans(
        repository.list_segments(db),
        repository.list_services(db),
        {
            "origin": task.origin,
            "destination": task.destination,
            "variety_code": task.variety_code,
            "quantity_tons": task.quantity_tons,
            "deadline_date": task.deadline_date,
            "allow_split": bool(task.allow_split),
            "today": TODAY,
        },
    )

    def build(plan: dict, ptype: str, reason: str, title: str) -> dict:
        return {
            "plan_type": ptype,
            "title": title,
            "legs_json": json.dumps(plan["legs"], ensure_ascii=False),
            "price_low": plan["price_low"],
            "price_high": plan["price_high"],
            "days_low": plan["days_low"],
            "days_high": plan["days_high"],
            "transship_count": plan["transship_count"],
            "risk_note": plan.get("risk_note", ""),
            "reason": reason,
            "check_items_json": json.dumps(out["check_items"], ensure_ascii=False),
        }

    plans = []
    if out["primary"]:
        plans.append(
            build(
                out["primary"],
                "primary",
                "满足全部硬条件，时效与费用组合最稳",
                f"{out['primary']['mode_name']}方案",
            )
        )
    if out["backup"]:
        b = out["backup"]
        diff = "备选"
        if out["primary"]:
            p = out["primary"]
            d_price = (b["price_low"] + b["price_high"]) // 2 - (
                p["price_low"] + p["price_high"]
            ) // 2
            d_days = b["days_high"] - p["days_high"]
            diff = (
                f"与主推相比：{'省' if d_price < 0 else '贵'}约 {abs(d_price)} 元/吨，"
                f"时效上限{'快' if d_days < 0 else '慢'} {abs(d_days)} 天"
            )
        plans.append(build(b, "backup", diff, f"{b['mode_name']}方案（备选）"))
    for r in out["rejected"]:
        plans.append(build(r, "rejected", r["reason"], f"{r['mode_name']}方案"))
    repository.replace_plans(db, task_id, plans)
    task.status = "plans_ready"
    task.blocked_note = "" if out["primary"] else "；".join(out["suggestions"])
    db.commit()
    return {"matched": len(plans), "primary": bool(out["primary"])}


@router.post("/tasks/{task_id}/inquiry")
def post_inquiry(task_id: int, body: InquiryBody, db: Session = Depends(get_db)):
    task = repository.get_task(db, task_id)
    plan = repository.get_plan(db, body.plan_id)
    if task is None or plan is None or plan.task_id != task_id:
        raise HTTPException(status_code=404, detail="任务或方案不存在")
    if plan.plan_type == "rejected":
        raise HTTPException(status_code=400, detail="未入选方案不能生成询运单")
    legs = json.loads(plan.legs_json)
    route = legs[0]["origin"] + "".join(f" → {l['destination']}" for l in legs)
    content = {
        "品种与数量": f"{task.variety_name} {task.quantity_tons} 吨",
        "发货地": task.origin,
        "收货地": task.destination,
        "最晚到货": task.deadline_date.isoformat() if task.deadline_date else "未指定",
        "选定方案": plan.title,
        "路线": route,
        "期望报价口径": "元/吨，含税含装卸",
        "需承运方确认": "实时运力与报价有效期；收货端卸货安排",
    }
    inq = repository.create_inquiry(db, task_id, plan.id, content)
    task.status = "inquiry_draft"
    db.commit()
    return _inquiry_dict(inq)


@router.post("/inquiries/{inquiry_id}/submit")
def post_submit(inquiry_id: int, db: Session = Depends(get_db)):
    inq = repository.get_inquiry(db, inquiry_id)
    if inq is None:
        raise HTTPException(status_code=404, detail="询运单不存在")
    task = repository.get_task(db, inq.task_id)
    plan = repository.get_plan(db, inq.plan_id)
    quote = (int(plan.price_low) + int(plan.price_high)) // 2
    feedback = {
        "反馈方": "粮达物流线路运营组",
        "反馈时间": TODAY.isoformat(),
        "可承运量": f"{task.quantity_tons} 吨",
        "可发运时间": "确认询运后 3 天内",
        "报价": f"{quote} 元/吨",
        "报价包含": "装车/装船与换装作业费",
        "报价不包含": "保险费与港口杂费",
        "有效期": "3 个自然日",
        "特别条件": "按确认的发运窗口排车/配船",
        "待用户确认": "发运窗口与收货端卸货能力",
    }
    repository.submit_inquiry(db, inq, feedback)
    task.status = "feedback"
    db.commit()
    return _inquiry_dict(inq)


@router.post("/extract")
def post_extract(body: ExtractBody, db: Session = Depends(get_db)):
    result = llm.extract_requirements(body.text, repository.list_nodes(db), TODAY)
    if result is None:
        return {"llm_available": False}
    return {"llm_available": True, **result}


@router.post("/explain")
def post_explain(body: ExplainBody, db: Session = Depends(get_db)):
    task = repository.get_task(db, body.task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    plans = [_plan_dict(p) for p in repository.list_plans(db, body.task_id)]
    answer = llm.explain_plans(body.question, {"task": _task_dict(task), "plans": plans})
    return {"answer": answer}
