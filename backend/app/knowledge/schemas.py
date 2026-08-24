from typing import Literal

from pydantic import BaseModel, Field

KnowledgeType = Literal["fact", "preference", "decision", "risk"]


class KnowledgeDraft(BaseModel):
    knowledge_type: KnowledgeType
    title: str
    content: str
    applicable_context: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class KnowledgeReference(BaseModel):
    knowledge_id: int
    title: str
    content: str
    source_agent: str
    source_title: str
    applicable_reason: str
    reliability_label: str


class KnowledgeItemOut(BaseModel):
    id: int
    knowledge_type: KnowledgeType
    title: str
    content: str
    applicable_context: list[str]
    tags: list[str]
    source_type: str
    source_record_id: int | None
    source_agent: str
    source_title: str
    origin: Literal["ai", "manual"]
    evidence_count: int
    supporting_sources: list[dict] = Field(default_factory=list)
    memory_id: str | None = None
    citation_count: int = 0
    reliability_label: str = "已确认 · 单次经验"
    status: Literal["active", "ignored"]
    memory_sync_status: Literal["pending", "synced", "failed"]
    created_at: str | None
    updated_at: str | None


class ManualItemRequest(KnowledgeDraft):
    pass


class UpdateItemRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    applicable_context: list[str] | None = None
    tags: list[str] | None = None
    status: Literal["active", "ignored"] | None = None


class SearchRequest(BaseModel):
    agent_key: str
    task_type: str
    task_id: int
    query: str
    context: dict = Field(default_factory=dict)
    limit: int = Field(default=3, ge=1, le=3)


class AnReviewLearnRequest(BaseModel):
    record_id: str
    partner_name: str
    partner_type: str
    title: str
    experience: str
