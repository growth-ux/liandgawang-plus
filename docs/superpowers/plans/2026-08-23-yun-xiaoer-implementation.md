# 运小二 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/agent/yun` 从通用占位页实现为以物流市场为第一入口、支持 AI 需求整理、确定性运输方案匹配、询运人工对接和任务追踪的运小二专业服务页。

**Architecture:** 新增独立的 `backend/app/logistics` 领域模块，由 SQLAlchemy/MySQL 保存固定物流市场、运输任务、方案快照和询运单；普通 Python 完成硬过滤、路线比较和状态写入，LangChain + Qwen 只做需求抽取和结构化结果解释，失败时回退确定性模板。前端新增 `web/src/features/yun`，五个 Tab 共享当前任务状态和可收起对话侧栏，通过现有 `/agent/:id` 路由接入。

**Tech Stack:** Python 3.12、FastAPI、SQLAlchemy 2、Pydantic 2、MySQL/SQLite tests、LangChain `ChatOpenAI`、React 18、TypeScript 5.6、Tailwind CSS 4、Vite 6。

**Spec:** `docs/superpowers/specs/2026-08-23-yun-xiaoer-design.md`

## Global Constraints

- 始终使用简体中文进行产品文案、注释和交付说明；技术标识保留英文。
- 不自动执行 `git commit`；每个任务结束只做测试和人工审查检查点。
- 沿用 FastAPI、本地 Docker MySQL、React、LangChain，不引入新的状态管理、地图或工作流框架。
- 竞赛首版使用本地固定参考数据，页面展示“参考运价、预计时效、更新时间、待核实”，不直接突出底层数据生成方式。
- 默认 Tab 顺序固定为：`物流市场 → 找物流 → 运输方案 → 询运对接 → 运输任务`。
- 规则负责硬条件过滤、路线比较和主备选选择；模型不得改变规则结论、虚构物流服务或直接写数据库。
- 创建任务、选择方案、提交询运、复制任务和邀请小二均需用户确认。
- 首版不实现实时 GPS、自动下单、自动付款、承运商后台、复杂调度和全量运价预测。
- 只修改运小二所需文件，不重构无关的瞻小二或通用页面。

---

## File Structure

### Backend

- `backend/app/logistics/__init__.py`：物流领域包标识。
- `backend/app/logistics/models.py`：物流市场、任务、方案、询运单四类持久化模型。
- `backend/app/logistics/schemas.py`：请求/响应 Pydantic 模型和枚举常量。
- `backend/app/logistics/seed.py`：固定物流服务与代表性任务数据，重复执行不重复插入。
- `backend/app/logistics/repository.py`：只负责 SQLAlchemy 查询和持久化。
- `backend/app/logistics/matching.py`：纯函数完成需求校验、硬过滤、路线比较和情景重算。
- `backend/app/logistics/llm.py`：LangChain 需求抽取与规则结果解释，提供无模型回退。
- `backend/app/logistics/routes.py`：物流市场、任务、方案、询运和 Agent API。
- `backend/app/main.py`：注册 logistics 模型、seed 与 router。
- `backend/tests/logistics/`：seed、matching、routes、llm 的独立测试。
- `backend/tests/conftest.py`：将 logistics 模型注册到 SQLite 测试 metadata。

### Frontend

- `web/src/features/yun/types.ts`：物流市场、需求、方案、询运、任务和 Agent 响应类型。
- `web/src/features/yun/api.ts`：所有 `/api/logistics` 请求封装。
- `web/src/features/yun/YunPage.tsx`：五 Tab 壳、当前任务上下文、错误边界和对话侧栏。
- `web/src/features/yun/LogisticsMarketTab.tsx`：市场概览、筛选、服务表和 AI 市场观察。
- `web/src/features/yun/FindLogisticsTab.tsx`：结构化需求、自然语言提取与确认创建任务。
- `web/src/features/yun/TransportPlansTab.tsx`：主推、备选、未入选、路线段和情景比较。
- `web/src/features/yun/InquiryTab.tsx`：询运草稿、用户确认提交和反馈状态。
- `web/src/features/yun/TransportTasksTab.tsx`：任务筛选、详情时间线、阻塞和复制入口。
- `web/src/features/yun/components/RouteFlow.tsx`：复用的路线段可视化。
- `web/src/features/yun/components/YunChat.tsx`：跨 Tab 对话侧栏，仅调用只读/草稿 API。
- `web/src/pages/agents/AgentServicePage.tsx`：对 `agent.id === "yun"` 渲染 `YunPage`。
- `web/src/data/agents.ts`：更新运小二 Tab 名称。

---

### Task 1: 建立物流领域模型与固定市场数据

**Files:**
- Create: `backend/app/logistics/__init__.py`
- Create: `backend/app/logistics/models.py`
- Create: `backend/app/logistics/seed.py`
- Create: `backend/tests/logistics/__init__.py`
- Create: `backend/tests/logistics/test_seed.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces: `LogisticsService`、`TransportTask`、`TransportPlan`、`FreightInquiry` SQLAlchemy 模型。
- Produces: `seed_logistics_reference_data(db: Session) -> None`。
- Consumes: `app.database.Base` 与现有 lifespan 初始化方式。

- [ ] **Step 1: 写 seed 幂等性与代表线路失败测试**

```python
# backend/tests/logistics/test_seed.py
from app.logistics.models import LogisticsService
from app.logistics.seed import DATASET_VERSION, seed_logistics_reference_data


def test_seed_is_idempotent(db_session):
    seed_logistics_reference_data(db_session)
    first = db_session.query(LogisticsService).count()
    seed_logistics_reference_data(db_session)
    assert db_session.query(LogisticsService).count() == first
    assert first >= 8


