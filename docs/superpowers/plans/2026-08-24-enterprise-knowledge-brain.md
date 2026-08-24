# 企业知识大脑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有企业知识库升级为能够从办事结果自动学习、通过 Mem0 + Milvus 跨小二检索、显式解释引用影响并支持用户纠偏的企业知识大脑。

**Architecture:** 扩展现有 `knowledge` 模块作为统一 Knowledge Service，MySQL 保存可见、可编辑、可停用的知识事实，Mem0 使用本机 Milvus 做语义召回。粮掌柜、算小二和安小二负责首批知识沉淀，所有小二复用统一检索结构；任何大模型或向量服务异常都不阻断办事主流程。

**Tech Stack:** Python 3.12、FastAPI、SQLAlchemy 2、MySQL/SQLite tests、LangChain、Mem0 OSS、Milvus 2.6.18、React 18、TypeScript 5.6、Tailwind CSS 4、Vite 6、pytest 8

**Spec:** `docs/superpowers/specs/2026-08-24-enterprise-knowledge-brain-design.md`

## Global Constraints

- 始终使用简体中文进行界面文案、代码说明和交付沟通。
- 后端继续使用 FastAPI + 本地 Docker MySQL；前端继续使用 React。
- Agent 提炼使用 LangChain；共享记忆使用 Mem0，向量存储连接本机 `milvus-standalone:19530`。
- MySQL 是知识事实源；Mem0/Milvus 只负责召回，召回结果必须回查 MySQL 的 `active` 状态。
- 历史知识不能覆盖本次实时数据或用户明确输入。
- 首版只打通粮掌柜、算小二、安小二三条沉淀链路，不建设文档 RAG、消息队列、审核流、多租户或版本树。
- Mock 数据必须符合真实粮食采购业务，不在页面出现“Mock 数据”等表述。
- 禁止自动执行 Git 提交；本计划中的每个任务以测试通过和人工审查为结束条件。
- 禁止使用 `computer-user`。

---

## File Structure

### Backend

- `backend/app/knowledge/models.py`：扩展知识卡片字段，新增引用记录模型。
- `backend/app/knowledge/schemas.py`：集中定义 Knowledge Service、API 和跨小二引用协议。
- `backend/app/knowledge/repository.py`：知识 CRUD、精确标题增强、引用记录与总览统计。
- `backend/app/knowledge/memory.py`：Mem0 OSS + Milvus 适配器，仅暴露同步、删除、语义召回三个动作。
- `backend/app/knowledge/extractor.py`：LangChain 结构化提炼与三类来源的规则降级。
- `backend/app/knowledge/service.py`：统一学习、检索、状态过滤、同步和引用记录编排。
- `backend/app/knowledge/routes.py`：知识大脑总览、列表、详情、新增、编辑、停用、检索、安小二确认沉淀 API，并兼容旧经验接口。
- `backend/app/costing/routes.py`：将算小二原有经验写入切换到 Knowledge Service。
- `backend/app/zhanggui/service.py`、`backend/app/zhanggui/schemas.py`：使用富结构引用，切换粮掌柜沉淀与检索。
- `backend/app/logistics/models.py`、`repository.py`、`routes.py`：保存运小二本次采用的知识快照，并让知识影响方案偏好但不覆盖明确输入。
- `backend/migrations/20260824_expand_enterprise_knowledge.sql`：MySQL 增量字段、引用表与物流知识快照字段。
- `backend/tests/knowledge/`：模型、仓储、提炼、Mem0 适配、服务和 API 测试。
- `backend/tests/logistics/test_knowledge_references.py`：运小二检索、引用、拒绝使用与降级测试。
- `backend/tests/zhanggui/test_goal_team.py`：粮掌柜富结构引用回归。
- `backend/.env.example`：Mem0/Milvus 配置说明。
- `backend/pyproject.toml`、`backend/uv.lock`：加入 `mem0ai`。

### Frontend

- `web/src/features/knowledge/types.ts`：知识卡片、总览、引用记录类型。
- `web/src/features/knowledge/api.ts`：企业知识库 API 客户端。
- `web/src/features/knowledge/KnowledgeOverview.tsx`：知识数量、学习动态、引用效果和四类入口。
- `web/src/features/knowledge/KnowledgeFilters.tsx`：搜索与类型、来源、状态筛选。
- `web/src/features/knowledge/KnowledgeCard.tsx`：统一知识卡片。
- `web/src/features/knowledge/KnowledgeDetailDrawer.tsx`：来源、引用轨迹、编辑和停用。
- `web/src/features/knowledge/KnowledgeReferencePanel.tsx`：小二页面统一显示适用原因和影响。
- `web/src/pages/Knowledge.tsx`：重组为知识大脑首页与四类知识列表。
- `web/src/features/an/api.ts`、`ReviewRecordsTab.tsx`、`AnPage.tsx`：将本地“已沉淀”状态改为真实确认沉淀接口。
- `web/src/features/yun/api.ts`、`types.ts`、`PlansTab.tsx`：显示运小二引用知识与“本次不采用”。
- `web/src/features/zhanggui/types.ts`、`GoalConfirmation.tsx`：显示富结构来源和适用原因。
- `web/src/features/suan/api.ts`、`types.ts`：移除页面对旧经验类型的耦合，统一使用 knowledge API。

---

### Task 1: 扩展知识持久化模型与仓储

**Files:**
- Modify: `backend/app/knowledge/models.py`
- Create: `backend/app/knowledge/schemas.py`
- Modify: `backend/app/knowledge/repository.py`
- Create: `backend/migrations/20260824_expand_enterprise_knowledge.sql`
- Create: `backend/tests/knowledge/test_models_repository.py`
- Modify: `backend/tests/conftest.py`

**Interfaces:**
- Consumes: 现有 `SharedExperience` 和 `create_experience/list_experiences` 调用。
- Produces: `KnowledgeDraft`、`KnowledgeItemOut`、`KnowledgeReference`、`create_or_reinforce_item`、`list_items`、`update_item`、`create_or_update_citation`、`get_overview`。

- [ ] **Step 1: 写知识卡片与引用仓储失败测试**

```python
# backend/tests/knowledge/test_models_repository.py
from app.knowledge import repository
from app.knowledge.schemas import KnowledgeDraft


def _draft(title="雨季优先锁定稳定车源"):
    return KnowledgeDraft(
        knowledge_type="decision",
        title=title,
        content="紧急补库且连续降雨时，优先选择可锁定车源的方案。",
        applicable_context=["玉米采购", "潍坊到厂", "雨季", "紧急补库"],
        tags=["玉米", "物流", "保供"],
    )


def test_create_and_reinforce_knowledge_item(db_session):
    first, created = repository.create_or_reinforce_item(
        db_session, draft=_draft(), source_type="zhanggui", source_record_id=1024,
        source_agent="zhanggui", source_title="200 吨玉米补库", origin="ai",
    )
    second, second_created = repository.create_or_reinforce_item(
        db_session, draft=_draft("  雨季优先锁定稳定车源  "), source_type="costing",
        source_record_id=2048, source_agent="suan", source_title="到厂成本复盘", origin="ai",
    )
    assert created is True
    assert second_created is False
    assert second.id == first.id
    assert second.evidence_count == 2
    assert second.supporting_sources[0]["source_key"] == "costing:2048"


def test_same_source_is_idempotent(db_session):
    first, _ = repository.create_or_reinforce_item(
        db_session, draft=_draft(), source_type="zhanggui", source_record_id=1024,
        source_agent="zhanggui", source_title="任务", origin="ai",
    )
    repeated, created = repository.create_or_reinforce_item(
        db_session, draft=_draft(), source_type="zhanggui", source_record_id=1024,
        source_agent="zhanggui", source_title="任务", origin="ai",
    )
    assert created is False
    assert repeated.id == first.id
    assert repeated.evidence_count == 1


def test_ignored_item_is_not_returned_and_citation_is_upserted(db_session):
    item, _ = repository.create_or_reinforce_item(
        db_session, draft=_draft(), source_type="zhanggui", source_record_id=1,
        source_agent="zhanggui", source_title="任务", origin="ai",
    )
    repository.update_item(db_session, item, status="ignored")
    assert repository.list_items(db_session, status="active") == []
    repository.create_or_update_citation(
        db_session, knowledge_id=item.id, agent_key="yun", task_type="logistics",
        task_id=9, effect="提高到货稳定性优先级", accepted=True,
    )
    repository.create_or_update_citation(
        db_session, knowledge_id=item.id, agent_key="yun", task_type="logistics",
        task_id=9, effect="增加备选车队", accepted=True,
    )
    citations = repository.list_citations(db_session, item.id)
    assert len(citations) == 1
    assert citations[0].effect == "增加备选车队"
```

