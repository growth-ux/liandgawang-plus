from app.knowledge import repository
from app.knowledge.seed import seed_enterprise_knowledge


def test_seed_manual_knowledge_is_realistic_and_idempotent(db_session):
    seed_enterprise_knowledge(db_session)
    seed_enterprise_knowledge(db_session)
    items = repository.list_items(db_session, status="active")
    assert 4 <= len(items) <= 8
    assert {item.knowledge_type for item in items} >= {"fact", "preference"}
    assert all(item.origin == "manual" for item in items)
    assert all("Mock" not in item.content for item in items)