def test_seed_covers_four_transport_modes(db_session):
    seed_logistics_reference_data(db_session)
    modes = {row.transport_mode for row in db_session.query(LogisticsService).all()}
    assert {"road", "rail", "water", "multimodal"}.issubset(modes)


def test_seed_has_northeast_to_shenzhen_candidates(db_session):
    seed_logistics_reference_data(db_session)
    rows = db_session.query(LogisticsService).filter_by(destination_region="深圳").all()
    assert len(rows) >= 4
    assert all(row.dataset_version == DATASET_VERSION for row in rows)
```

- [ ] **Step 2: 运行测试确认因模块不存在而失败**

Run: `cd backend && uv run pytest tests/logistics/test_seed.py -v`  
Expected: FAIL，错误包含 `ModuleNotFoundError: No module named 'app.logistics'`。

- [ ] **Step 3: 创建四个最小 SQLAlchemy 模型**

```python
# backend/app/logistics/models.py
class LogisticsService(Base):
    __tablename__ = "logistics_services"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    service_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    provider_name: Mapped[str] = mapped_column(String(64))
    transport_mode: Mapped[str] = mapped_column(String(16), index=True)
    origin_region: Mapped[str] = mapped_column(String(64), index=True)
    destination_region: Mapped[str] = mapped_column(String(64), index=True)
    cargo_types_json: Mapped[str] = mapped_column(Text)
    min_tons: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    max_tons: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    price_low: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_high: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_unit: Mapped[str] = mapped_column(String(24), default="元/吨")
    transit_days_low: Mapped[int] = mapped_column(Integer)
    transit_days_high: Mapped[int] = mapped_column(Integer)
    departure_window: Mapped[str] = mapped_column(String(64))
    segments_json: Mapped[str] = mapped_column(Text)
    handling_requirements: Mapped[str] = mapped_column(Text, default="")
    performance_summary: Mapped[str] = mapped_column(String(128))
    verification_items_json: Mapped[str] = mapped_column(Text)
    dataset_version: Mapped[str] = mapped_column(String(32))
    reference_updated_at: Mapped[datetime] = mapped_column(DateTime)


class TransportTask(Base):
    __tablename__ = "transport_tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    origin_region: Mapped[str] = mapped_column(String(64))
    destination_region: Mapped[str] = mapped_column(String(64))
    cargo_name: Mapped[str] = mapped_column(String(64))
    quantity_tons: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    departure_date: Mapped[date] = mapped_column(Date)
    latest_arrival_date: Mapped[date] = mapped_column(Date)
    loading_capability: Mapped[str] = mapped_column(String(128), default="")
    unloading_capability: Mapped[str] = mapped_column(String(128), default="")
    allow_transfer: Mapped[bool] = mapped_column(Boolean, default=True)
    preference: Mapped[str] = mapped_column(String(16), default="balanced")
    source_agent: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    selected_plan_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="working")
    blocked_reason: Mapped[str] = mapped_column(String(256), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
```

```python
class TransportPlan(Base):
    __tablename__ = "transport_plans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("transport_tasks.id"), index=True)
    plan_code: Mapped[str] = mapped_column(String(64), unique=True)
    plan_role: Mapped[str] = mapped_column(String(16))  # primary / backup / rejected
    service_codes_json: Mapped[str] = mapped_column(Text)
    segments_json: Mapped[str] = mapped_column(Text)
    cost_low: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cost_high: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    transit_days_low: Mapped[int] = mapped_column(Integer)
    transit_days_high: Mapped[int] = mapped_column(Integer)
    transfer_count: Mapped[int] = mapped_column(Integer, default=0)
    reason: Mapped[str] = mapped_column(Text)
    risks_json: Mapped[str] = mapped_column(Text)
    verification_items_json: Mapped[str] = mapped_column(Text)
    dataset_version: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class FreightInquiry(Base):
    __tablename__ = "freight_inquiries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("transport_tasks.id"), index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("transport_plans.id"))
    inquiry_code: Mapped[str] = mapped_column(String(64), unique=True)
    payload_json: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="submitted")
    feedback_json: Mapped[str] = mapped_column(Text, default="[]")
    submitted_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
```

- [ ] **Step 4: 写入 8–12 条固定参考服务**

在 `seed.py` 使用固定 `service_code` upsert，固定写入以下 10 条服务；所有价格单位为元/吨：

| service_code | 线路/方式 | 价格区间 | 时效 | 用途 |
|---|---|---:|---:|---|
| `YUN-V1-ROAD-CC-SZ` | 长春→深圳公路 | 410–445 | 4–5 天 | 7 天场景主推候选 |
| `YUN-V1-RAIL-CC-SZ` | 长春短驳→铁路→深圳短驳 | 335–370 | 6–7 天 | 7 天场景备选候选 |
| `YUN-V1-WATER-YK-SZ` | 长春→营口港→深圳港→收货地 | 265–305 | 9–11 天 | 低价但超期候选 |
| `YUN-V1-MULTI-CC-SZ` | 长春→铁路枢纽→公路到厂 | 355–390 | 5–7 天 | 多式联运候选 |
| `YUN-V1-ROAD-HR-SZ` | 哈尔滨→深圳公路 | 425–465 | 4–6 天 | 东北替代起点 |
| `YUN-V1-RAIL-HR-SZ` | 哈尔滨→深圳铁路+短驳 | 345–385 | 7–8 天 | 铁路边界候选 |
| `YUN-V1-ROAD-SJZ-SZ` | 石家庄→深圳公路 | 285–320 | 3–4 天 | 华北线路展示 |
| `YUN-V1-RAIL-ZZ-SZ` | 郑州→深圳铁路+短驳 | 235–270 | 5–6 天 | 华中线路展示 |
| `YUN-V1-ROAD-LIMITED` | 长春→深圳公路 | 380–400 | 4–5 天 | 最大 80 吨，吨位淘汰 |
| `YUN-V1-SEA-WINDOW` | 营口港→深圳港水运 | 225–255 | 8–10 天 | 发运窗口不适配候选 |

每条数据包含完整 `segments_json`、吨位范围、发运窗口、履约摘要和待核验事项。

```python
DATASET_VERSION = "yun-v1"
REFERENCE_UPDATED_AT = datetime(2026, 8, 23, 9, 0)

