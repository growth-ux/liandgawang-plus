from datetime import datetime, timedelta

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.knowledge.models import KnowledgeCitation, SharedExperience
from app.knowledge.schemas import KnowledgeDraft, KnowledgeItemOut, KnowledgeReference


_INTERNAL_ACTION_MARKERS = ("verify_a", "choose_b", "ACT-", "当选择‘", "当选择'")


def repair_internal_action_code_items(db: Session) -> int:
    """把历史知识中误入库的内部动作码改写成可理解的业务经验。"""
    rows = db.query(SharedExperience).all()
    changed = 0
    for row in rows:
        text = f"{row.title}\n{row.content}"
        if not any(marker.lower() in text.lower() for marker in _INTERNAL_ACTION_MARKERS):
            continue
        if "verify_a" in text.lower() or "ACT-VERIFY" in text.upper():
            row.title = "供应方履约核验与备选方案切换"
            row.content = "当主推供应方的履约证据不足时，先完成履约核验；核验未通过或超时则启用备选方案，避免影响到货计划。"
            row.applicable_context = ["粮食采购", "供应方履约核验", "保供"]
            row.tags = ["履约核验", "备选方案", "保供"]
        else:
            row.title = "备选采购方案启用原则"
            row.content = "当主推方案不满足风险或交期要求时，及时启用备选方案，并同步安排询价和运输。"
            row.applicable_context = ["粮食采购", "备选方案", "交期保障"]
            row.tags = ["备选方案", "交期", "风险控制"]
        changed += 1
    if changed:
        db.commit()
    return changed


def normalize_title(value: str) -> str:
    return "".join(value.lower().split())


def reliability_label(row: SharedExperience) -> str:
    if row.origin == "manual":
        return "用户添加"
    if row.evidence_count > 1:
        return "已确认 · 多次验证"
    return "已确认 · 单次经验"


