from app.knowledge import service


def test_unconfirmed_task_does_not_learn(db_session):
    result = service.learn_from_task(
        db_session,
        source_agent="zhanggui",
        source_type="zhanggui",
        source_id=1,
        source_title="补库任务",
        confirmed=False,
        payload={"variety_name": "玉米", "priority": "supply"},
    )
    assert result == []


def test_rule_fallback_learns_and_sync_failure_does_not_rollback(
    db_session, monkeypatch
):
    monkeypatch.setattr(
        "app.knowledge.extractor._extract_with_llm", lambda *args, **kwargs: []
    )
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: None)
    items = service.learn_from_task(
        db_session,
        source_agent="zhanggui",
        source_type="zhanggui",
        source_id=2,
        source_title="200 吨玉米补库",
        confirmed=True,
        payload={
            "variety_name": "玉米",
            "priority": "supply",
            "condition": "雨季车源紧张",
        },
    )
    assert len(items) == 1
    assert items[0].knowledge_type == "decision"
    assert items[0].memory_sync_status == "failed"


def test_search_filters_ignored_milvus_hit(db_session, monkeypatch):
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: "mem-test")
    active = service.add_manual_item(
        db_session,
        knowledge_type="decision",
        title="保供优先",
        content="库存不足七天时优先保供",
        applicable_context=["玉米补库"],
        tags=["保供"],
    )
    ignored = service.add_manual_item(
        db_session,
        knowledge_type="risk",
        title="旧规则",
        content="已失效规则",
        applicable_context=["玉米补库"],
        tags=["保供"],
    )
    service.update_item(db_session, ignored.id, status="ignored")
    monkeypatch.setattr(
        "app.knowledge.memory.search_ids", lambda query, limit=10: [ignored.id, active.id]
    )
    refs = service.search_for_task(
        db_session,
        agent_key="yun",
        task_type="logistics",
        task_id=9,
        query="玉米紧急补库",
        context={"tags": ["保供", "玉米补库"]},
    )
    assert [ref.knowledge_id for ref in refs] == [active.id]


def test_disable_deletes_vector_but_remains_safe_when_delete_fails(
    db_session, monkeypatch
):
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: "mem-1")
    item = service.add_manual_item(
        db_session,
        knowledge_type="preference",
        title="优先稳定到货",
        content="库存紧张时优先稳定到货。",
        applicable_context=["紧急补库"],
        tags=["保供"],
    )
    monkeypatch.setattr("app.knowledge.memory.delete_item", lambda memory_id: False)

    disabled = service.update_item(db_session, item.id, status="ignored")

    assert disabled.status == "ignored"
    assert disabled.memory_id is None
    assert service.search_for_task(
        db_session,
        agent_key="yun",
        task_type="logistics",
        task_id=10,
        query="紧急补库",
        context={"tags": ["保供"]},
    ) == []