def seed_logistics_reference_data(db: Session) -> None:
    for item in SERVICES:
        exists = db.scalar(select(LogisticsService).where(
            LogisticsService.service_code == item["service_code"]
        ))
        if exists is None:
            db.add(LogisticsService(**item))
    db.commit()
```

- [ ] **Step 5: 注册模型、测试 metadata 与应用启动 seed**

在 `backend/tests/conftest.py` 增加 `import app.logistics.models`；在 `backend/app/main.py` 导入 logistics 模型、router 和 seed，并在 lifespan 中调用 `seed_logistics_reference_data(db)`。

- [ ] **Step 6: 运行测试与审查检查点**

Run: `cd backend && uv run pytest tests/logistics/test_seed.py -v`  
Expected: PASS。  
Run: `git diff --check`  
Expected: 无输出。不要提交。

---

### Task 2: 实现确定性需求校验与方案匹配

**Files:**
- Create: `backend/app/logistics/schemas.py`
- Create: `backend/app/logistics/matching.py`
- Create: `backend/tests/logistics/test_matching.py`

**Interfaces:**
- Consumes: `LogisticsService` 字段和 `TransportDemand`。
- Produces: `validate_demand(demand: TransportDemand) -> list[MissingField]`。
- Produces: `match_services(demand: TransportDemand, services: list[LogisticsService]) -> MatchResult`。
- Produces: `TransportDemand`、`MatchedPlan`、`RejectedCandidate`、`MatchResult` Pydantic 模型。

- [ ] **Step 1: 写硬过滤、主备选和无结果测试**

```python
# backend/tests/logistics/test_matching.py
def test_cheaper_but_late_service_cannot_be_recommended(service_factory):
    demand = demand_factory(days_available=7, quantity_tons="120")
    fast = service_factory(code="ROAD", price_low="410", days_high=4)
    cheap_late = service_factory(code="WATER", price_low="260", days_high=10)
    result = match_services(demand, [cheap_late, fast])
    assert result.primary.service_codes == ["ROAD"]
    assert result.rejected[0].service_code == "WATER"
    assert "超过最晚到货时间" in result.rejected[0].reason


def test_preference_changes_order_without_breaking_hard_constraints(service_factory):
    demand = demand_factory(preference="cost", days_available=10)
    result = match_services(demand, [
        service_factory(code="FAST", price_low="420", days_high=4),
        service_factory(code="VALUE", price_low="300", days_high=8),
    ])
    assert result.primary.service_codes == ["VALUE"]


def test_no_match_returns_relaxation_suggestions(service_factory):
    demand = demand_factory(days_available=2)
    result = match_services(demand, [service_factory(code="RAIL", days_low=6, days_high=7)])
    assert result.primary is None
    assert result.backup is None
    assert any("放宽到货时间" in item for item in result.relaxation_suggestions)
```

- [ ] **Step 2: 运行测试确认匹配接口尚不存在**

Run: `cd backend && uv run pytest tests/logistics/test_matching.py -v`  
Expected: FAIL，错误指向缺失的 `TransportDemand` 或 `match_services`。

- [ ] **Step 3: 定义稳定的 Pydantic 输入输出**

```python
class TransportDemand(BaseModel):
    origin_region: str = Field(min_length=1, max_length=64)
    destination_region: str = Field(min_length=1, max_length=64)
    cargo_name: str = Field(min_length=1, max_length=64)
    quantity_tons: Decimal = Field(gt=0)
    departure_date: date
    latest_arrival_date: date
    loading_capability: str = ""
    unloading_capability: str = ""
    allow_transfer: bool = True
    preference: Literal["balanced", "cost", "speed", "fewer_transfers"] = "balanced"
    source_agent: str | None = None
    source_task_id: str | None = None


class MatchResult(BaseModel):
    primary: MatchedPlan | None
    backup: MatchedPlan | None
    rejected: list[RejectedCandidate]
    relaxation_suggestions: list[str]
    dataset_version: str
```

- [ ] **Step 4: 按固定顺序实现硬条件过滤**

在 `matching.py` 逐项检查覆盖区域、品种、吨位、换装许可、发运窗口、到货天数和装卸限制；返回结构化原因，不将原因拼在数据库查询中。

```python
def rejection_reason(demand: TransportDemand, service: LogisticsService) -> str | None:
    if demand.origin_region not in service.origin_region:
        return "服务不覆盖发货地"
    if demand.destination_region not in service.destination_region:
        return "服务不覆盖收货地"
    if demand.quantity_tons > service.max_tons:
        return "可承运吨位不足"
    if not demand.allow_transfer and len(json.loads(service.segments_json)) > 1:
        return "当前需求不允许换装"
    days_available = (demand.latest_arrival_date - demand.departure_date).days + 1
    if service.transit_days_high > days_available:
        return "预计时效超过最晚到货时间"
    return None