def _to_dict(row: SharedExperience, citation_count: int = 0) -> dict:
    return {
        "id": row.id,
        "source_type": row.source_type,
        "source_record_id": row.source_record_id,
        "knowledge_type": row.knowledge_type,
        "title": row.title,
        "content": row.content,
        "applicable_context": row.applicable_context or [],
        "tags": row.tags or [],
        "source_agent": row.source_agent,
        "source_title": row.source_title,
        "origin": row.origin,
        "evidence_count": row.evidence_count,
        "supporting_sources": row.supporting_sources or [],
        "memory_id": row.memory_id,
        "memory_sync_status": row.memory_sync_status,
        "citation_count": citation_count,
        "reliability_label": reliability_label(row),
        "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def to_schema(db: Session, row: SharedExperience) -> KnowledgeItemOut:
    count = db.query(func.count(KnowledgeCitation.id)).filter_by(knowledge_id=row.id).scalar() or 0
    return KnowledgeItemOut.model_validate(_to_dict(row, citation_count=count))


def create_or_reinforce_item(
    db: Session,
    *,
    draft: KnowledgeDraft,
    source_type: str,
    source_record_id: int | None,
    source_agent: str,
    source_title: str,
    origin: str,
) -> tuple[SharedExperience, bool]:
    source_key = f"{source_type}:{source_record_id}" if source_record_id is not None else None
    if source_record_id is not None:
        source_rows = (
            db.query(SharedExperience)
            .filter_by(source_type=source_type, source_record_id=source_record_id)
            .all()
        )
        existing_source = next(
            (row for row in source_rows if normalize_title(row.title) == normalize_title(draft.title)),
            None,
        )
        if existing_source:
            return existing_source, False

    candidates = (
        db.query(SharedExperience)
        .filter_by(knowledge_type=draft.knowledge_type, status="active")
        .all()
    )
    same_title = next(
        (row for row in candidates if normalize_title(row.title) == normalize_title(draft.title)),
        None,
    )
    if same_title is not None and source_key is not None:
        known = {f"{same_title.source_type}:{same_title.source_record_id}"}
        known.update(source["source_key"] for source in (same_title.supporting_sources or []))
        if source_key not in known:
            same_title.supporting_sources = [
                *(same_title.supporting_sources or []),
                {
                    "source_key": source_key,
                    "source_agent": source_agent,
                    "source_title": source_title,
                },
            ]
            same_title.evidence_count += 1
            db.commit()
            db.refresh(same_title)
        return same_title, False

    row = SharedExperience(
        **draft.model_dump(),
        source_type=source_type,
        source_record_id=source_record_id,
        source_agent=source_agent,
        source_title=source_title,
        origin=origin,
        status="active",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, True


def create_experience(
    db: Session,
    *,
    source_record_id: int,
    content: str,
    tags: list[str] | None = None,
    source_type: str = "costing",
) -> dict | None:
    """兼容旧调用：创建一条默认决策经验。"""
    title_prefix = "粮掌柜办事经验" if source_type == "zhanggui" else "成本测算经验"
    row, _ = create_or_reinforce_item(
        db,
        draft=KnowledgeDraft(
            knowledge_type="decision",
            title=f"{title_prefix} #{source_record_id}",
            content=content,
            applicable_context=tags or [],
            tags=tags or [],
        ),
        source_type=source_type,
        source_record_id=source_record_id,
        source_agent="zhanggui" if source_type == "zhanggui" else "suan",
        source_title=f"来源记录 #{source_record_id}",
        origin="ai",
    )
    return _to_dict(row)


def list_items(
    db: Session,
    *,
    knowledge_type: str | None = None,
    source_agent: str | None = None,
    status: str | None = "active",
    query: str = "",
) -> list[SharedExperience]:
    q = db.query(SharedExperience).order_by(SharedExperience.id.desc())
    if knowledge_type:
        q = q.filter(SharedExperience.knowledge_type == knowledge_type)
    if source_agent:
        q = q.filter(SharedExperience.source_agent == source_agent)
    if status:
        q = q.filter(SharedExperience.status == status)
    if query.strip():
        pattern = f"%{query.strip()}%"
        q = q.filter(or_(SharedExperience.title.like(pattern), SharedExperience.content.like(pattern)))
    return q.all()


def list_experiences(db: Session, *, include_ignored: bool = False) -> list[dict]:
    rows = list_items(db, status=None if include_ignored else "active")
    return [_to_dict(row) for row in rows]


def get_item(db: Session, item_id: int) -> SharedExperience | None:
    return db.get(SharedExperience, item_id)


def get_experience(db: Session, exp_id: int) -> SharedExperience | None:
    return get_item(db, exp_id)


def update_item(db: Session, row: SharedExperience, **changes) -> SharedExperience:
    allowed = {"title", "content", "applicable_context", "tags", "status"}
    for key, value in changes.items():
        if key in allowed and value is not None:
            setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


def update_experience(db: Session, exp: SharedExperience, *, content: str) -> dict:
    return _to_dict(update_item(db, exp, content=content))


def ignore_experience(db: Session, exp: SharedExperience) -> dict:
    return _to_dict(update_item(db, exp, status="ignored"))


def set_memory_state(
    db: Session,
    row: SharedExperience,
    *,
    memory_id: str | None,
    status: str,
) -> SharedExperience:
    row.memory_id = memory_id
    row.memory_sync_status = status
    db.commit()
    db.refresh(row)
    return row


def get_active_items_by_ids(db: Session, item_ids: list[int]) -> list[SharedExperience]:
    if not item_ids:
        return []
    rows = (
        db.query(SharedExperience)
        .filter(SharedExperience.id.in_(item_ids), SharedExperience.status == "active")
        .all()
    )
    by_id = {row.id: row for row in rows}
    return [by_id[item_id] for item_id in item_ids if item_id in by_id]


def search_active_items(
    db: Session,
    *,
    query: str,
    tags: list[str],
    limit: int = 10,
) -> list[SharedExperience]:
    words = [word for word in query.replace("，", " ").split() if word]
    rows = list_items(db, status="active")

    def relevant(row: SharedExperience) -> bool:
        haystack = " ".join([row.title, row.content, *(row.tags or []), *(row.applicable_context or [])])
        return any(tag in haystack for tag in tags) or any(word in haystack for word in words)

    return [row for row in rows if relevant(row)][:limit]


def rank_by_tags(rows: list[SharedExperience], tags: list[str]) -> list[SharedExperience]:
    def score(row: SharedExperience) -> tuple[int, int, int]:
        values = set((row.tags or []) + (row.applicable_context or []))
        return (sum(1 for tag in tags if tag in values), row.evidence_count, row.id)

    return sorted(rows, key=score, reverse=True)


def to_reference(row: SharedExperience, context: dict) -> KnowledgeReference:
    context_tags = context.get("tags", [])
    row_tags = set((row.tags or []) + (row.applicable_context or []))
    matched = [tag for tag in context_tags if tag in row_tags]
    reason = f"本次同为{'、'.join(matched[:3])}场景" if matched else "与当前任务语义相关"
    return KnowledgeReference(
        knowledge_id=row.id,
        title=row.title,
        content=row.content,
        source_agent=row.source_agent,
        source_title=row.source_title,
        applicable_reason=reason,
        reliability_label=reliability_label(row),
    )


def create_or_update_citation(
    db: Session,
    *,
    knowledge_id: int,
    agent_key: str,
    task_type: str,
    task_id: int,
    effect: str,
    accepted: bool,
) -> KnowledgeCitation:
    row = (
        db.query(KnowledgeCitation)
        .filter_by(
            knowledge_id=knowledge_id,
            agent_key=agent_key,
            task_type=task_type,
            task_id=task_id,
        )
        .first()
    )
    if row is None:
        row = KnowledgeCitation(
            knowledge_id=knowledge_id,
            agent_key=agent_key,
            task_type=task_type,
            task_id=task_id,
        )
        db.add(row)
    row.effect = effect
    row.accepted = accepted
    db.commit()
    db.refresh(row)
    return row


def list_citations(db: Session, knowledge_id: int) -> list[KnowledgeCitation]:
    return (
        db.query(KnowledgeCitation)
        .filter_by(knowledge_id=knowledge_id)
        .order_by(KnowledgeCitation.id.desc())
        .all()
    )


def get_overview(db: Session) -> dict:
    now = datetime.now()
    week_start = now - timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    active_rows = list_items(db, status="active")
    counts_by_type = {kind: 0 for kind in ("fact", "preference", "decision", "risk")}
    for row in active_rows:
        counts_by_type[row.knowledge_type] = counts_by_type.get(row.knowledge_type, 0) + 1
    citations_this_month = (
        db.query(func.count(KnowledgeCitation.id))
        .filter(KnowledgeCitation.accepted.is_(True), KnowledgeCitation.created_at >= month_start)
        .scalar()
        or 0
    )
    reduced_confirmations = (
        db.query(func.count(KnowledgeCitation.id))
        .filter(
            KnowledgeCitation.accepted.is_(True),
            KnowledgeCitation.effect.contains("复用已确认字段"),
        )
        .scalar()
        or 0
    )
    active_agents = (
        db.query(func.count(func.distinct(KnowledgeCitation.agent_key)))
        .filter(KnowledgeCitation.accepted.is_(True))
        .scalar()
        or 0
    )
    new_this_week = sum(1 for row in active_rows if row.created_at and row.created_at >= week_start)
    recent_rows = (
        db.query(KnowledgeCitation, SharedExperience)
        .join(SharedExperience, SharedExperience.id == KnowledgeCitation.knowledge_id)
        .order_by(KnowledgeCitation.id.desc())
        .limit(5)
        .all()
    )
    return {
        "total_items": len(active_rows),
        "new_this_week": new_this_week,
        "citations_this_month": citations_this_month,
        "active_agents": active_agents,
        "reduced_confirmations": reduced_confirmations,
        "counts_by_type": counts_by_type,
        "latest_item": _to_dict(active_rows[0]) if active_rows else None,
        "recent_citations": [
            {
                "id": citation.id,
                "knowledge_id": citation.knowledge_id,
                "knowledge_title": item.title,
                "agent_key": citation.agent_key,
                "task_type": citation.task_type,
                "task_id": citation.task_id,
                "effect": citation.effect,
                "accepted": citation.accepted,
                "created_at": citation.created_at.isoformat() if citation.created_at else None,
            }
            for citation, item in recent_rows
        ],
    }
