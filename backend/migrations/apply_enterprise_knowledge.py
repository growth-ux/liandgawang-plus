"""幂等应用企业知识大脑增量结构。用法：uv run python migrations/apply_enterprise_knowledge.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import inspect

from app.database import engine
from app.knowledge.models import KnowledgeCitation


SHARED_COLUMNS = {
    "knowledge_type": "VARCHAR(16) NOT NULL DEFAULT 'decision'",
    "title": "VARCHAR(128) NOT NULL DEFAULT '企业经验'",
    "applicable_context": "JSON NULL",
    "source_agent": "VARCHAR(32) NOT NULL DEFAULT 'system'",
    "source_title": "VARCHAR(128) NOT NULL DEFAULT ''",
    "origin": "VARCHAR(16) NOT NULL DEFAULT 'ai'",
    "evidence_count": "INT NOT NULL DEFAULT 1",
    "supporting_sources": "JSON NULL",
    "memory_id": "VARCHAR(128) NULL",
    "memory_sync_status": "VARCHAR(16) NOT NULL DEFAULT 'pending'",
}

TRANSPORT_COLUMNS = {
    "memory_snapshot": "JSON NULL",
    "memory_effect": "TEXT NULL",
    "memory_accepted": "INT NOT NULL DEFAULT 1",
}


def _columns(table: str) -> set[str]:
    return {column["name"] for column in inspect(engine).get_columns(table)}


def apply() -> None:
    KnowledgeCitation.__table__.create(bind=engine, checkfirst=True)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "ALTER TABLE shared_experiences MODIFY COLUMN source_record_id INT NULL"
        )
        existing = _columns("shared_experiences")
        for name, definition in SHARED_COLUMNS.items():
            if name not in existing:
                connection.exec_driver_sql(
                    f"ALTER TABLE shared_experiences ADD COLUMN {name} {definition}"
                )
        connection.exec_driver_sql(
            "UPDATE shared_experiences SET applicable_context=JSON_ARRAY(), "
            "supporting_sources=JSON_ARRAY() "
            "WHERE applicable_context IS NULL OR supporting_sources IS NULL"
        )

        indexes = {index["name"] for index in inspect(engine).get_indexes("shared_experiences")}
        if "ix_shared_experiences_knowledge_type" not in indexes:
            connection.exec_driver_sql(
                "CREATE INDEX ix_shared_experiences_knowledge_type "
                "ON shared_experiences (knowledge_type)"
            )
        if "ix_shared_experiences_source_agent" not in indexes:
            connection.exec_driver_sql(
                "CREATE INDEX ix_shared_experiences_source_agent "
                "ON shared_experiences (source_agent)"
            )
        if "uq_experience_source" in indexes:
            connection.exec_driver_sql(
                "ALTER TABLE shared_experiences DROP INDEX uq_experience_source"
            )
        indexes = {index["name"] for index in inspect(engine).get_indexes("shared_experiences")}
        if "uq_experience_source_item" not in indexes:
            connection.exec_driver_sql(
                "ALTER TABLE shared_experiences ADD CONSTRAINT "
                "uq_experience_source_item UNIQUE (source_type, source_record_id, title)"
            )

        existing_transport = _columns("logistics_transport_tasks")
        for name, definition in TRANSPORT_COLUMNS.items():
            if name not in existing_transport:
                connection.exec_driver_sql(
                    f"ALTER TABLE logistics_transport_tasks ADD COLUMN {name} {definition}"
                )
        connection.exec_driver_sql(
            "UPDATE logistics_transport_tasks SET memory_snapshot=JSON_ARRAY(), "
            "memory_effect='' WHERE memory_snapshot IS NULL OR memory_effect IS NULL"
        )


if __name__ == "__main__":
    apply()
    print("企业知识大脑数据库迁移完成")