```

- [ ] **Step 5: 实现候选排序与稳定主备选**

先计算可解释排序键，再用 `service_code` 作为最终稳定排序项。`balanced` 依次考虑到货余量、待核实项、费用中位值和换装次数；其他偏好只调整排序优先级，不跳过硬过滤。

- [ ] **Step 6: 实现情景重算纯函数**

```python
def apply_scenario(demand: TransportDemand, *, arrival_days_delta: int = 0) -> TransportDemand:
    return demand.model_copy(update={
        "latest_arrival_date": demand.latest_arrival_date + timedelta(days=arrival_days_delta)
    })
```

情景重算只返回临时 `MatchResult`，不修改原任务。

- [ ] **Step 7: 运行匹配测试与全量后端测试**

Run: `cd backend && uv run pytest tests/logistics/test_matching.py -v`  
Expected: PASS。  
Run: `cd backend && uv run pytest -q`  
Expected: 全部 PASS。不要提交。

---

### Task 3: 暴露物流市场、运输任务和方案 API

**Files:**
- Create: `backend/app/logistics/repository.py`
- Create: `backend/app/logistics/routes.py`
- Create: `backend/tests/logistics/test_routes.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: Task 1 模型、Task 2 `match_services`。
- Produces: `GET /api/logistics/market`。
- Produces: `POST /api/logistics/tasks/preview`、`POST /api/logistics/tasks`。
- Produces: `GET /api/logistics/tasks`、`GET /api/logistics/tasks/{task_id}`。
- Produces: `GET /api/logistics/tasks/{task_id}/plans`、`POST /api/logistics/tasks/{task_id}/scenario`、`POST /api/logistics/tasks/{task_id}/select-plan`。

- [ ] **Step 1: 写市场过滤、预览不落库和任务创建测试**

```python
def test_market_filters_mode_and_destination(client, seeded_logistics):
    body = client.get("/api/logistics/market", params={
        "destination_region": "深圳", "transport_mode": "road"
    }).json()
    assert body["summary"]["service_count"] >= 1
    assert all(x["transport_mode"] == "road" for x in body["services"])


def test_preview_does_not_create_task(client, db_session, demand_payload):
    response = client.post("/api/logistics/tasks/preview", json=demand_payload)
    assert response.status_code == 200
    assert db_session.query(TransportTask).count() == 0


def test_create_task_persists_stable_plans(client, db_session, demand_payload):
    response = client.post("/api/logistics/tasks", json=demand_payload)
    assert response.status_code == 200
    body = response.json()
    assert body["task"]["status"] == "has_findings"
    assert body["plans"][0]["plan_role"] == "primary"
    assert db_session.query(TransportPlan).filter_by(task_id=body["task"]["id"]).count() >= 2
```

- [ ] **Step 2: 运行路由测试确认 404**

Run: `cd backend && uv run pytest tests/logistics/test_routes.py -v`  
Expected: FAIL，接口返回 404 或导入缺失。

- [ ] **Step 3: 实现 repository 的窄接口**

```python
def list_services(db: Session, *, origin_region: str | None = None,
                  destination_region: str | None = None,
                  transport_mode: str | None = None) -> list[LogisticsService]:
    stmt = select(LogisticsService).order_by(LogisticsService.service_code)
    if origin_region:
        stmt = stmt.where(LogisticsService.origin_region.contains(origin_region))
    if destination_region:
        stmt = stmt.where(LogisticsService.destination_region.contains(destination_region))
    if transport_mode:
        stmt = stmt.where(LogisticsService.transport_mode == transport_mode)
    return list(db.scalars(stmt).all())


def list_tasks(db: Session, status: str | None = None) -> list[TransportTask]:
    stmt = select(TransportTask).order_by(TransportTask.id.desc())
    if status:
        stmt = stmt.where(TransportTask.status == status)
    return list(db.scalars(stmt).all())


def get_task(db: Session, task_id: int) -> TransportTask | None:
    return db.get(TransportTask, task_id)


def list_plans(db: Session, task_id: int) -> list[TransportPlan]:
    return list(db.scalars(
        select(TransportPlan).where(TransportPlan.task_id == task_id).order_by(TransportPlan.id)
    ).all())
```

`create_task_with_plans` 生成固定 `task_code=f"YUN-TASK-{task.id:06d}"`，将 `MatchResult.primary`、`backup` 和 `rejected` 逐条保存为 `TransportPlan`，设置任务状态为 `has_findings` 或 `needs_confirmation`，在一个 `db.commit()` 中完成并返回刷新后的任务与方案列表。

repository 不计算推荐理由，只负责查询、JSON 序列化和事务提交。

- [ ] **Step 4: 实现市场响应口径**

`GET /market` 返回 `summary`、`services`、`market_insights`、`reference_updated_at`、`dataset_version`。`market_insights` 由规则聚合：各方式服务数、最低参考价线路、7 天内可达线路和待核实项最多的线路；每条含 `text` 与 `service_codes` 依据。服务响应包含参考运价和预计时效，但前端文案不暴露 `data_kind` 或 `mock` 字样。

- [ ] **Step 5: 实现 preview/create/scenario 的共用计算路径**

```python
def _compute_match(req: TransportDemand, db: Session) -> MatchResult:
    services = repository.list_services(db)
    return match_services(req, services)

@router.post("/tasks/preview")
def preview_task(req: TransportDemand, db: Session = Depends(get_db)):
    return _compute_match(req, db)

@router.post("/tasks")
def create_task(req: TransportDemand, db: Session = Depends(get_db)):
    result = _compute_match(req, db)
    task, plans = repository.create_task_with_plans(db, req, result)
    return {"task": serialize_task(task), "plans": [serialize_plan(p) for p in plans]}
```