- [ ] **Step 2: 运行测试，确认因新协议和模型缺失而失败**

Run: `cd backend && uv run pytest tests/knowledge/test_models_repository.py -v`

Expected: FAIL，提示 `app.knowledge.schemas`、`create_or_reinforce_item` 或新增字段不存在。

- [ ] **Step 3: 定义统一知识协议**

```python
# backend/app/knowledge/schemas.py
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
    citation_count: int
    status: Literal["active", "ignored"]
    memory_sync_status: Literal["pending", "synced", "failed"]
    created_at: str | None
    updated_at: str | None
```

- [ ] **Step 4: 扩展模型并新增引用记录唯一约束**

```python
# backend/app/knowledge/models.py（保留现有 SharedExperience 类名以减少改动）
class SharedExperience(Base):
    __tablename__ = "shared_experiences"
    __table_args__ = (UniqueConstraint("source_type", "source_record_id", name="uq_experience_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_type: Mapped[str] = mapped_column(String(32), default="manual", index=True)
    source_record_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    knowledge_type: Mapped[str] = mapped_column(String(16), default="decision", index=True)
    title: Mapped[str] = mapped_column(String(128), default="企业经验")
    content: Mapped[str] = mapped_column(Text)
    applicable_context: Mapped[list] = mapped_column(JSON, default=list)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    source_agent: Mapped[str] = mapped_column(String(32), default="system", index=True)
    source_title: Mapped[str] = mapped_column(String(128), default="")
    origin: Mapped[str] = mapped_column(String(16), default="ai")
    evidence_count: Mapped[int] = mapped_column(Integer, default=1)
    supporting_sources: Mapped[list] = mapped_column(JSON, default=list)
    memory_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    memory_sync_status: Mapped[str] = mapped_column(String(16), default="pending")
    status: Mapped[str] = mapped_column(String(16), index=True, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class KnowledgeCitation(Base):
    __tablename__ = "knowledge_citations"
    __table_args__ = (
        UniqueConstraint("knowledge_id", "agent_key", "task_type", "task_id", name="uq_knowledge_citation_task"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    knowledge_id: Mapped[int] = mapped_column(Integer, index=True)
    agent_key: Mapped[str] = mapped_column(String(32), index=True)
    task_type: Mapped[str] = mapped_column(String(32))
    task_id: Mapped[int] = mapped_column(Integer, index=True)
    effect: Mapped[str] = mapped_column(Text, default="")
    accepted: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

- [ ] **Step 5: 实现仓储的精确标题增强和引用幂等更新**

```python
# backend/app/knowledge/repository.py
def normalize_title(value: str) -> str:
    return "".join(value.lower().split())


