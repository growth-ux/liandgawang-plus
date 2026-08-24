"""企业知识统一编排：学习、同步、检索、纠偏和引用。"""

from sqlalchemy.orm import Session

from app.knowledge import extractor, memory, repository
from app.knowledge.schemas import KnowledgeDraft, KnowledgeItemOut, KnowledgeReference


class KnowledgeNotFoundError(LookupError):
    pass


def _sync(db: Session, row) -> KnowledgeItemOut:
    memory_id = memory.sync_item(row)
    repository.set_memory_state(
        db,
        row,
        memory_id=memory_id or row.memory_id,
        status="synced" if memory_id else "failed",
    )
    return repository.to_schema(db, row)


def learn_from_task(
    db: Session,
    *,
    source_agent: str,
    source_type: str,
    source_id: int,
    source_title: str,
    confirmed: bool,
    payload: dict,
) -> list[KnowledgeItemOut]:
    if not confirmed:
        return []
    # 处理早期版本遗留的内部动作码，避免它们继续被记忆检索引用。
    repository.repair_internal_action_code_items(db)
    items: list[KnowledgeItemOut] = []
    for draft in extractor.extract_drafts(source_agent, payload):
        row, _ = repository.create_or_reinforce_item(
            db,
            draft=draft,
            source_type=source_type,
            source_record_id=source_id,
            source_agent=source_agent,
            source_title=source_title,
            origin="ai",
        )
        items.append(_sync(db, row))
    return items


def search_for_task(
    db: Session,
    *,
    agent_key: str,
    task_type: str,
    task_id: int,
    query: str,
    context: dict,
    limit: int = 3,
) -> list[KnowledgeReference]:
    del agent_key, task_type, task_id  # 引用在方案真正采用知识后单独记录。
    ids = memory.search_ids(query, limit=10)
    rows = repository.get_active_items_by_ids(db, ids)
    if not rows:
        rows = repository.search_active_items(
            db,
            query=query,
            tags=context.get("tags", []),
            limit=10,
        )
    ranked = repository.rank_by_tags(rows, context.get("tags", []))[:limit]
    return [repository.to_reference(row, context) for row in ranked]


def add_manual_item(
    db: Session,
    *,
    knowledge_type: str,
    title: str,
    content: str,
    applicable_context: list[str],
    tags: list[str],
) -> KnowledgeItemOut:
    row, _ = repository.create_or_reinforce_item(
        db,
        draft=KnowledgeDraft(
            knowledge_type=knowledge_type,
            title=title,
            content=content,
            applicable_context=applicable_context,
            tags=tags,
        ),
        source_type="manual",
        source_record_id=None,
        source_agent="user",
        source_title="用户添加",
        origin="manual",
    )
    return _sync(db, row)


def update_item(db: Session, item_id: int, **changes) -> KnowledgeItemOut:
    row = repository.get_item(db, item_id)
    if row is None:
        raise KnowledgeNotFoundError(f"知识 {item_id} 不存在")

    old_memory_id = row.memory_id
    repository.update_item(db, row, **changes)
    if row.status == "ignored":
        deleted = memory.delete_item(old_memory_id)
        repository.set_memory_state(
            db,
            row,
            memory_id=None,
            status="synced" if deleted else "failed",
        )
        return repository.to_schema(db, row)
    return _sync(db, row)


def record_citation(
    db: Session,
    *,
    knowledge_id: int,
    agent_key: str,
    task_type: str,
    task_id: int,
    effect: str,
    accepted: bool,
) -> None:
    repository.create_or_update_citation(
        db,
        knowledge_id=knowledge_id,
        agent_key=agent_key,
        task_type=task_type,
        task_id=task_id,
        effect=effect,
        accepted=accepted,
    )