- [ ] **Step 6: 实现方案选择确认接口**

`POST /tasks/{task_id}/select-plan` 接受 `{ "plan_id": 12 }`，校验方案属于任务后保存 `selected_plan_id` 并返回更新后的任务；未知任务或跨任务方案返回 404/422。

- [ ] **Step 7: 运行路由测试与审查检查点**

Run: `cd backend && uv run pytest tests/logistics/test_routes.py -v`  
Expected: PASS。  
Run: `cd backend && uv run pytest -q`  
Expected: 全部 PASS。不要提交。

---

### Task 4: 实现询运单草稿、用户提交与任务时间线

**Files:**
- Modify: `backend/app/logistics/schemas.py`
- Modify: `backend/app/logistics/repository.py`
- Modify: `backend/app/logistics/routes.py`
- Create: `backend/tests/logistics/test_inquiries.py`

**Interfaces:**
- Consumes: 已选择方案的 `TransportTask`、`TransportPlan`。
- Produces: `GET /api/logistics/tasks/{task_id}/inquiry-preview`。
- Produces: `POST /api/logistics/tasks/{task_id}/inquiries`。
- Produces: `PATCH /api/logistics/inquiries/{inquiry_id}/feedback`，作为人工物流对接回写入口。
- Produces: `GET /api/logistics/tasks/{task_id}/timeline`。

- [ ] **Step 1: 写未选方案禁止提交和确认后提交测试**

```python
def test_inquiry_requires_selected_plan(client, created_task):
    response = client.post(
        f"/api/logistics/tasks/{created_task['id']}/inquiries",
        json={"contact_note": "工作日联系"},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "请先确认运输方案"


def test_submit_inquiry_snapshots_selected_plan(client, selected_task):
    preview = client.get(
        f"/api/logistics/tasks/{selected_task['id']}/inquiry-preview"
    ).json()
    response = client.post(
        f"/api/logistics/tasks/{selected_task['id']}/inquiries",
        json={**preview["draft"], "user_confirmed": True},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "submitted"
    assert response.json()["submitted_at"] is not None


def test_feedback_updates_inquiry_and_task(client, submitted_inquiry):
    response = client.patch(
        f"/api/logistics/inquiries/{submitted_inquiry['id']}/feedback",
        json={
            "provider_name": "北粮通达物流",
            "available_tons": "120",
            "departure_window": "2026-08-25 至 2026-08-26",
            "quoted_price": "432",
            "price_unit": "元/吨",
            "valid_until": "2026-08-24 18:00",
            "special_terms": "报价含干线运输，不含收货端卸粮费",
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "has_feedback"
```

- [ ] **Step 2: 运行测试确认接口缺失**

Run: `cd backend && uv run pytest tests/logistics/test_inquiries.py -v`  
Expected: FAIL。

- [ ] **Step 3: 定义询运草稿 schema**

```python
class InquiryDraft(BaseModel):
    cargo_name: str
    quantity_tons: Decimal
    origin_region: str
    destination_region: str
    departure_date: date
    latest_arrival_date: date
    route_summary: str
    service_codes: list[str]
    loading_requirements: str
    unloading_requirements: str
    quote_basis: str = "请按元/吨报价，并说明装卸、换装及其他费用是否包含"
    questions: list[str]
    contact_note: str = ""
    user_confirmed: bool = False
```

- [ ] **Step 4: 由任务和选定方案确定性生成草稿**

草稿中的货物、吨位、起终点、时间、路线和服务来自快照；`questions` 合并方案待核验项并去重。生成 preview 不写库。

- [ ] **Step 5: 提交时校验明确确认并更新时间线**

`user_confirmed` 非 `True` 返回 422；提交后创建 `FreightInquiry(status="submitted")`，任务状态改为 `submitted`。时间线从任务、方案和询运记录生成，不单独建事件表。

- [ ] **Step 6: 实现人工反馈回写的最小接口**

`PATCH /inquiries/{inquiry_id}/feedback` 接受固定 `InquiryFeedbackInput` 字段，追加到 `feedback_json`，将询运单和任务状态改为 `has_feedback`。该接口不出现在采购用户的主操作区，只为人工对接结果回写和竞赛演示提供边界明确的入口。

- [ ] **Step 7: 运行询运与全量测试**

Run: `cd backend && uv run pytest tests/logistics/test_inquiries.py -v`  
Expected: PASS。  
Run: `cd backend && uv run pytest -q`  
Expected: 全部 PASS。不要提交。

---

### Task 5: 接入 LangChain 需求抽取与方案解释降级

**Files:**
- Create: `backend/app/logistics/llm.py`
- Modify: `backend/app/logistics/routes.py`
- Create: `backend/tests/logistics/test_llm.py`

**Interfaces:**
- Consumes: `TransportDemand` 草稿、`MatchResult`、现有 Qwen 环境变量。
- Produces: `extract_demand(message: str, current: dict) -> DemandExtraction`。
- Produces: `explain_match(result: MatchResult, demand: TransportDemand) -> AgentExplanation`。
- Produces: `POST /api/logistics/agent/demand-preview` 与 `POST /api/logistics/agent/explain`。

- [ ] **Step 1: 写无 API key 时的确定性降级测试**

