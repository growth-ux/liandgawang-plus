from app.knowledge import repository
from app.knowledge.schemas import KnowledgeDraft


def _draft(title: str = "雨季优先锁定稳定车源") -> KnowledgeDraft:
    return KnowledgeDraft(
        knowledge_type="decision",
        title=title,
        content="紧急补库且连续降雨时，优先选择可锁定车源的方案。",
        applicable_context=["玉米采购", "潍坊到厂", "雨季", "紧急补库"],
        tags=["玉米", "物流", "保供"],
    )


def test_create_and_reinforce_knowledge_item(db_session):
    first, created = repository.create_or_reinforce_item(
        db_session,
        draft=_draft(),
        source_type="zhanggui",
        source_record_id=1024,
        source_agent="zhanggui",
        source_title="200 吨玉米补库",
        origin="ai",
    )
    second, second_created = repository.create_or_reinforce_item(
        db_session,
        draft=_draft("  雨季优先锁定稳定车源  "),
        source_type="costing",
        source_record_id=2048,
        source_agent="suan",
        source_title="到厂成本复盘",
        origin="ai",
    )

    assert created is True
    assert second_created is False
    assert second.id == first.id
    assert second.evidence_count == 2
    assert second.supporting_sources[0]["source_key"] == "costing:2048"


def test_same_source_is_idempotent(db_session):
    first, _ = repository.create_or_reinforce_item(
        db_session,
        draft=_draft(),
        source_type="zhanggui",
        source_record_id=1024,
        source_agent="zhanggui",
        source_title="任务",
        origin="ai",
    )
    repeated, created = repository.create_or_reinforce_item(
        db_session,
        draft=_draft(),
        source_type="zhanggui",
        source_record_id=1024,
        source_agent="zhanggui",
        source_title="任务",
        origin="ai",
    )

    assert created is False
    assert repeated.id == first.id
    assert repeated.evidence_count == 1


def test_ignored_item_is_filtered_and_citation_is_upserted(db_session):
    item, _ = repository.create_or_reinforce_item(
        db_session,
        draft=_draft(),
        source_type="zhanggui",
        source_record_id=1,
        source_agent="zhanggui",
        source_title="任务",
        origin="ai",
    )
    repository.update_item(db_session, item, status="ignored")
    assert repository.list_items(db_session, status="active") == []

    repository.create_or_update_citation(
        db_session,
        knowledge_id=item.id,
        agent_key="yun",
        task_type="logistics",
        task_id=9,
        effect="提高到货稳定性优先级",
        accepted=True,
    )
    repository.create_or_update_citation(
        db_session,
        knowledge_id=item.id,
        agent_key="yun",
        task_type="logistics",
        task_id=9,
        effect="增加备选车队",
        accepted=True,
    )

    citations = repository.list_citations(db_session, item.id)
    assert len(citations) == 1
    assert citations[0].effect == "增加备选车队"