def create_or_reinforce_item(db: Session, *, draft: KnowledgeDraft, source_type: str,
                             source_record_id: int | None, source_agent: str,
                             source_title: str, origin: str) -> tuple[SharedExperience, bool]:
    source_key = f"{source_type}:{source_record_id}" if source_record_id is not None else None
    if source_record_id is not None:
        existing_source = db.query(SharedExperience).filter_by(
            source_type=source_type, source_record_id=source_record_id
        ).first()
        if existing_source:
            return existing_source, False
    candidates = db.query(SharedExperience).filter_by(
        knowledge_type=draft.knowledge_type, status="active"
    ).all()
    same_title = next((row for row in candidates if normalize_title(row.title) == normalize_title(draft.title)), None)
    if same_title and source_key:
        known = {f"{same_title.source_type}:{same_title.source_record_id}"}
        known.update(s["source_key"] for s in (same_title.supporting_sources or []))
        if source_key not in known:
            same_title.supporting_sources = [*(same_title.supporting_sources or []), {
                "source_key": source_key, "source_agent": source_agent, "source_title": source_title,
            }]
            same_title.evidence_count += 1
            db.commit()
            db.refresh(same_title)
        return same_title, False
    row = SharedExperience(
        **draft.model_dump(), source_type=source_type, source_record_id=source_record_id,
        source_agent=source_agent, source_title=source_title, origin=origin,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, True
```

同一文件继续实现以下明确接口：

```python
def list_items(db: Session, *, knowledge_type: str | None = None,
               source_agent: str | None = None, status: str | None = "active",
               query: str = "") -> list[SharedExperience]:
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


def update_item(db: Session, row: SharedExperience, **changes) -> SharedExperience:
    allowed = {"title", "content", "applicable_context", "tags", "status"}
    for key, value in changes.items():
        if key in allowed and value is not None:
            setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


def create_or_update_citation(db: Session, *, knowledge_id: int, agent_key: str,
                              task_type: str, task_id: int, effect: str,
                              accepted: bool) -> KnowledgeCitation:
    row = db.query(KnowledgeCitation).filter_by(
        knowledge_id=knowledge_id, agent_key=agent_key,
        task_type=task_type, task_id=task_id,
    ).first()
    if row is None:
        row = KnowledgeCitation(
            knowledge_id=knowledge_id, agent_key=agent_key,
            task_type=task_type, task_id=task_id,
        )
        db.add(row)
    row.effect = effect
    row.accepted = accepted
    db.commit()
    db.refresh(row)
    return row
```

同时实现 `get_item`、`list_citations`、`set_memory_state`、`get_active_items_by_ids`、`search_active_items`、`rank_by_tags`、`to_schema` 和 `to_reference`。`get_active_items_by_ids` 按输入 ID 顺序返回且过滤非 active 行；`rank_by_tags` 按场景标签命中数降序；`to_reference` 使用命中标签生成“本次同为……场景”，无标签命中时使用“与当前任务语义相关”。

- [ ] **Step 6: 编写 MySQL 增量迁移**

`backend/migrations/20260824_expand_enterprise_knowledge.sql` 必须为旧数据填充 `knowledge_type='decision'`、`title='企业经验'`、`source_agent`，将 `source_record_id` 改为可空，创建 `knowledge_citations`，并为 `source_agent/knowledge_type/status` 建普通索引。物流知识快照字段在 Task 6 同一个迁移文件中追加，避免一天多份迁移顺序不明。

- [ ] **Step 7: 运行仓储测试和旧知识回归测试**

Run: `cd backend && uv run pytest tests/knowledge/test_models_repository.py tests/knowledge/test_experiences.py -v`

Expected: PASS；旧 `/experiences` 生命周期仍可用。

- [ ] **Step 8: 人工审查本任务差异**

Run: `git diff --check && git diff -- backend/app/knowledge backend/migrations/20260824_expand_enterprise_knowledge.sql backend/tests/knowledge`

Expected: 无空白错误、无自动提交、无无关模型改动。

---

### Task 2: 接入 Mem0 OSS 与本机 Milvus

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/uv.lock`
- Create: `backend/.env.example`
- Modify: `backend/app/knowledge/memory.py`
- Create: `backend/tests/knowledge/test_memory.py`
- Create: `backend/tests/knowledge/test_milvus_smoke.py`

**Interfaces:**
- Consumes: `SharedExperience.id/content/memory_id/status`、`MEM0_CONFIG_JSON`。
- Produces: `sync_item(item) -> str | None`、`delete_item(memory_id) -> bool`、`search_ids(query, limit=10) -> list[int]`、`reset_client_for_tests()`。

- [ ] **Step 1: 写 Mem0 结果归一化与异常降级失败测试**

```python
# backend/tests/knowledge/test_memory.py
from types import SimpleNamespace
from app.knowledge import memory


class FakeMemory:
    def add(self, messages, **kwargs):
        assert kwargs["infer"] is False
        assert kwargs["metadata"]["knowledge_id"] == 7
        return {"results": [{"id": "mem-7"}]}

    def search(self, query, **kwargs):
        return {"results": [
            {"memory": "雨季优先锁车", "metadata": {"knowledge_id": 7}, "score": 0.92},
            {"memory": "缺少知识 ID", "metadata": {}, "score": 0.8},
        ]}

    def update(self, memory_id, data):
        assert memory_id == "mem-7"

    def delete(self, memory_id):
        assert memory_id == "mem-7"


def test_sync_search_update_delete(monkeypatch):
    monkeypatch.setattr(memory, "_client", lambda: FakeMemory())
    item = SimpleNamespace(
        id=7, content="雨季优先锁车", knowledge_type="decision", memory_id=None,
    )
    assert memory.sync_item(item) == "mem-7"
    assert memory.search_ids("雨季补库", 5) == [7]
    item.memory_id = "mem-7"
    assert memory.sync_item(item) == "mem-7"
    assert memory.delete_item("mem-7") is True


def test_memory_failure_returns_safe_defaults(monkeypatch):
    class BrokenMemory:
        def search(self, *args, **kwargs):
            raise RuntimeError("milvus unavailable")
    monkeypatch.setattr(memory, "_client", lambda: BrokenMemory())
    assert memory.search_ids("玉米") == []
```

- [ ] **Step 2: 运行测试，确认旧 `memory.py` 接口不满足要求**

Run: `cd backend && uv run pytest tests/knowledge/test_memory.py -v`

Expected: FAIL，提示 `sync_item/search_ids/delete_item` 不存在。

- [ ] **Step 3: 安装 Mem0 并锁定依赖**

Run: `cd backend && uv add "mem0ai>=1.0" "pymilvus>=2.6,<2.7"`

Expected: `backend/pyproject.toml` 出现 `mem0ai>=1.0` 和 `pymilvus>=2.6,<2.7`，`backend/uv.lock` 同步更新。

- [ ] **Step 4: 实现只存结构化卡片原文的 Mem0 适配器**

```python
# backend/app/knowledge/memory.py 核心逻辑
@lru_cache(maxsize=1)
def _client():
    raw = os.getenv("MEM0_CONFIG_JSON", "").strip()
    if not raw:
        return None
    from mem0 import Memory
    return Memory.from_config(json.loads(raw))


def sync_item(item) -> str | None:
    try:
        client = _client()
        if client is None:
            return None
        if item.memory_id:
            client.update(memory_id=item.memory_id, data=item.content)
            return item.memory_id
        result = client.add(
            [{"role": "user", "content": item.content}],
            user_id="liangda-enterprise",
            metadata={"knowledge_id": item.id, "knowledge_type": item.knowledge_type},
            infer=False,
        )
        items = result.get("results", []) if isinstance(result, dict) else []
        return str(items[0]["id"]) if items else None
    except Exception:
        logger.exception("Mem0/Milvus 同步失败")
        return None


def search_ids(query: str, limit: int = 10) -> list[int]:
    try:
        client = _client()
        if client is None:
            return []
        raw = client.search(query=query, user_id="liangda-enterprise", limit=limit)
        items = raw.get("results", []) if isinstance(raw, dict) else raw if isinstance(raw, list) else []
        return [int(item["metadata"]["knowledge_id"]) for item in items
                if isinstance(item, dict) and item.get("metadata", {}).get("knowledge_id") is not None]
    except Exception:
        logger.exception("Mem0/Milvus 检索失败")
        return []
```

实现 `delete_item` 和 `reset_client_for_tests`；`delete_item` 捕获异常并返回 `False`，不能向调用方抛出基础设施异常。

- [ ] **Step 5: 增加可直接连接当前容器的配置说明**

```dotenv
# backend/.env.example
QWEN_API_KEY=
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# Mem0 配置必须包含 embedder，并保证 embedding_dims 与 Milvus embedding_model_dims 一致。
# 本机 Milvus URL: http://127.0.0.1:19530
# collection_name: liangda_enterprise_memory
MEM0_CONFIG_JSON=
```

不要在仓库保存真实 API Key。Milvus 官方配置键使用 `vector_store.provider="milvus"`、`url`、`collection_name` 和 `embedding_model_dims`。

- [ ] **Step 6: 增加按环境变量跳过的真实 Milvus 冒烟测试**

```python
# backend/tests/knowledge/test_milvus_smoke.py
import os
import pytest
from types import SimpleNamespace
from app.knowledge import memory

pytestmark = pytest.mark.skipif(
    not os.getenv("MEM0_CONFIG_JSON"), reason="需要真实 Mem0 + Milvus 配置"
)


def test_live_milvus_add_search_delete():
    item = SimpleNamespace(
        id=987654, content="潍坊雨季紧急补库优先锁定稳定车源",
        knowledge_type="decision", memory_id=None,
    )
    memory_id = memory.sync_item(item)
    assert memory_id
    assert 987654 in memory.search_ids("雨季怎样保障玉米到货", 10)
    assert memory.delete_item(memory_id) is True
```

- [ ] **Step 7: 运行适配器测试**

Run: `cd backend && uv run pytest tests/knowledge/test_memory.py -v`

Expected: PASS；未设置 `MEM0_CONFIG_JSON` 时全量 pytest 不访问外部服务。

---

### Task 3: 实现统一知识提炼与 Knowledge Service

**Files:**
- Create: `backend/app/knowledge/extractor.py`
- Create: `backend/app/knowledge/service.py`
- Modify: `backend/app/knowledge/schemas.py`
- Create: `backend/tests/knowledge/test_extractor.py`
- Create: `backend/tests/knowledge/test_service.py`

**Interfaces:**
- Consumes: Task 1 仓储、Task 2 Mem0 适配器、`QWEN_API_KEY/QWEN_MODEL/QWEN_BASE_URL`。
- Produces: `learn_from_task -> list[KnowledgeItemOut]`、`search_for_task -> list[KnowledgeReference]`、`record_citation`。

- [ ] **Step 1: 写提炼资格、规则降级和检索过滤失败测试**

```python
# backend/tests/knowledge/test_service.py
from app.knowledge import service


def test_unconfirmed_task_does_not_learn(db_session):
    result = service.learn_from_task(
        db_session, source_agent="zhanggui", source_type="zhanggui", source_id=1,
        source_title="补库任务", confirmed=False,
        payload={"variety_name": "玉米", "priority": "supply"},
    )
    assert result == []


def test_rule_fallback_learns_and_sync_failure_does_not_rollback(db_session, monkeypatch):
    monkeypatch.setattr("app.knowledge.extractor._extract_with_llm", lambda *args, **kwargs: [])
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: None)
    items = service.learn_from_task(
        db_session, source_agent="zhanggui", source_type="zhanggui", source_id=2,
        source_title="200 吨玉米补库", confirmed=True,
        payload={"variety_name": "玉米", "priority": "supply", "condition": "雨季车源紧张"},
    )
    assert len(items) == 1
    assert items[0].knowledge_type == "decision"
    assert items[0].memory_sync_status == "failed"


def test_search_filters_ignored_milvus_hit(db_session, monkeypatch):
    active = service.add_manual_item(
        db_session, knowledge_type="decision", title="保供优先",
        content="库存不足七天时优先保供", applicable_context=["玉米补库"], tags=["保供"],
    )
    ignored = service.add_manual_item(
        db_session, knowledge_type="risk", title="旧规则",
        content="已失效规则", applicable_context=["玉米补库"], tags=["保供"],
    )
    service.update_item(db_session, ignored.id, status="ignored")
    monkeypatch.setattr("app.knowledge.memory.search_ids", lambda query, limit=10: [ignored.id, active.id])
    refs = service.search_for_task(
        db_session, agent_key="yun", task_type="logistics", task_id=9,
        query="玉米紧急补库", context={"tags": ["保供", "玉米补库"]},
    )
    assert [ref.knowledge_id for ref in refs] == [active.id]
```

- [ ] **Step 2: 运行测试，确认统一服务尚不存在**

Run: `cd backend && uv run pytest tests/knowledge/test_extractor.py tests/knowledge/test_service.py -v`

Expected: FAIL，提示 `extractor/service` 模块或方法不存在。

- [ ] **Step 3: 实现三类来源的规则降级**

```python
# backend/app/knowledge/extractor.py
def _fallback(source_agent: str, payload: dict) -> list[KnowledgeDraft]:
    if source_agent == "zhanggui":
        variety = payload.get("variety_name") or "粮食"
        condition = payload.get("condition") or "库存紧张"
        return [KnowledgeDraft(
            knowledge_type="decision",
            title=f"{variety}紧急补库优先保障稳定到货",
            content=f"{condition}时，优先保障稳定到货，再比较综合成本。",
            applicable_context=[f"{variety}采购", condition, "紧急补库"],
            tags=[variety, "保供", "综合决策"],
        )]
    if source_agent == "suan":
        variety = payload.get("variety_name") or "粮食"
        return [KnowledgeDraft(
            knowledge_type="decision",
            title=f"{variety}方案需比较综合到厂成本",
            content="采购价较低的方案仍需同时比较运费、损耗、资金和质量折价。",
            applicable_context=[f"{variety}采购", "成本测算"],
            tags=[variety, "到厂成本"],
        )]
    if source_agent == "an":
        return [KnowledgeDraft(
            knowledge_type="risk",
            title=payload["title"], content=payload["experience"],
            applicable_context=[payload.get("partner_type", "合作方审查")],
            tags=["安小二", payload.get("partner_type", "合作方")],
        )]
    return []
```

- [ ] **Step 4: 使用 LangChain 结构化输出提炼最多两条知识**

`_extract_with_llm` 复用项目现有 Qwen OpenAI-compatible 配置，使用 `ChatOpenAI(model=model, api_key=api_key, base_url=base_url, temperature=0.1, timeout=120, max_retries=1).with_structured_output(KnowledgeExtraction)`。系统提示必须包含以下硬约束：只提炼已确认结果；保留选择逻辑；不得把临时价格、一次性数量写成长期规律；必须给出适用场景；最多两条；无可复用内容返回空列表。模型异常返回空列表，由 `_fallback` 接管。

```python
class KnowledgeExtraction(BaseModel):
    items: list[KnowledgeDraft] = Field(default_factory=list, max_length=2)


def extract_drafts(source_agent: str, payload: dict) -> list[KnowledgeDraft]:
    items = _extract_with_llm(source_agent, payload)
    return items[:2] if items else _fallback(source_agent, payload)
```

- [ ] **Step 5: 实现 Knowledge Service 编排**

```python
# backend/app/knowledge/service.py
def learn_from_task(db: Session, *, source_agent: str, source_type: str,
                    source_id: int, source_title: str, confirmed: bool,
                    payload: dict) -> list[KnowledgeItemOut]:
    if not confirmed:
        return []
    rows = []
    for draft in extractor.extract_drafts(source_agent, payload):
        row, _ = repository.create_or_reinforce_item(
            db, draft=draft, source_type=source_type, source_record_id=source_id,
            source_agent=source_agent, source_title=source_title, origin="ai",
        )
        memory_id = memory.sync_item(row)
        repository.set_memory_state(
            db, row, memory_id=memory_id or row.memory_id,
            status="synced" if memory_id else "failed",
        )
        rows.append(repository.to_schema(row))
    return rows


def search_for_task(db: Session, *, agent_key: str, task_type: str, task_id: int,
                    query: str, context: dict, limit: int = 3) -> list[KnowledgeReference]:
    ids = memory.search_ids(query, limit=10)
    rows = repository.get_active_items_by_ids(db, ids)
    if not rows:
        rows = repository.search_active_items(db, query=query, tags=context.get("tags", []), limit=10)
    ranked = repository.rank_by_tags(rows, context.get("tags", []))[:limit]
    return [repository.to_reference(row, context) for row in ranked]


def add_manual_item(db: Session, *, knowledge_type: str, title: str, content: str,
                    applicable_context: list[str], tags: list[str]) -> KnowledgeItemOut:
    draft = KnowledgeDraft(
        knowledge_type=knowledge_type, title=title, content=content,
        applicable_context=applicable_context, tags=tags,
    )
    row, _ = repository.create_or_reinforce_item(
        db, draft=draft, source_type="manual", source_record_id=None,
        source_agent="user", source_title="用户添加", origin="manual",
    )
    memory_id = memory.sync_item(row)
    repository.set_memory_state(
        db, row, memory_id=memory_id,
        status="synced" if memory_id else "failed",
    )
    return repository.to_schema(row)


def record_citation(db: Session, *, knowledge_id: int, agent_key: str,
                    task_type: str, task_id: int, effect: str,
                    accepted: bool) -> None:
    repository.create_or_update_citation(
        db, knowledge_id=knowledge_id, agent_key=agent_key,
        task_type=task_type, task_id=task_id, effect=effect, accepted=accepted,
    )
```

- [ ] **Step 6: 实现编辑、停用和引用记录的同步规则**

`update_item(db, item_id, **changes) -> KnowledgeItemOut` 先用 `repository.get_item` 查询，不存在时抛 `KnowledgeNotFoundError`。编辑后调用 `memory.sync_item`；停用时先提交 MySQL `ignored`，再调用 `memory.delete_item`，随后清空 `memory_id`，保证恢复使用时执行新增而不是更新已删除向量。即使删除失败，后续检索仍因 MySQL 状态过滤而安全。`record_citation` 调用 Task 1 的幂等 upsert；`accepted=False` 只更新当前任务引用，不停用知识。

- [ ] **Step 7: 运行服务测试**

Run: `cd backend && uv run pytest tests/knowledge/test_extractor.py tests/knowledge/test_service.py -v`

Expected: PASS；Qwen 和 Mem0 未配置时规则降级与 MySQL 检索仍可用。

---

### Task 4: 提供知识大脑 API 并兼容旧经验接口

**Files:**
- Modify: `backend/app/knowledge/routes.py`
- Modify: `backend/app/knowledge/schemas.py`
- Create: `backend/tests/knowledge/test_routes.py`
- Modify: `backend/tests/knowledge/test_experiences.py`

**Interfaces:**
- Consumes: Task 3 Knowledge Service。
- Produces: `/api/knowledge/overview`、`/items`、`/items/{id}`、`/items/{id}/citations`、`/search`、`/learn/an-review`；旧 `/experiences` 保持可用。

- [ ] **Step 1: 写 API 生命周期失败测试**

```python
# backend/tests/knowledge/test_routes.py
def test_manual_item_overview_edit_disable(client, monkeypatch):
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: "mem-1")
    created = client.post("/api/knowledge/items", json={
        "knowledge_type": "preference", "title": "安全库存低于七天优先保供",
        "content": "安全库存低于七天时，优先选择能够按期到货的方案。",
        "applicable_context": ["玉米补库"], "tags": ["保供", "库存"],
    })
    assert created.status_code == 200
    item_id = created.json()["id"]
    assert client.get("/api/knowledge/overview").json()["total_items"] == 1
    edited = client.patch(f"/api/knowledge/items/{item_id}", json={"content": "库存低于七天时优先保供。"})
    assert edited.json()["content"] == "库存低于七天时优先保供。"
    disabled = client.patch(f"/api/knowledge/items/{item_id}", json={"status": "ignored"})
    assert disabled.json()["status"] == "ignored"
    assert client.get("/api/knowledge/items?status=active").json()["items"] == []


def test_an_review_confirmation_learns_risk_rule(client, monkeypatch):
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: None)
    response = client.post("/api/knowledge/learn/an-review", json={
        "record_id": "AR-20260818-003", "partner_name": "齐鲁粮贸",
        "partner_type": "粮源供应方", "title": "大额集中采购需确认装车排期",
        "experience": "大于 150 吨的集中采购，应提前确认装车排期并要求临近装车复检。",
    })
    assert response.status_code == 200
    assert response.json()["items"][0]["knowledge_type"] == "risk"
```

- [ ] **Step 2: 运行测试，确认新路由不存在**

Run: `cd backend && uv run pytest tests/knowledge/test_routes.py -v`

Expected: FAIL，返回 404。

- [ ] **Step 3: 定义精简请求模型和列表查询参数**

```python
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
```

- [ ] **Step 4: 实现总览、CRUD、引用详情与检索路由**

列表只接受 `knowledge_type/source_agent/status/query`，默认 `status=active`。总览返回 `total_items/new_this_week/citations_this_month/active_agents/reduced_confirmations/latest_item/recent_citations/counts_by_type`。其中 `reduced_confirmations` 只统计 `accepted=True` 且 effect 包含“复用已确认字段”标记的记录。

- [ ] **Step 5: 实现安小二确认沉淀适配端点**

`POST /learn/an-review` 使用 `zlib.crc32(body.record_id.encode("utf-8")) & 0x7fffffff` 将字符串记录号稳定映射为 MySQL 有符号整数范围内的正整数来源 ID，然后调用：

```python
service.learn_from_task(
    db, source_agent="an", source_type="an_review", source_id=stable_id,
    source_title=f"{body.partner_name}风控复盘 {body.record_id}", confirmed=True,
    payload=body.model_dump(),
)
```

该端点是对当前安小二前端记录尚未持久化的轻量适配，不新增风险业务表。

- [ ] **Step 6: 保留旧接口兼容层**

旧 `GET/PATCH/ignore /experiences` 改为调用新的 repository/service；响应继续包含旧字段，同时允许多出新字段。现有算小二页面迁移完成前不删除接口。

- [ ] **Step 7: 运行知识 API 全部测试**

Run: `cd backend && uv run pytest tests/knowledge -v`

Expected: PASS。

---

### Task 5: 接入粮掌柜、算小二和安小二三条沉淀链路

**Files:**
- Modify: `backend/app/costing/routes.py`
- Modify: `backend/app/zhanggui/service.py`
- Modify: `backend/tests/knowledge/test_experiences.py`
- Modify: `backend/tests/zhanggui/test_graph_service.py`
- Create: `web/src/features/an/api.ts`
- Modify: `web/src/features/an/ReviewRecordsTab.tsx`
- Modify: `web/src/features/an/AnPage.tsx`

**Interfaces:**
- Consumes: `knowledge.service.learn_from_task`、`POST /api/knowledge/learn/an-review`。
- Produces: 三个来源都能生成带类型、标题、适用场景和来源的知识项。

- [ ] **Step 1: 扩展现有沉淀回归断言**

```python
def test_completed_costing_creates_structured_decision_knowledge(client, monkeypatch):
    record = _save_completed_record(client, monkeypatch)
    items = client.get("/api/knowledge/items?source_agent=suan").json()["items"]
    assert len(items) == 1
    assert items[0]["source_record_id"] == record["id"]
    assert items[0]["knowledge_type"] == "decision"
    assert items[0]["source_agent"] == "suan"
    assert items[0]["title"]
    assert items[0]["applicable_context"]
```

粮掌柜测试增加同样断言：只有计划决策确认后生成，未确认任务不生成。

- [ ] **Step 2: 运行来源回归，确认旧写入缺少结构字段**

Run: `cd backend && uv run pytest tests/knowledge/test_experiences.py tests/zhanggui/test_graph_service.py -v`

Expected: FAIL，新结构断言不满足。

- [ ] **Step 3: 替换算小二 `_maybe_create_experience`**

保留“异常不影响成本记录保存”的 `try/except`，将完成记录整理为以下 payload 后调用 Knowledge Service：

```python
payload = {
    "variety_name": next((s.get("variety_name") for s in record_dict.get("schemes", []) if s.get("variety_name")), "粮食"),
    "selected_scheme_id": record_dict.get("selected_scheme_id"),
    "calculation": record_dict.get("calculation"),
    "profit": record_dict.get("profit"),
}
knowledge_service.learn_from_task(
    db, source_agent="suan", source_type="costing", source_id=record_dict["id"],
    source_title=record_dict["title"], confirmed=record_dict.get("status") == "completed",
    payload=payload,
)
```

- [ ] **Step 4: 替换粮掌柜 `_sink_experience`**

从 mission snapshot 传入 `variety_name/priority/condition/primary_scheme_id/plan_decision`；`confirmed` 必须由 `gate_type=plan` 且 `status=confirmed` 决定，不能只依赖 mission 状态。

- [ ] **Step 5: 将安小二本地 sharedIds 改为真实 API 状态**

```ts
// web/src/features/an/api.ts
export async function learnRiskReview(record: ReviewRecord) {
  const response = await fetch("/api/knowledge/learn/an-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record_id: record.id,
      partner_name: record.partnerName,
      partner_type: record.typeLabel,
      title: `${record.partnerName}风险处置经验`,
      experience: record.experience,
    }),
  });
  if (!response.ok) throw new Error(`沉淀失败（${response.status}）`);
  return response.json();
}
```

`ReviewRecordsTab` 的按钮点击后进入 loading，成功才显示“已沉淀经验”，失败显示可重试错误。预置的 `sharedIds` 初始值改为空，不能伪装接口已保存。

- [ ] **Step 6: 运行三条来源链路测试和前端构建**

Run: `cd backend && uv run pytest tests/knowledge tests/zhanggui/test_graph_service.py tests/costing -v`

Run: `cd web && npm run build`

Expected: 两条命令都 PASS；重复点击同一安小二记录不会增加重复知识。

---

### Task 6: 为粮掌柜和运小二接入富结构检索与显式影响说明

**Files:**
- Modify: `backend/app/zhanggui/schemas.py`
- Modify: `backend/app/zhanggui/service.py`
- Modify: `backend/app/zhanggui/goal_parser.py`
- Modify: `backend/tests/zhanggui/test_goal_team.py`
- Modify: `backend/app/logistics/models.py`
- Modify: `backend/app/logistics/repository.py`
- Modify: `backend/app/logistics/routes.py`
- Modify: `backend/migrations/20260824_expand_enterprise_knowledge.sql`
- Create: `backend/tests/logistics/test_knowledge_references.py`

**Interfaces:**
- Consumes: `search_for_task` 和 `record_citation`。
- Produces: 粮掌柜 `MemoryReference` 富结构；物流任务 `memory_references`、`memory_effect`、`memory_accepted`；`POST /tasks/{id}/match` 支持 `use_memory`。

- [ ] **Step 1: 写运小二引用影响失败测试**

```python
# backend/tests/logistics/test_knowledge_references.py
def test_logistics_match_uses_relevant_memory_and_records_effect(client, monkeypatch):
    reference = KnowledgeReference(
        knowledge_id=7, title="雨季优先锁车源", content="紧急补库优先稳定车源",
        source_agent="zhanggui", source_title="玉米补库任务",
        applicable_reason="本次同为雨季紧急补库", reliability_label="已确认 · 单次经验",
    )
    monkeypatch.setattr("app.knowledge.service.search_for_task", lambda *args, **kwargs: [reference])
    task = client.post("/api/logistics/tasks", json={
        "origin": "长春", "destination": "潍坊", "variety_code": "corn",
        "quantity_tons": 200, "extra_note": "连续降雨，库存只够 5 天",
    }).json()
    matched = client.post(f"/api/logistics/tasks/{task['id']}/match", json={"use_memory": True})
    assert matched.status_code == 200
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["memory_references"][0]["knowledge_id"] == 7
    assert "稳定" in detail["task"]["memory_effect"]


def test_logistics_can_rebuild_without_memory(client, monkeypatch):
    reference = KnowledgeReference(
        knowledge_id=7, title="雨季优先锁车源", content="紧急补库优先稳定车源",
        source_agent="zhanggui", source_title="玉米补库任务",
        applicable_reason="本次同为雨季紧急补库", reliability_label="已确认 · 单次经验",
    )
    monkeypatch.setattr("app.knowledge.service.search_for_task", lambda *args, **kwargs: [reference])
    task = client.post("/api/logistics/tasks", json={
        "origin": "长春", "destination": "潍坊", "variety_code": "corn",
        "quantity_tons": 200, "decision_preference": "balanced",
        "extra_note": "连续降雨，库存只够 5 天",
    }).json()
    client.post(f"/api/logistics/tasks/{task['id']}/match", json={"use_memory": True})
    rebuilt = client.post(
        f"/api/logistics/tasks/{task['id']}/match",
        json={"decision_preference": "cost", "use_memory": False},
    )
    assert rebuilt.status_code == 200
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["memory_references"] == []
    assert detail["task"]["memory_accepted"] is False
    assert detail["task"]["decision_preference"] == "cost"
```

- [ ] **Step 2: 写粮掌柜富结构引用失败测试**

```python
def test_demo_goal_cites_structured_memory(client, monkeypatch):
    monkeypatch.setattr("app.knowledge.service.search_for_task", lambda *args, **kwargs: [KnowledgeReference(
        knowledge_id=3, title="安全库存不足优先保供", content="库存不足七天时优先保供",
        source_agent="suan", source_title="玉米成本复盘",
        applicable_reason="本次库存仅 5 天", reliability_label="已确认 · 多次验证",
    )])
    preview = client.post("/api/zhanggui/missions/preview", json={"text": "库存只够5天，采购200吨玉米到潍坊"}).json()
    assert preview["memory_references"][0]["knowledge_id"] == 3
    assert preview["memory_references"][0]["applicable_reason"] == "本次库存仅 5 天"
```

- [ ] **Step 3: 运行定向测试，确认协议缺失**

Run: `cd backend && uv run pytest tests/logistics/test_knowledge_references.py tests/zhanggui/test_goal_team.py -v`

Expected: FAIL，物流模型无知识快照字段，粮掌柜引用仍只有 `content/source`。

- [ ] **Step 4: 扩展物流任务快照和 MatchBody**

```python
# TransportTask 新字段
memory_snapshot: Mapped[list] = mapped_column(JSON, default=list)
memory_effect: Mapped[str] = mapped_column(Text, default="")
memory_accepted: Mapped[int] = mapped_column(Integer, default=1)

class MatchBody(BaseModel):
    decision_preference: DecisionPreference | None = None
    use_memory: bool = True
```

迁移文件追加三个字段。`_task_dict` 返回 `memory_references/memory_effect/memory_accepted`。

- [ ] **Step 5: 在运小二匹配前检索并应用可解释偏好**

规则保持确定性：`cost` 和 `on_time` 两种明确偏好绝不覆盖；只有当前偏好为 `balanced` 且引用内容包含“保供、稳定到货、锁定车源”之一时，才使用 `on_time` 作为均衡方案的稳定性决胜项。`memory_effect` 固定解释为“引用企业经验，在均衡决策中将到货稳定性设为决胜项；实时运价和时效仍按本次线路数据计算”。

`use_memory=False` 清空快照并重新生成方案。采用知识后，对每条引用调用 `record_citation(db, knowledge_id=reference.knowledge_id, agent_key="yun", task_type="logistics", task_id=task.id, effect=memory_effect, accepted=True)`；拒绝时使用相同主键字段并传 `accepted=False`。

- [ ] **Step 6: 将粮掌柜预览切换为统一检索服务**

`MemoryReference` 直接复用或镜像 `knowledge.schemas.KnowledgeReference` 字段。`preview_mission` 调用 `search_for_task`，将引用完整传给 `goal_parser`；`goal_parser` 仍只在用户未明确说“成本优先”时允许“保供”经验影响默认 priority。

- [ ] **Step 7: 运行物流、粮掌柜和知识回归**

Run: `cd backend && uv run pytest tests/logistics tests/zhanggui tests/knowledge -v`

Expected: PASS；Mem0 返回 ignored ID 的测试不允许其进入任务快照。

---

### Task 7: 建立企业知识库前端数据层和可复用组件

**Files:**
- Create: `web/src/features/knowledge/types.ts`
- Create: `web/src/features/knowledge/api.ts`
- Create: `web/src/features/knowledge/KnowledgeCard.tsx`
- Create: `web/src/features/knowledge/KnowledgeFilters.tsx`
- Create: `web/src/features/knowledge/KnowledgeDetailDrawer.tsx`
- Create: `web/src/features/knowledge/KnowledgeReferencePanel.tsx`
- Modify: `web/src/features/suan/api.ts`
- Modify: `web/src/features/suan/types.ts`

**Interfaces:**
- Consumes: Task 4 API 和 Task 6 富结构引用。
- Produces: `KnowledgeItem`、`KnowledgeOverviewData`、`KnowledgeReference`、统一知识 CRUD 客户端和可复用展示组件。

- [ ] **Step 1: 定义与后端一致的 TypeScript 类型**

```ts
// web/src/features/knowledge/types.ts
export type KnowledgeType = "fact" | "preference" | "decision" | "risk";
export type KnowledgeStatus = "active" | "ignored";

export interface KnowledgeReference {
  knowledge_id: number;
  title: string;
  content: string;
  source_agent: string;
  source_title: string;
  applicable_reason: string;
  reliability_label: string;
}

export interface KnowledgeItem {
  id: number;
  knowledge_type: KnowledgeType;
  title: string;
  content: string;
  applicable_context: string[];
  tags: string[];
  source_type: string;
  source_record_id: number | null;
  source_agent: string;
  source_title: string;
  origin: "ai" | "manual";
  evidence_count: number;
  citation_count: number;
  status: KnowledgeStatus;
  memory_sync_status: "pending" | "synced" | "failed";
  created_at: string | null;
  updated_at: string | null;
}

export interface KnowledgeCitation {
  id: number;
  knowledge_id: number;
  agent_key: string;
  task_type: string;
  task_id: number;
  effect: string;
  accepted: boolean;
  created_at: string;
}

export interface KnowledgeOverviewData {
  total_items: number;
  new_this_week: number;
  citations_this_month: number;
  active_agents: number;
  reduced_confirmations: number;
  counts_by_type: Record<KnowledgeType, number>;
  latest_item: KnowledgeItem | null;
  recent_citations: KnowledgeCitation[];
}

export interface KnowledgeListParams {
  knowledge_type?: KnowledgeType;
  source_agent?: string;
  status?: KnowledgeStatus;
  query?: string;
}
```

- [ ] **Step 2: 实现知识 API 客户端**

```ts
export const fetchKnowledgeOverview = () => http<KnowledgeOverviewData>("/api/knowledge/overview");
export const fetchKnowledgeItems = (params: KnowledgeListParams) =>
  http<{ items: KnowledgeItem[] }>(`/api/knowledge/items?${new URLSearchParams(clean(params))}`);
export const createKnowledgeItem = (body: KnowledgeCreate) => post<KnowledgeItem>("/api/knowledge/items", body);
export const updateKnowledgeItem = (id: number, body: KnowledgeUpdate) =>
  patch<KnowledgeItem>(`/api/knowledge/items/${id}`, body);
export const fetchKnowledgeCitations = (id: number) =>
  http<{ items: KnowledgeCitation[] }>(`/api/knowledge/items/${id}/citations`);
```

`clean` 的签名为 `clean(params: KnowledgeListParams): Record<string, string>`，只保留非空值并调用 `String(value)`，避免 URL 出现字符串 `undefined`。

- [ ] **Step 3: 实现统一 KnowledgeCard**

卡片必须显示类型、标题、内容、适用场景、来源、可靠度和状态；不显示不可解释的百分比置信度。可靠度文案由 `origin/evidence_count` 计算：`manual → 用户添加`，`evidence_count > 1 → 已确认 · 多次验证`，其余为“已确认 · 单次经验”。

- [ ] **Step 4: 实现筛选与详情抽屉**

筛选器只包含关键词、四类知识、来源小二和状态。详情抽屉加载引用记录，提供编辑和“停用/恢复使用”；停用需要二次点击确认，但不建设通用弹窗系统。

- [ ] **Step 5: 实现小二统一 KnowledgeReferencePanel**

```tsx
interface Props {
  references: KnowledgeReference[];
  effect?: string;
  onReject?: () => void;
  rejecting?: boolean;
}
```

面板分两段显示“为什么适用”和“如何影响本次建议”；没有引用时返回 `null`。`onReject` 存在时显示“本次不采用”，文案说明不会停用全局知识。

- [ ] **Step 6: 移除算小二对旧 SharedExperience 的所有权**

删除 `suan/types.ts` 内 `SharedExperience`，删除 `suan/api.ts` 的知识 API；企业知识统一由 `features/knowledge` 管理。算小二业务 API 不受影响。

- [ ] **Step 7: 使用 TypeScript 构建作为组件契约测试**

Run: `cd web && npm run build`

Expected: PASS；无 `any` 规避类型错误，无未使用 import。

---

### Task 8: 实现企业知识大脑首页和四类知识管理

**Files:**
- Create: `web/src/features/knowledge/KnowledgeOverview.tsx`
- Modify: `web/src/pages/Knowledge.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: Task 7 数据层和组件。
- Produces: `/knowledge` 的知识大脑首页、四类知识列表、手工新增、编辑、停用、来源和引用轨迹。

- [ ] **Step 1: 将页面状态收敛为三个视图**

`Knowledge.tsx` 只维护：`view: "overview" | KnowledgeType`、筛选条件、选中知识 ID、新增面板状态。删除原七个字符串 Tab 和旧 `active === 5` 特殊分支。

- [ ] **Step 2: 实现 KnowledgeOverview**

页面顶部使用真实 API 指标：已积累企业记忆、本周新学习、本月引用、参与小二、减少重复确认。中部展示“刚刚学到”和最近被引用；下方四张类型卡显示 `counts_by_type`。数字未加载时使用骨架，不写死 46、17 等演示数值。

- [ ] **Step 3: 实现四类知识列表**

类型卡进入对应列表，列表调用 `fetchKnowledgeItems({ knowledge_type, query, source_agent, status })`。空状态按类型给出真实指导，例如“完成一次成本测算或综合采购决策后，AI 会在这里沉淀可复用经验”，不出现“Mock”。

- [ ] **Step 4: 实现手工新增知识**

新增表单只要求类型、标题、内容、适用场景和标签；适用场景与标签用中文逗号切分并去空。成功后关闭表单、刷新总览和当前列表。

- [ ] **Step 5: 接通详情抽屉编辑和停用**

更新成功后同时刷新卡片和总览。接口失败展示原位错误与“重试”，不能把失败操作乐观地显示为成功。

- [ ] **Step 6: 构建并人工检查响应式布局**

Run: `cd web && npm run build`

Expected: PASS。

Manual checks:

- 1280px 宽度下总览四项指标、学习动态和类型入口层级清晰。
- 768px 下指标和卡片自动换行，无横向溢出。
- 无数据、接口失败、已停用筛选均有明确状态。

---

### Task 9: 在运小二和粮掌柜页面展示显式引用

**Files:**
- Modify: `web/src/features/yun/types.ts`
- Modify: `web/src/features/yun/api.ts`
- Modify: `web/src/features/yun/PlansTab.tsx`
- Modify: `web/src/features/yun/TransportPlanComposer.tsx`
- Modify: `web/src/features/zhanggui/types.ts`
- Modify: `web/src/features/zhanggui/GoalConfirmation.tsx`
- Modify: `web/src/features/zhanggui/MissionStart.tsx`
- Use: `web/src/features/knowledge/KnowledgeReferencePanel.tsx`

**Interfaces:**
- Consumes: Task 6 物流/粮掌柜 JSON 和 Task 7 引用组件。
- Produces: 用户能够看见适用原因、来源、建议影响，并在运小二中选择本次不采用。

- [ ] **Step 1: 扩展前端任务和粮掌柜引用类型**

```ts
export interface TransportTask {
  // 保留现有字段
  memory_references: KnowledgeReference[];
  memory_effect: string;
  memory_accepted: boolean;
}

export type MemoryReference = KnowledgeReference;
```

- [ ] **Step 2: 扩展运小二 match API**

```ts
export const matchTask = (
  taskId: number,
  options?: { decision_preference?: DecisionPreference; use_memory?: boolean },
) => post<{ matched: number; primary: boolean }>(`/api/logistics/tasks/${taskId}/match`, options);
```

更新现有调用，偏好按钮传 `{ decision_preference: next, use_memory: true }`。

`TransportPlanComposer` 首次生成方案时调用 `matchTask(task.id, { decision_preference: preference, use_memory: true })`，不再传裸字符串。

- [ ] **Step 3: 在运小二方案前展示引用和拒绝动作**

`PlansTab` 在任务摘要和四步完成状态之间渲染 `KnowledgeReferencePanel`。点击“本次不采用”调用 `matchTask(id, { use_memory: false })`，随后重新加载详情；按钮执行期间禁用，失败显示“重新生成失败，请重试”。

- [ ] **Step 4: 在方案结果旁明确引用影响**

当 `memory_effect` 非空时，在主推方案下方显示紫色科技感影响卡；文案直接使用后端确定性结果，不能让前端自行推断经验改变了什么。

- [ ] **Step 5: 升级粮掌柜目标确认引用卡**

使用 `KnowledgeReferencePanel` 替换当前只列出 `· content` 的区域。`MissionStart` 创建任务时完整传回引用数组，不能丢失 `knowledge_id/applicable_reason/reliability_label`。

- [ ] **Step 6: 构建并执行跨页面人工验收**

Run: `cd web && npm run build`

Expected: PASS。

Manual checks:

- 运小二显示来源“粮掌柜 · 200 吨玉米补库任务”和适用原因。
- “本次不采用”后方案重新生成，知识面板消失，全局知识仍为 active。
- 粮掌柜目标确认页继续遵循“用户输入优先于企业经验”。

---

### Task 10: 端到端回归、真实 Milvus 冒烟和演示数据准备

**Files:**
- Create: `backend/app/knowledge/seed.py`
- Modify: `backend/app/main.py`
- Modify: `backend/seed_db.py`
- Create: `backend/tests/knowledge/test_seed.py`
- Create: `backend/tests/knowledge/test_end_to_end.py`
- Modify: `README.md`

**Interfaces:**
- Consumes: 前九项全部能力。
- Produces: 合理的企业事实/偏好初始数据、一条可重复演示的跨小二闭环和运行说明。

- [ ] **Step 1: 写幂等种子测试**

```python
def test_seed_manual_knowledge_is_realistic_and_idempotent(db_session):
    seed_enterprise_knowledge(db_session)
    seed_enterprise_knowledge(db_session)
    items = repository.list_items(db_session, status="active")
    assert 4 <= len(items) <= 8
    assert {item.knowledge_type for item in items} >= {"fact", "preference"}
    assert all(item.origin == "manual" for item in items)
    assert all("Mock" not in item.content for item in items)
```

- [ ] **Step 2: 添加少量可信的企业事实和偏好**

只种 4–8 条，例如潍坊收货点、玉米二等质量标准、安全库存七天、正常库存下综合到厂成本优先。每条使用 `source_type="enterprise_seed"` 和固定的 `source_record_id=1..8` 调用 `create_or_reinforce_item`，来源标题标记为“企业初始化资料”，origin 为 manual；不伪造不存在的任务来源和引用次数。`main.lifespan` 与 `seed_db.py` 均调用幂等种子函数。

- [ ] **Step 3: 写跨小二端到端测试**

```python
DEMO_TEXT = "未来15天采购200吨二等玉米到潍坊，库存只够5天，不能影响生产"


def complete_demo_mission(client) -> int:
    preview = client.post("/api/zhanggui/missions/preview", json={"text": DEMO_TEXT})
    assert preview.status_code == 200
    created = client.post("/api/zhanggui/missions", json={
        "raw_request": DEMO_TEXT,
        "goal": preview.json()["goal"],
        "memory_references": preview.json()["memory_references"],
    })
    assert created.status_code == 200
    mission = created.json()
    goal = client.post(f"/api/zhanggui/missions/{mission['id']}/confirm-goal", json={
        "goal": {**mission["goal"], "budget_yuan_per_ton": "2500"},
    })
    assert goal.status_code == 200
    team = client.post(f"/api/zhanggui/missions/{mission['id']}/confirm-team", json={
        "team": goal.json()["team"],
    })
    assert team.status_code == 200
    run = client.post(f"/api/zhanggui/missions/{mission['id']}/run")
    assert run.status_code == 200
    decision = next(item for item in run.json()["decisions"] if item["status"] == "pending")
    completed = client.post(
        f"/api/zhanggui/missions/{mission['id']}/decisions/{decision['id']}",
        json={"action": "verify_a", "note": ""},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    return mission["id"]


def test_zhanggui_knowledge_is_reused_by_logistics(client, monkeypatch):
    monkeypatch.setattr("app.knowledge.memory.sync_item", lambda item: None)
    # 创建并完成粮掌柜任务，确认方案决策。
    mission_id = complete_demo_mission(client)
    learned = client.get("/api/knowledge/items?source_agent=zhanggui").json()["items"]
    assert learned and learned[0]["source_record_id"] == mission_id
    # Mem0 不可用时，运小二仍通过 MySQL 标签/关键词降级检索。
    task = client.post("/api/logistics/tasks", json={
        "origin": "长春", "destination": "潍坊", "variety_code": "corn",
        "quantity_tons": 200, "extra_note": "库存只够5天，连续降雨，不能断粮",
    }).json()
    client.post(f"/api/logistics/tasks/{task['id']}/match", json={"use_memory": True})
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["memory_references"]
    assert "稳定" in detail["task"]["memory_effect"]
```

- [ ] **Step 4: 运行后端全量测试**

Run: `cd backend && uv run pytest -v`

Expected: PASS；无 Mem0 配置时真实 Milvus 测试显示 SKIPPED，其余知识降级测试 PASS。

- [ ] **Step 5: 使用本机容器运行真实 Milvus 冒烟测试**

先确认容器：

Run: `docker ps --format '{{.Names}}\t{{.Ports}}' | rg '^milvus-standalone'`

Expected: 包含 `19530->19530/tcp`。

加载本地 `.env` 后运行：

Run: `cd backend && uv run pytest tests/knowledge/test_milvus_smoke.py -v`

Expected: PASS，不是 SKIPPED；测试结束时删除自己创建的 memory。

- [ ] **Step 6: 运行前端生产构建**

Run: `cd web && npm run build`

Expected: PASS。

- [ ] **Step 7: 更新 README 运行和演示说明**

README 增加：

- `uv sync` 安装 Mem0。
- `MEM0_CONFIG_JSON` 必须配置 Milvus URL、集合名、embedder 及匹配维度。
- 本机目标 Milvus 为 `http://127.0.0.1:19530`，集合名建议 `liangda_enterprise_memory`。
- 无 Mem0 配置时使用 MySQL 降级的预期行为。
- 竞赛演示的十步闭环：粮掌柜完成任务 → 知识大脑刚刚学到 → 运小二引用 → 修改 → 停用。

- [ ] **Step 8: 最终差异与非功能检查**

Run: `git diff --check && git status --short`

Run: `rg -n "Mock|TO.?DO|TB.?D|待实.现|假数据" web/src/pages/Knowledge.tsx web/src/features/knowledge backend/app/knowledge README.md`

Expected: 无空白错误；产品页面无暴露 Mock 的文案；无待办占位符；未产生 Git 提交。

---

## Final Acceptance Script

1. 启动 MySQL、`milvus-standalone`、后端和前端。
2. 打开粮掌柜，输入“库存只够 5 天，未来三天采购 200 吨玉米到潍坊，不能断粮”。
3. 完成目标确认、团队确认和综合方案决策。
4. 打开企业知识库，看到“刚刚学到”的决策经验及粮掌柜任务来源。
5. 单独进入运小二，创建相似运输需求。
6. 运小二显示适用的企业经验、来源和适用原因。
7. 方案结果说明经验提高了到货稳定性优先级，但运价和时效仍来自本次线路数据。
8. 返回知识库，确认引用次数和最近引用的小二发生变化。
9. 将知识适用条件编辑为“安全库存低于 7 天”，重新办理时看到新内容。
10. 停用知识后再次匹配，所有小二都不再引用；模拟 Mem0 搜索异常时任务仍可通过 MySQL 降级完成。

## Final Verification Commands

```bash
cd backend && uv run pytest -v
cd web && npm run build
git diff --check
git status --short
```

所有命令通过后才进入最终验收；仍然不自动提交。