```python
def test_demand_preview_falls_back_without_qwen(monkeypatch):
    monkeypatch.setattr("app.logistics.llm.QWEN_API_KEY", "")
    result = extract_demand("120吨玉米从长春运到深圳，7天内到", {})
    assert result.extracted["quantity_tons"] == "120"
    assert result.extracted["cargo_name"] == "玉米"
    assert "departure_date" in result.missing_fields


def test_explanation_never_changes_primary(monkeypatch, match_result, demand):
    monkeypatch.setattr("app.logistics.llm.QWEN_API_KEY", "")
    explanation = explain_match(match_result, demand)
    assert explanation.primary_plan_code == match_result.primary.plan_code
    assert explanation.source == "template"
```

- [ ] **Step 2: 运行测试确认 LLM 适配器缺失**

Run: `cd backend && uv run pytest tests/logistics/test_llm.py -v`  
Expected: FAIL。

- [ ] **Step 3: 定义结构化输出和系统提示**

```python
class DemandExtraction(BaseModel):
    extracted: dict[str, str | bool]
    missing_fields: list[str]
    confirmation_summary: str
    source: Literal["qwen", "template"]


SYSTEM_PROMPT = (
    "你是粮达网 Plus 的物流助手运小二。你的任务是从用户表达中提取运输条件，"
    "或解释普通 Python 已经生成的方案结果。不得编造承运商、运价、运力或路线；"
    "不得修改主推与备选；缺少信息必须明确指出。"
)
```

- [ ] **Step 4: 复用现有 Qwen 配置实现 LangChain structured output**

沿用 `QWEN_API_KEY`、`QWEN_MODEL`、`QWEN_BASE_URL` 和 `ChatOpenAI.with_structured_output`。调用失败记录日志并返回模板结果，不让异常传播到核心匹配接口。

- [ ] **Step 5: 实现最小中文回退解析**

回退只提取明确出现的吨位、玉米/小麦/稻谷/大豆、常见起终点和“允许/不允许换装”；日期无法可靠解析时列入缺失字段，不猜测具体日期。

- [ ] **Step 6: 暴露只读/草稿 Agent API**

`demand-preview` 只返回抽取与确认卡，不创建任务；`explain` 读取指定任务及其方案后返回解释，不修改方案或任务。

- [ ] **Step 7: 运行 LLM 降级与全量测试**

Run: `cd backend && uv run pytest tests/logistics/test_llm.py -v`  
Expected: PASS，无需真实 API key。  
Run: `cd backend && uv run pytest -q`  
Expected: 全部 PASS。不要提交。

---

### Task 6: 建立运小二前端类型、API 与五 Tab 页面壳

**Files:**
- Create: `web/src/features/yun/types.ts`
- Create: `web/src/features/yun/api.ts`
- Create: `web/src/features/yun/YunPage.tsx`
- Modify: `web/src/pages/agents/AgentServicePage.tsx`
- Modify: `web/src/data/agents.ts`

**Interfaces:**
- Consumes: Tasks 3–5 的 `/api/logistics` JSON。
- Produces: `YunPage`、`YUN_TABS`、`LogisticsContextState`。
- Produces: `fetchLogisticsMarket`、`previewDemand`、`createTransportTask`、`fetchTaskPlans`、`previewInquiry`、`submitInquiry` 等 API 函数。

- [ ] **Step 1: 将运小二 Tab 文案更新为确认顺序**

```ts
// web/src/data/agents.ts
tabs: ["物流市场", "找物流", "运输方案", "询运对接", "运输任务"],
```

- [ ] **Step 2: 定义与后端一致的 TypeScript 类型**

```ts
export type TransportMode = "road" | "rail" | "water" | "multimodal";
export type TaskStatus = "working" | "needs_confirmation" | "has_findings" | "submitted" | "has_feedback" | "completed";

export interface TransportDemand {
  origin_region: string;
  destination_region: string;
  cargo_name: string;
  quantity_tons: string;
  departure_date: string;
  latest_arrival_date: string;
  loading_capability: string;
  unloading_capability: string;
  allow_transfer: boolean;
  preference: "balanced" | "cost" | "speed" | "fewer_transfers";
  source_agent?: string | null;
  source_task_id?: string | null;
}
```

```ts
export interface RouteSegment { from: string; to: string; mode: TransportMode; days_low: number; days_high: number; }
export interface LogisticsService { service_code: string; provider_name: string; transport_mode: TransportMode; origin_region: string; destination_region: string; price_low: string; price_high: string; price_unit: string; transit_days_low: number; transit_days_high: number; min_tons: string; max_tons: string; departure_window: string; segments: RouteSegment[]; performance_summary: string; verification_items: string[]; }
export interface MarketInsight { text: string; service_codes: string[]; }
export interface MarketResponse { summary: { service_count: number; mode_counts: Record<TransportMode, number>; price_low: string; price_high: string; }; services: LogisticsService[]; market_insights: MarketInsight[]; reference_updated_at: string; dataset_version: string; }
export interface TransportTask extends TransportDemand { id: number; task_code: string; selected_plan_id: number | null; status: TaskStatus; blocked_reason: string; source_agent?: string | null; source_task_id?: string | null; created_at: string; updated_at: string; }
export interface TransportPlan { id: number; task_id: number; plan_code: string; plan_role: "primary" | "backup" | "rejected"; service_codes: string[]; segments: RouteSegment[]; cost_low: string; cost_high: string; transit_days_low: number; transit_days_high: number; transfer_count: number; reason: string; risks: string[]; verification_items: string[]; }
export type PlanCandidate = Omit<TransportPlan, "id" | "task_id">;
export interface RejectedCandidate { service_code: string; reason: string; }
export interface MatchResult { primary: PlanCandidate | null; backup: PlanCandidate | null; rejected: RejectedCandidate[]; relaxation_suggestions: string[]; dataset_version: string; }
export interface InquiryDraft { cargo_name: string; quantity_tons: string; origin_region: string; destination_region: string; departure_date: string; latest_arrival_date: string; route_summary: string; service_codes: string[]; loading_requirements: string; unloading_requirements: string; quote_basis: string; questions: string[]; contact_note: string; user_confirmed: boolean; }
export interface FreightInquiry { id: number; task_id: number; plan_id: number; inquiry_code: string; status: "submitted" | "contacting" | "has_feedback" | "completed"; draft: InquiryDraft; feedback: Array<Record<string, string>>; submitted_at: string; }
export interface TimelineItem { kind: "task_created" | "plans_generated" | "plan_selected" | "inquiry_submitted" | "feedback_received" | "completed"; title: string; description: string; occurred_at: string; }
export interface DemandExtraction { extracted: Partial<TransportDemand>; missing_fields: string[]; confirmation_summary: string; source: "qwen" | "template"; }
export interface AgentExplanation { primary_plan_code: string | null; summary: string; tradeoffs: string[]; source: "qwen" | "template"; }
```

- [ ] **Step 3: 实现统一 fetch 错误读取**

```ts
async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `请求失败（${response.status}）`);
  }
  return response.json();
}
```

- [ ] **Step 4: 创建 `YunPage` 五 Tab 壳与共享任务状态**

```tsx
const TABS = ["物流市场", "找物流", "运输方案", "询运对接", "运输任务"] as const;

export default function YunPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("物流市场");
  const [currentTask, setCurrentTask] = useState<TransportTask | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  // 头部沿用 ZhanPage 的 AgentSwitcher 和最大宽度；正文按 activeTab 渲染。
}
```

有任务时头部显示起终点、吨位、到货要求、状态和阻塞；没有任务时只显示运小二身份。

- [ ] **Step 5: 在通用服务页接入运小二**

```tsx
import YunPage from "../../features/yun/YunPage";

if (agent.id === "zhan") return <ZhanPage />;
if (agent.id === "yun") return <YunPage />;
```

- [ ] **Step 6: 运行 TypeScript 构建检查**

Run: `cd web && npm run build`  
Expected: PASS，`/agent/yun` 不再落入通用占位页。不要提交。

---

### Task 7: 实现物流市场与找物流两张核心页面

**Files:**
- Create: `web/src/features/yun/LogisticsMarketTab.tsx`
- Create: `web/src/features/yun/FindLogisticsTab.tsx`
- Modify: `web/src/features/yun/YunPage.tsx`

**Interfaces:**
- Consumes: `fetchLogisticsMarket(filters)`、`previewDemand(message, current)`、`previewTransportTask(demand)`、`createTransportTask(demand)`。
- Produces: `onUseService(service)` 将市场服务偏好带入找物流。
- Produces: `onTaskCreated(task)` 更新页面共享当前任务并切换“运输方案”。

- [ ] **Step 1: 实现物流市场加载、错误与空状态**

默认查询全部服务；起点、终点或运输方式变化后重新查询。加载时显示“运小二正在整理物流市场”，失败时显示后端 `detail` 和重试按钮，无结果时显示清空筛选入口。

- [ ] **Step 2: 实现市场概览与服务表**

概览只显示服务数量、四种运输方式数量、参考运价区间和更新时间。服务表展示承运方、线路、方式、参考运价、时效、吨位、发运窗口、履约摘要和“带入找物流”。

- [ ] **Step 3: 实现确定性 AI 市场观察卡**

前端基于 API 返回的 `market_insights` 展示运价变化、运力偏紧和多式联运机会；不在浏览器本地生成新结论。每条观察附服务或线路依据。

- [ ] **Step 4: 实现找物流结构化表单**

必填字段使用明确标签，提交前在同页展示确认卡。日期校验要求 `latest_arrival_date >= departure_date`，数量大于 0；错误聚焦到具体字段。

- [ ] **Step 5: 实现自然语言需求提取**

```tsx
const handleParse = async () => {
  const result = await previewDemand(message, demand);
  setDemand((current) => ({ ...current, ...result.extracted }));
  setMissingFields(result.missing_fields);
  setConfirmationSummary(result.confirmation_summary);
};
```

AI 只预填，不自动创建任务。用户仍需点击“确认并开始匹配”。

- [ ] **Step 6: 实现粮小二交接预填**

读取 URL 中的 `source_agent=liang`、`source_task_id`、`origin_region`、`cargo_name`、`quantity_tons` 和 `departure_date`；显示“来自粮小二”的来源标签，未提供的收货与卸货条件保持空白并进入补问。

- [ ] **Step 7: 运行前端构建与手动路径检查**

Run: `cd web && npm run build`  
Expected: PASS。  
Manual: 打开 `/agent/yun` 默认看到物流市场；点击任一服务“带入找物流”后切换第二 Tab 且偏好已预填；确认前数据库没有新任务。不要提交。

---

### Task 8: 实现运输方案、询运对接与运输任务闭环

**Files:**
- Create: `web/src/features/yun/components/RouteFlow.tsx`
- Create: `web/src/features/yun/TransportPlansTab.tsx`
- Create: `web/src/features/yun/InquiryTab.tsx`
- Create: `web/src/features/yun/TransportTasksTab.tsx`
- Modify: `web/src/features/yun/YunPage.tsx`

**Interfaces:**
- Consumes: 当前任务、方案、scenario、select-plan、inquiry-preview、submit-inquiry、task-list、timeline API。
- Produces: 方案选择后更新共享任务；询运提交后更新状态；任务列表可恢复当前任务。

- [ ] **Step 1: 实现复用路线段组件**

```tsx
export default function RouteFlow({ segments }: { segments: RouteSegment[] }) {
  return (
    <ol aria-label="运输路线" className="flex flex-wrap items-center gap-2">
      {segments.map((segment, index) => (
        <li key={`${segment.from}-${segment.to}-${index}`} className="contents">
          <span className="rounded-lg border border-line bg-rice-deep px-3 py-2 text-xs">
            {segment.from} · {MODE_LABELS[segment.mode]} · {segment.to}
          </span>
          {index < segments.length - 1 && <span className="text-tech">→</span>}
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 2: 实现主推、备选和未入选展示**

主推与备选卡并列展示费用区间、时效区间、换装次数、风险、待核验项和路线段；未入选折叠区必须显示淘汰原因。无结果时展示后端返回的放宽建议，不渲染空主推卡。

- [ ] **Step 3: 实现方案选择确认**

点击“选择此方案”先显示摘要确认层，确认后调用 `selectPlan`；成功后显示“已选择”并开放询运 Tab。取消不调用接口。

- [ ] **Step 4: 实现“到货放宽三天”情景比较**

调用 scenario API，结果显示为临时对比区并标记“未保存情景”。关闭对比区后恢复原方案；不修改任务日期或当前选择。

- [ ] **Step 5: 实现询运草稿和提交确认**

加载 preview 后允许修改联系人备注和问题列表；提交按钮打开二次确认，确认后发送 `user_confirmed: true`。成功页写“已提交人工物流对接”，不得写“订舱成功”或“运力已锁定”。

- [ ] **Step 6: 实现运输任务列表与详情时间线**

按状态筛选任务，点击任务后恢复为当前任务；详情显示需求摘要、当前阻塞、下一步和时间线。已完成任务留在同一列表。复制任务只将条件带回“找物流”，不直接调用创建接口。

- [ ] **Step 7: 运行构建与完整手动闭环**

Run: `cd web && npm run build`  
Expected: PASS。  
Manual: 物流市场 → 找物流 → 创建任务 → 查看主备选与未入选 → 情景比较 → 选择方案 → 生成询运草稿 → 确认提交 → 运输任务中恢复并查看时间线。不要提交。

---

### Task 9: 接入跨 Tab 运小二对话并完成最终回归

**Files:**
- Create: `web/src/features/yun/components/YunChat.tsx`
- Modify: `web/src/features/yun/YunPage.tsx`
- Modify: `backend/tests/logistics/test_routes.py`
- Modify: `docs/粮达网Plus产品设计文档-V2.md`

**Interfaces:**
- Consumes: 当前 Tab、当前任务、需求草稿、方案结果和 Task 5 Agent API。
- Produces: 可收起的只读/草稿对话侧栏，不执行未经确认的写操作。

- [ ] **Step 1: 实现对话消息模型和上下文请求**

```ts
interface YunChatContext {
  active_tab: "market" | "find" | "plans" | "inquiry" | "tasks";
  task_id: number | null;
  demand_draft: Partial<TransportDemand> | null;
}
```

找物流 Tab 的消息调用 demand-preview 并提供“应用到表单”按钮；运输方案 Tab 的消息调用 explain；其他 Tab 使用模板化只读答复。任何回复都不直接调用任务创建、方案选择或询运提交 API。

- [ ] **Step 2: 实现侧栏展开、收起与跨 Tab 保留**

对话状态保存在 `YunPage`，而不是各 Tab 内；桌面端右侧 320–360px，收起后只保留“问运小二”按钮。小屏幕改为底部抽屉，不能挤压主表格到不可用宽度。

- [ ] **Step 3: 补充 Agent API 的只读边界回归测试**

```python
def test_agent_demand_preview_never_creates_task(client, db_session):
    response = client.post("/api/logistics/agent/demand-preview", json={
        "message": "120吨玉米从长春运到深圳，7天到",
        "current": {},
    })
    assert response.status_code == 200
    assert db_session.query(TransportTask).count() == 0


def test_scenario_never_changes_original_task(client, created_task):
    before = client.get(f"/api/logistics/tasks/{created_task['id']}").json()
    client.post(f"/api/logistics/tasks/{created_task['id']}/scenario", json={
        "arrival_days_delta": 3
    })
    after = client.get(f"/api/logistics/tasks/{created_task['id']}").json()
    assert after["latest_arrival_date"] == before["latest_arrival_date"]
```

- [ ] **Step 4: 同步总产品文档的运小二 Tab 与职责**

将第 8.5 节更新为五个确认 Tab，并补充“物流市场第一眼、规则硬过滤、询运人工对接”的简短说明；不复制整份专项规格。

- [ ] **Step 5: 运行最终自动回归**

Run: `cd backend && uv run pytest -q`  
Expected: 全部 PASS。  
Run: `cd web && npm run build`  
Expected: PASS。  
Run: `git diff --check`  
Expected: 无输出。

- [ ] **Step 6: 执行代表场景验收**

使用“120 吨东北二等玉米运往深圳、7 天内到货”：确认 AI 能识别缺失条件；低价但超过 7 天的水运方案进入未入选；主推与备选理由可追溯；放宽三天只生成临时情景；询运提交必须二次确认；任务页显示完整状态与时间线。

- [ ] **Step 7: 人工审查检查点**

检查 `git status --short` 仅包含本计划范围内文件；检查页面没有“实时运力、已锁定车辆、最终成交价、自动下单”等越界文案；不执行 Git 提交，由用户自行决定版本控制操作。
