# 粮小二 Mock-first Implementation Plan

> 日期：2026-08-22  
> 对应设计：`docs/superpowers/specs/2026-08-22-liang-xiaoer-design.md`  
> 执行原则：AI 竞赛稳定演示优先；本计划不接入公开粮源，不依赖外网。

**Goal:** 将 `/agent/liang` 从通用占位页实现为可独立浏览演示粮源、与 LangChain 粮小二对话、生成单粮源主推与备选、管理寻源任务并确认交接运小二的完整页面。

**Architecture:** React 通过 REST 与现有 NDJSON 流式接口访问单体 FastAPI。FastAPI 新增 `backend/app/sourcing` 领域模块，固定 `liang-v1` Mock 数据初始化到本地 Docker MySQL，市场、供应方、任务和 Agent 共用同一份数据。LangChain 只负责意图理解、只读工具选择和结构化解释；硬条件过滤、候选排序、状态写入和跨小二交接由普通 Python 服务与确认式 API 完成。

**Tech Stack:** FastAPI、SQLAlchemy 2、Pydantic 2、本地 Docker MySQL、LangChain、React、TypeScript、Vite、Vitest、Testing Library、Playwright。

---

## Global Constraints

- 首版所有粮源、质量、数量、发运和供应方数据均为固定 Mock 数据，统一 `data_kind=simulated`。
- UI 统一写“演示数据”或“Mock 数据”，不得出现“公开挂牌”“真实库存”“实时行情”等误导性文案。
- 用户输入使用 `data_kind=user_input`，规则和 AI 判断使用 `data_kind=inference`。
- 不新增公开源客户端、解析器、抓取器、定时同步、手动刷新、快照、新鲜度和公开/演示切换。
- 不修改现有瞻小二行情同步逻辑；粮小二与其数据源解耦。
- Agent 相关框架统一使用 LangChain。
- 模型不负责硬条件过滤、候选排序或数据库写入。
- 写操作先返回确认卡，确认后通过普通 REST API 执行。
- 首版只做单粮源主推和备选，不做拼单。
- 不做自动联系、询价、下单、签约、付款或到厂成本精算。
- 避免软删除、事件总线、复杂一致性等竞赛首版不需要的设计。
- 每个 Task 按测试先行执行，通过当前 Task 测试后再进入下一项。
- 不自动创建 Git commit；每个 Task 末尾只检查测试和差异。

---

## 从原计划中移除的工作

以下内容不进入本次实现：

- 国家粮食交易中心或其他公开站点的挂牌解析。
- `national_grain_listings.json` 一类公开响应 fixture。
- `backend/app/market/national_grain_client.py` 的粮源挂牌扩展。
- `backend/app/market/sync.py` 的粮源同步与 10 分钟调度。
- `LISTING_REFRESH_MINUTES` 配置。
- `source_name`、`source_url`、`source_published_at`、`fetched_at`、`freshness`、`missed_syncs` 等外部来源字段。
- `data_scope=public|simulated` 查询参数和页面切换。
- `/api/liang/market/refresh` 手动刷新接口。
- `listing_demo_details`、`supplier_demo_profiles` 两张演示扩展表。
- 公开源失败、空响应和最后成功快照的降级路径。

公开数据接入只保留为设计文档中的后续方向，不为它预先实现代码。

---

## 文件结构与职责

### 后端新增

```text
backend/app/sourcing/
├── __init__.py
├── models.py                # 粮源、供应方、任务、运行、候选表
├── schemas.py               # REST 输入输出结构
├── mock_seed.py             # 固定 liang-v1 数据集
├── repository.py            # 参数化查询和持久化
├── rules.py                 # 硬过滤、排序、原因码和核验项
├── service.py               # 市场聚合、任务与方案编排
└── routes.py                # /api/liang/*

backend/app/agent/
├── liang_prompt.py          # 粮小二系统提示
├── liang_schemas.py         # 工具输入与动作提案
├── liang_tools.py           # LangChain 只读 Tools
└── liang_service.py         # 粮小二流式 Agent 服务

backend/tests/sourcing/
├── test_models.py
├── test_mock_seed.py
├── test_repository.py
├── test_routes.py
├── test_rules.py
└── test_service.py

backend/tests/agent/
├── test_liang_tools.py
├── test_liang_service.py
└── test_liang_routes.py
```

### 后端修改

```text
backend/app/database.py
backend/app/main.py
backend/app/agent/routes.py
backend/app/workflow/schemas.py
backend/app/workflow/repository.py
backend/app/workflow/service.py
backend/app/workflow/routes.py
backend/tests/conftest.py
```

### 前端新增

```text
web/src/features/liang/
├── api.ts
├── types.ts
├── LiangPage.tsx
├── LiangPage.test.tsx
├── LiangContext.tsx
├── LiangShell.tsx
├── components/
│   ├── DemoDataBanner.tsx
│   ├── LiangTabs.tsx
│   ├── CurrentTaskBar.tsx
│   ├── MarketSummary.tsx
│   ├── ListingFilters.tsx
│   ├── ListingTable.tsx
│   ├── ListingDrawer.tsx
│   ├── CandidateCard.tsx
│   ├── ComparisonTable.tsx
│   ├── VerificationList.tsx
│   ├── LiangChatDrawer.tsx
│   ├── LiangMessage.tsx
│   └── ActionProposalCard.tsx
├── hooks/
│   ├── useLiangMarket.ts
│   ├── useSourcingTask.ts
│   └── useLiangChat.ts
└── tabs/
    ├── MarketTab.tsx
    ├── PlanTab.tsx
    ├── TasksTab.tsx
    └── SuppliersTab.tsx

web/e2e/liang.spec.ts
```

### 前端修改

```text
web/src/App.tsx
web/src/pages/agents/AgentServicePage.tsx
web/src/pages/MyTasks.tsx
web/src/index.css
```

---

## Task 1: 建立 Mock-first 粮源领域模型与 Schema

**Files:**

- Create: `backend/app/sourcing/__init__.py`
- Create: `backend/app/sourcing/models.py`
- Create: `backend/app/sourcing/schemas.py`
- Create: `backend/tests/sourcing/test_models.py`
- Modify: `backend/app/database.py`
- Modify: `backend/tests/conftest.py`

### Step 1: 写模型失败测试

覆盖：

- `GrainListing` 保存价格、数量、质检、发运和 Mock 元信息。
- `Supplier` 保存演示履约和核验状态。
- `SourcingTask` 可独立创建，也可关联 `handoff_task_id`。
- `SourcingRun` 保存条件快照与规则版本。
- `CandidateResult` 保存角色、通过状态、原因码和核验项。
- 粮源和供应方默认 `data_kind=simulated`。

示例：

```python
def test_listing_contains_mock_operational_fields(db_session):
    listing = GrainListing(
        listing_code="LIANG-V1-CORN-001",
        direction="sell",
        variety_code="corn",
        variety_name="玉米",
        crop_year=2025,
        origin_province="黑龙江",
        origin_city="北安",
        grade="二等",
        price=2320,
        price_type="出库价",
        listed_quantity_tons=180,
        available_quantity_tons=160,
        latest_ship_at=datetime(2026, 8, 28, tzinfo=CHINA_TZ),
        data_kind="simulated",
        mock_dataset_version="liang-v1",
        mock_generated_at=MOCK_GENERATED_AT,
    )
    db_session.add(listing)
    db_session.commit()
    assert listing.data_kind == "simulated"
    assert listing.available_quantity_tons == Decimal("160")
```

### Step 2: 运行测试确认失败

```bash
cd backend
uv run pytest tests/sourcing/test_models.py -q
```

Expected: FAIL，提示 sourcing 模型不存在。

### Step 3: 实现最小 SQLAlchemy 模型

`GrainListing` 包含：

- 标的：`listing_code`、`direction`、品种、年份、产地、等级。
- 报价：`price`、`price_type`。
- 数量：`listed_quantity_tons`、`available_quantity_tons`。
- 交付：交收方式、仓库、最早/最晚发运时间。
- 质量：水分、容重、杂质。
- 供应方外键和报价有效期。
- `data_kind`、`mock_dataset_version`、`mock_generated_at`。
- 常规 `created_at`、`updated_at`。

`Supplier` 直接包含地区、履约率、准时率、质量合格率、证照/联系人/仓库核验状态和 Mock 元信息。

`SourcingTask`、`SourcingRun`、`CandidateResult` 使用 JSON 保存条件快照、原因码和核验项，避免过度拆表。首版不建立 `listing_demo_details` 和 `supplier_demo_profiles`。

### Step 4: 实现 Pydantic Schema

至少提供：

- `ListingSummary`、`ListingDetail`、`MarketSummary`
- `SupplierSummary`、`SupplierDetail`
- `SourcingTaskCreate`、`SourcingTaskUpdate`、`SourcingTaskRead`
- `SourcingPlanRead`、`CandidateRead`、`VerificationItem`

市场与供应方响应统一带：

```python
data_kind: Literal["simulated"] = "simulated"
mock_dataset_version: str
mock_generated_at: datetime
```

不要加入 `source_url`、`fetched_at`、`freshness` 或 `data_scope`。

### Step 5: 注册模型并验证

确保数据库初始化导入 sourcing models，测试 fixture 能清理新增表。

```bash
cd backend
uv run pytest tests/sourcing/test_models.py -q
git diff --check
```

Expected: PASS；无格式错误。

---

## Task 2: 实现固定、幂等、可复现的 `liang-v1` 数据集

**Files:**

- Create: `backend/app/sourcing/mock_seed.py`
- Create: `backend/app/sourcing/repository.py`
- Create: `backend/tests/sourcing/test_mock_seed.py`
- Create: `backend/tests/sourcing/test_repository.py`
- Modify: `backend/app/main.py`

### Step 1: 写失败测试

要求：

- 第一次执行写入固定供应方和粮源。
- 第二次执行不新增重复记录。
- 所有记录为 `simulated` 且版本为 `liang-v1`。
- 主推、备选、低价不合格、数量不足、字段缺失场景均存在。
- 另有少量小麦、大豆，保证独立市场有浏览价值。
- Repository 默认只返回 `direction=sell`。

```python
def test_seed_is_idempotent(db_session):
    seed_liang_mock_data(db_session)
    first = count_listings(db_session)
    seed_liang_mock_data(db_session)
    assert count_listings(db_session) == first
    assert first >= 8
```

### Step 2: 运行测试确认失败

```bash
cd backend
uv run pytest tests/sourcing/test_mock_seed.py tests/sourcing/test_repository.py -q
```

### Step 3: 实现显式 Mock 常量

```python
MOCK_DATASET_VERSION = "liang-v1"
MOCK_GENERATED_AT = datetime(2026, 8, 22, 10, 0, tzinfo=CHINA_TZ)
```

核心玉米数据：

| 标的号 | 地区 | 关键设计 | 预期 |
|---|---|---|---|
| `LIANG-V1-CORN-001` | 黑龙江北安 | 160 吨、二等、7 天内可发、证据完整 | 主推 |
| `LIANG-V1-CORN-002` | 吉林榆树 | 150 吨、二等，报价或发运余量略弱 | 备选 |
| `LIANG-V1-CORN-003` | 辽宁铁岭 | 报价更低，但等级或质检不满足 | 淘汰 |
| `LIANG-V1-CORN-004` | 内蒙古通辽 | 其他条件较好，可用量不足 120 吨 | 淘汰 |
| `LIANG-V1-CORN-005` | 吉林四平 | 缺少最晚发运时间 | 字段缺失 |

供应方使用明显虚构名称，例如“北安丰穗演示供应方”，不要使用真实企业名。

### Step 4: 实现幂等播种

- 以 `listing_code` 和供应方稳定键判断存在。
- 缺失时插入，相同版本存在时跳过。
- 不覆盖用户任务、运行和候选。
- 不读取网络或公开响应 fixture。

### Step 5: 实现 Repository

提供：

- `list_listings(filters, offset, limit)`
- `count_listings(filters)`
- `get_listing(listing_id)`
- `list_suppliers(filters, offset, limit)`
- `get_supplier(supplier_id)`
- `aggregate_market_summary()`

查询使用 SQLAlchemy 参数化条件；搜索覆盖品种、产地、供应方和标的号。

### Step 6: 接入 lifespan

数据库建表后执行 `seed_liang_mock_data()`。这是首版固定能力，不依赖 `DEMO_MODE`，不新增环境变量。

初始化失败时记录明确日志并允许应用启动，以便健康检查和错误页工作；不得回退到公开数据。

### Step 7: 验证

```bash
cd backend
uv run pytest tests/sourcing/test_mock_seed.py tests/sourcing/test_repository.py -q
git diff --check
```

Expected: PASS；测试过程没有网络请求。

---

## Task 3: 提供演示市场、粮源与供应方只读 API

**Files:**

- Create: `backend/app/sourcing/service.py`
- Create: `backend/app/sourcing/routes.py`
- Create: `backend/tests/sourcing/test_routes.py`
- Modify: `backend/app/main.py`

### Step 1: 写 API 失败测试

覆盖：

- `GET /api/liang/market/summary`
- `GET /api/liang/listings`
- `GET /api/liang/listings/{id}`
- `GET /api/liang/suppliers`
- `GET /api/liang/suppliers/{id}`
- 搜索、品种、产地、等级、年份、价格、数量、发运、排序和分页。
- 不存在资源返回 404。
- 所有响应带演示数据元信息。
- 不存在 `/api/liang/market/refresh`。

```python
def test_market_summary_is_simulated(client, seeded_liang_data):
    body = client.get("/api/liang/market/summary").json()
    assert body["data_kind"] == "simulated"
    assert body["mock_dataset_version"] == "liang-v1"
    assert "freshness" not in body
    assert "source_url" not in body
```

### Step 2: 运行测试确认失败

```bash
cd backend
uv run pytest tests/sourcing/test_routes.py -q
```

### Step 3: 实现市场概览

只基于 Mock 记录聚合：

- 在架粮源数。
- 演示挂牌量、演示可用量。
- 品种和产区分布。
- 按 `price_type` 分组的价格区间。
- 最多三条确定性市场发现。

市场发现使用 `data_kind=inference`，文案明确“演示数据集”，不写“今日真实市场”。

### Step 4: 实现列表与详情

列表支持 `query`、品种、产地、等级、年份、价格区间、最低可用量、最晚发运、价格口径、排序和分页。

默认按 `variety_code, origin_province, listing_code` 稳定排序。详情生成默认交易前核验项。

### Step 5: 实现供应方聚合

列表支持关键词、地区和品种。详情返回演示档案、关联粮源、履约指标和核验项。不得调用工商、征信或联系人接口。

### Step 6: 注册 Router 并验证

```bash
cd backend
uv run pytest tests/sourcing/test_routes.py -q
git diff --check
```

Expected: PASS。

---

## Task 4: 实现确定性硬过滤与单粮源主备推荐

**Files:**

- Create: `backend/app/sourcing/rules.py`
- Create: `backend/tests/sourcing/test_rules.py`

### Step 1: 写规则失败测试

断言：

- 北安通过并排第一。
- 榆树通过并排第二。
- 铁岭即使价格最低，也因等级或质检要求淘汰。
- 通辽因数量不足淘汰。
- 四平因关键发运字段缺失淘汰。
- 不同价格口径不计算直接差价。
- 相同输入重复执行结果一致。
- 无合格粮源时主推和备选均为空。

### Step 2: 定义结构化结果

```python
class RejectionCode(StrEnum):
    VARIETY_MISMATCH = "VARIETY_MISMATCH"
    QUANTITY_INSUFFICIENT = "QUANTITY_INSUFFICIENT"
    GRADE_BELOW_REQUIREMENT = "GRADE_BELOW_REQUIREMENT"
    CROP_YEAR_MISMATCH = "CROP_YEAR_MISMATCH"
    PRICE_OVER_BUDGET = "PRICE_OVER_BUDGET"
    SHIP_WINDOW_MISSED = "SHIP_WINDOW_MISSED"
    REQUIRED_FIELD_MISSING = "REQUIRED_FIELD_MISSING"

@dataclass(frozen=True)
class EvaluatedCandidate:
    listing_id: int
    eligible: bool
    rejection_codes: tuple[RejectionCode, ...]
    rank_key: tuple
    verification_items: tuple[dict, ...]
```

### Step 3: 实现纯 Python 硬条件

逐项判断品种、数量、等级、年份、价格和发运时间。规则不调用 LangChain、不读取数据库、不修改状态。

用户指定的硬条件字段缺失时，加入 `REQUIRED_FIELD_MISSING` 并淘汰，不让模型补值。

### Step 4: 实现稳定排序

```python
rank_key = (
    required_field_missing_count,
    price_basis_penalty,
    comparable_price_or_inf,
    ship_time_penalty,
    supplier_evidence_penalty,
    verification_item_count,
    listing.id,
)
```

只在价格口径相同时使用价格排序。`listing.id` 是最后稳定键。

### Step 5: 生成统一核验项

每个入选候选至少包含：

- `VERIFY_LOCKABLE_INVENTORY`
- `VERIFY_QUALITY_REPORT`
- `VERIFY_QUOTE_TERMS`
- `VERIFY_SHIP_WINDOW`
- `VERIFY_SUPPLIER_IDENTITY`

核验项标记 `data_kind=inference`。

### Step 6: 验证

```bash
cd backend
uv run pytest tests/sourcing/test_rules.py -q
git diff --check
```

Expected: PASS。

---

## Task 5: 持久化寻源任务、运行版本与候选结果

**Files:**

- Modify: `backend/app/sourcing/repository.py`
- Modify: `backend/app/sourcing/service.py`
- Modify: `backend/app/sourcing/routes.py`
- Create: `backend/tests/sourcing/test_service.py`
- Modify: `backend/tests/sourcing/test_routes.py`

### Step 1: 写任务生命周期失败测试

覆盖：

- 独立创建 `draft` 任务。
- 任务可关联瞻小二 `handoff_task_id`。
- 确认执行后创建 `SourcingRun` 和所有 `CandidateResult`。
- 修改条件后创建新运行，不覆盖旧运行。
- 主推和备选来自 Task 4 的确定性结果。
- 用户可加入或移出候选篮。
- 相同 `request_token` 不重复创建运行。
- 无结果时保存淘汰摘要，不伪造主推。

### Step 2: 实现 Repository

提供：

- `create_task`、`update_task`、`list_tasks`、`get_task`
- `create_run`、`save_candidate_results`、`get_latest_plan`
- `set_manual_candidate`

事务边界放在 Service 层。首版不加软删除、锁表或事件发布。

### Step 3: 实现 Service

`run_sourcing(task_id, request_token)`：

1. 读取任务和可售 Mock 粮源。
2. 将任务条件转为规则输入。
3. 执行 Task 4 规则。
4. 创建运行快照。
5. 保存全部候选结果。
6. 更新任务状态为 `plan_ready`。
7. 返回主推、备选、淘汰项和核验清单。

### Step 4: 实现 REST API

```text
GET    /api/liang/tasks
POST   /api/liang/tasks
GET    /api/liang/tasks/{task_id}
PATCH  /api/liang/tasks/{task_id}
POST   /api/liang/tasks/{task_id}/runs
GET    /api/liang/tasks/{task_id}/plan
PUT    /api/liang/tasks/{task_id}/candidates/{listing_id}
DELETE /api/liang/tasks/{task_id}/candidates/{listing_id}
```

写接口接受 `request_token` 防重复点击。不存在返回 404，非法状态返回 409，条件校验失败返回 422。

### Step 5: 验证

```bash
cd backend
uv run pytest tests/sourcing/test_service.py tests/sourcing/test_routes.py -q
git diff --check
```

Expected: PASS。

---

## Task 6: 实现粮小二 LangChain Schema、Tools 与服务

**Files:**

- Create: `backend/app/agent/liang_prompt.py`
- Create: `backend/app/agent/liang_schemas.py`
- Create: `backend/app/agent/liang_tools.py`
- Create: `backend/app/agent/liang_service.py`
- Create: `backend/tests/agent/test_liang_tools.py`
- Create: `backend/tests/agent/test_liang_service.py`

### Step 1: 写失败测试

覆盖：

- `search_listings` 只返回 Mock 粮源并带数据标签。
- `get_listing`、`get_market_summary`、`get_sourcing_task`、`get_sourcing_plan`、`compare_candidates`、`get_supplier` 可用。
- Tools 不创建任务、不写候选、不触发交接。
- 回答必须说明当前使用演示数据。
- 创建任务、重新生成和交接意图只返回 `action_proposal`。
- 模型不可用时返回降级事件，不影响确定性 API。

### Step 2: 定义工具输入

```python
class SearchListingsInput(BaseModel):
    query: str | None = None
    variety_code: str | None = None
    origin_province: str | None = None
    grade: str | None = None
    min_available_quantity_tons: Decimal | None = None
    limit: int = Field(default=10, ge=1, le=20)

class CompareCandidatesInput(BaseModel):
    task_id: int
    listing_ids: list[int] = Field(min_length=1, max_length=5)
```

工具工厂注入 `SourcingService` 和会话上下文，避免全局数据库连接。

### Step 3: 编写系统提示

必须明确：

- 你是粮小二，职责是找粮、比较、解释和核验。
- 当前市场、粮源和供应方事实全部来自 `liang-v1` 演示数据集。
- 不得把演示库存、报价、质检、发运或履约称为真实事实。
- 交易前必须提示核验。
- 不得自行创建任务、保存候选或交接。
- 不展示内部思维链。

### Step 4: 实现只读 Tools

每个 Tool 返回短小结构化 JSON，包含业务字段、`data_kind` 和对象 ID。`compare_candidates` 调用 Task 4 的规则，不让模型计算排序。

### Step 5: 实现流式服务

沿用现有 NDJSON 事件：

- `status`
- `text_delta`
- `listing_reference`
- `plan_reference`
- `action_proposal`
- `done`
- `error`

状态只显示“正在筛选演示粮源”等业务摘要。

### Step 6: 验证

```bash
cd backend
uv run pytest tests/agent/test_liang_tools.py tests/agent/test_liang_service.py -q
git diff --check
```

Expected: PASS。

---

## Task 7: 按 `agent_id` 分派服务并完成粮到运交接

**Files:**

- Modify: `backend/app/agent/routes.py`
- Modify: `backend/app/workflow/schemas.py`
- Modify: `backend/app/workflow/repository.py`
- Modify: `backend/app/workflow/service.py`
- Modify: `backend/app/workflow/routes.py`
- Modify: `backend/app/sourcing/routes.py`
- Create: `backend/tests/agent/test_liang_routes.py`
- Modify: `backend/tests/workflow/test_service.py`
- Modify: `backend/tests/workflow/test_routes.py`

### Step 1: 写失败测试

覆盖：

- `agent_id=liang` 会话使用 `LiangAgentService`。
- `agent_id=zhan` 行为不回归。
- 会话不能读取不属于当前上下文的任务。
- Agent 建议交接时不立即写入。
- 用户确认后创建一条运小二交接。
- 相同 `request_token` 重试返回同一交接。
- 交接包含任务条件、主推、备选、核验项和演示数据声明。

### Step 2: 实现 Agent 分派

```python
service = {
    "zhan": zhan_agent_service,
    "liang": liang_agent_service,
}.get(session.agent_id, default_agent_service)
```

保持统一会话和流式协议，不为粮小二另建聊天接口。

### Step 3: 定义交接 Payload

至少包含：

- `sourcing_task_id`、`sourcing_run_id`
- 采购数量和目标地区
- 主推/备选粮源 ID、仓库和可发时间
- 当前价格口径
- 待核验项
- `market_data_kind="simulated"`
- `mock_dataset_version="liang-v1"`

### Step 4: 实现确认接口

`POST /api/liang/tasks/{task_id}/handoffs/yun`：

- 必须存在最近一次方案。
- 必须传 `request_token`。
- 创建目标 `agent_id=yun` 的交接任务。
- 成功后任务改为 `handed_off`。
- 不自动算运价或下运输订单。

### Step 5: 验证

```bash
cd backend
uv run pytest tests/agent tests/workflow tests/sourcing -q
git diff --check
```

Expected: PASS。

---

## Task 8: 建立前端类型、API、上下文、路由与四 Tab 骨架

**Files:**

- Create: `web/src/features/liang/types.ts`
- Create: `web/src/features/liang/api.ts`
- Create: `web/src/features/liang/LiangContext.tsx`
- Create: `web/src/features/liang/LiangShell.tsx`
- Create: `web/src/features/liang/LiangPage.tsx`
- Create: `web/src/features/liang/LiangPage.test.tsx`
- Create: `web/src/features/liang/components/DemoDataBanner.tsx`
- Create: `web/src/features/liang/components/LiangTabs.tsx`
- Create: `web/src/features/liang/components/CurrentTaskBar.tsx`
- Create: `web/src/features/liang/tabs/MarketTab.tsx`
- Create: `web/src/features/liang/tabs/PlanTab.tsx`
- Create: `web/src/features/liang/tabs/TasksTab.tsx`
- Create: `web/src/features/liang/tabs/SuppliersTab.tsx`
- Create: `web/src/features/liang/test/fixtures.ts`
- Create: `web/src/features/liang/test/server.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/pages/agents/AgentServicePage.tsx`

### Step 1: 写失败测试

覆盖：

- `/agent/liang` 渲染专用页面，不再是通用占位页。
- 默认 Tab 是“粮源市场”，四个 Tab 可切换。
- 顶部常驻“当前为演示数据”、`liang-v1` 和生成时间。
- URL 带 `task_id` 时加载当前任务。
- 无 `task_id` 时不自动创建任务。
- 对话入口在所有 Tab 存在。

### Step 2: 定义前端类型

```ts
export type DataKind = "simulated" | "user_input" | "inference";

export interface MockDatasetMeta {
  data_kind: "simulated";
  mock_dataset_version: string;
  mock_generated_at: string;
}

export interface GrainListing extends MockDatasetMeta {
  id: number;
  listing_code: string;
  variety_name: string;
  origin_province: string;
  origin_city?: string | null;
  grade?: string | null;
  price?: string | null;
  price_type?: string | null;
  listed_quantity_tons: string;
  available_quantity_tons?: string | null;
  latest_ship_at?: string | null;
  supplier: SupplierSummary;
}
```

不要定义 `source_url`、`freshness` 或 `data_scope`。

### Step 3: 实现 API 和 Context

API 封装 Task 3、5、7 接口，统一错误结构。Context 只管理当前 Tab、任务、筛选、选中粮源、候选篮和对话抽屉状态；服务端数据由查询 Hook 加载，不引入复杂全局 store。

### Step 4: 实现页面骨架与路由

`AgentServicePage` 遇到 `agentId === "liang"` 时渲染 `LiangPage`。头部固定文案：

> 当前为竞赛演示数据，仅用于功能演示；实际采购前需核验库存、质量、报价与发运能力。

### Step 5: 验证

```bash
cd web
npm test -- --run src/features/liang/LiangPage.test.tsx
npm run build
git diff --check
```

Expected: PASS。

---

## Task 9: 实现默认粮源市场、双入口与详情

**Files:**

- Create: `web/src/features/liang/hooks/useLiangMarket.ts`
- Create: `web/src/features/liang/components/MarketSummary.tsx`
- Create: `web/src/features/liang/components/ListingFilters.tsx`
- Create: `web/src/features/liang/components/ListingTable.tsx`
- Create: `web/src/features/liang/components/ListingDrawer.tsx`
- Modify: `web/src/features/liang/tabs/MarketTab.tsx`
- Create: `web/src/features/liang/tabs/MarketTab.test.tsx`
- Modify: `web/src/index.css`

### Step 1: 写失败测试

覆盖：

- 无任务时显示演示市场概览和完整粮源表。
- 概览说明“不代表真实市场”。
- 每行显示“演示粮源”。
- 不显示“公开挂牌”“实时”“同步”“刷新数据”或模式切换。
- 筛选会更新 API 参数。
- 任务态自动带入条件但允许修改。
- 点击粮源打开详情。
- 详情显示 Mock 声明和核验项。
- 无数据、加载失败和字段缺失状态清晰。

### Step 2: 实现查询 Hook

- 首次并行请求 summary 和 listings。
- 筛选输入 250ms 防抖。
- 切换任务时重置为任务条件。
- 普通“重试”只重试请求，不命名为“刷新市场数据”。

### Step 3: 实现高密度科技风市场

使用深色背景、青色信息、琥珀色 Mock 标签、紧凑表格。桌面列：

- 粮源、产地、报价口径
- 可用数量、交收/发运
- 供应方、数据标签、操作

窄屏使用紧凑行卡，不做营销大卡。

### Step 4: 实现双入口状态

无任务时只展示市场发现和需求引导，不显示匹配率、主推或备选。

有任务时显示任务摘要、通过硬条件数量、主推/备选草案，以及“生成/重新生成方案”确认入口。

### Step 5: 实现详情抽屉

分为基本信息、报价数量、质检、发运、供应方、核验清单和数据集元信息。操作只有“加入候选”和“让粮小二分析”。

### Step 6: 验证

```bash
cd web
npm test -- --run src/features/liang/tabs/MarketTab.test.tsx
git diff --check
```

Expected: PASS。

---

## Task 10: 实现方案、任务和供应方三个业务 Tab

**Files:**

- Create: `web/src/features/liang/hooks/useSourcingTask.ts`
- Create: `web/src/features/liang/components/CandidateCard.tsx`
- Create: `web/src/features/liang/components/ComparisonTable.tsx`
- Create: `web/src/features/liang/components/VerificationList.tsx`
- Modify: `web/src/features/liang/tabs/PlanTab.tsx`
- Modify: `web/src/features/liang/tabs/TasksTab.tsx`
- Modify: `web/src/features/liang/tabs/SuppliersTab.tsx`
- Create: `web/src/features/liang/tabs/PlanTab.test.tsx`
- Create: `web/src/features/liang/tabs/TasksTab.test.tsx`
- Create: `web/src/features/liang/tabs/SuppliersTab.test.tsx`

### Step 1: 写失败测试

方案页：

- 无任务空状态。
- 主推和备选正确。
- 只有主推时说明无备选。
- 无结果时不渲染伪主推。
- 淘汰原因和核验项可展开。
- 不同报价口径不显示直接差价。
- 所有候选显示演示数据标签。

任务页：

- 独立任务和瞻小二来源任务都可见。
- 创建任务先确认。
- 修改条件后生成新运行。
- 退出当前任务不删除任务。

供应方页：

- 列表、搜索和详情可用。
- 显示“演示供应方档案”。
- 不出现真实征信或自动联系按钮。

### Step 2: 实现方案页

顺序：

1. 当前任务条件
2. 主推粮源
3. 备选粮源
4. 候选对比
5. 未入选解释
6. 待核验清单
7. 下一步动作

原因码映射集中管理；未知码展示后端 message。

### Step 3: 实现任务页

展示状态、条件摘要、来源、最近运行时间和主推摘要。历史运行只读切换。创建、修改和重新生成复用确认卡。

### Step 4: 实现供应方页

展示地区、关联品种、可用总量、演示履约证据和核验状态。详情显示关联粮源和核验清单。操作只有“加入对比”和“让粮小二分析”。

### Step 5: 验证

```bash
cd web
npm test -- --run \
  src/features/liang/tabs/PlanTab.test.tsx \
  src/features/liang/tabs/TasksTab.test.tsx \
  src/features/liang/tabs/SuppliersTab.test.tsx
git diff --check
```

Expected: PASS。

---

## Task 11: 实现跨 Tab 常驻对话与确认卡

**Files:**

- Create: `web/src/features/liang/hooks/useLiangChat.ts`
- Create: `web/src/features/liang/components/LiangChatDrawer.tsx`
- Create: `web/src/features/liang/components/LiangMessage.tsx`
- Create: `web/src/features/liang/components/ActionProposalCard.tsx`
- Modify: `web/src/features/liang/LiangShell.tsx`
- Create: `web/src/features/liang/components/LiangChatDrawer.test.tsx`

### Step 1: 写失败测试

覆盖：

- 对话栏在四个 Tab 中均存在。
- 切换 Tab 不丢消息。
- 当前任务、筛选和选中粮源随消息发送。
- NDJSON 文本、状态、粮源引用、方案引用和错误正常渲染。
- Agent 明确当前使用演示数据。
- `action_proposal` 只显示确认卡，不自动执行。
- 确认后调用对应 REST API。
- 重复点击确认只提交一次。
- 收起抽屉不清空消息。

### Step 2: 实现流式 Hook

- 为粮小二创建 `agent_id=liang` 会话。
- 逐行解析 NDJSON。
- 使用 `AbortController`。
- 切换 Tab 不重建会话。
- 切换任务时插入本地上下文变更提示。
- 卸载时取消未完成请求。

### Step 3: 实现引用与确认卡

粮源引用打开详情；方案引用切换到方案 Tab；供应方引用切换到供应方详情。

确认动作：

- `create_sourcing_task`
- `update_sourcing_task`
- `run_sourcing`
- `save_candidate`
- `handoff_to_yun`

每张卡生成稳定 `request_token`。失败后保留卡片并允许重试。

### Step 4: 实现响应式抽屉

桌面端右侧 400px，窄屏底部全屏；收起后保留悬浮入口。占位文案：

> 问粮小二，或直接描述找粮需求……

### Step 5: 验证

```bash
cd web
npm test -- --run src/features/liang/components/LiangChatDrawer.test.tsx
git diff --check
```

Expected: PASS。

---

## Task 12: 集成我的办事、E2E、文档与全量验证

**Files:**

- Modify: `web/src/pages/MyTasks.tsx`
- Create: `web/e2e/liang.spec.ts`
- Modify: `README.md`
- Review: `docs/superpowers/specs/2026-08-22-liang-xiaoer-design.md`
- Review: `docs/superpowers/plans/2026-08-22-liang-xiaoer-implementation.md`

### Step 1: 写集成失败测试

我的办事：

- 粮小二任务显示品种、数量、状态和来源。
- 点击进入 `/agent/liang?task_id=...`。
- 粮到运交接显示目标小二和状态。

E2E 代表场景：

1. 独立打开粮小二。
2. 看到 Mock 标识、`liang-v1` 和粮源列表。
3. 输入“120 吨东北二等玉米，7 天内可发”。
4. 确认创建任务并生成方案。
5. 北安为主推、榆树为备选。
6. 铁岭显示等级/质检原因，通辽显示数量不足。
7. 查看核验清单。
8. 确认交接运小二。
9. 从我的办事重新打开该任务。

### Step 2: 完成我的办事跳转

复用现有任务卡和状态样式，不另建第二套任务中心。链接保留 `task_id`。

### Step 3: 建立稳定 E2E 环境

- 使用本地 MySQL 幂等 `liang-v1` 种子。
- E2E 不访问公开网站。
- 浏览器层固定 Agent 流式响应，避免 CI 和比赛现场依赖真实模型。
- 后端单测单独验证 LangChain 工具绑定。
- 不在测试中随机生成粮源。

### Step 4: 更新 README

明确：

- 粮小二首版只使用固定 Mock 数据。
- 启动后自动幂等初始化 `liang-v1`。
- 库存、质量、报价、发运和供应方信息均为演示数据。
- 不需要公开接口密钥或粮源刷新配置。
- 竞赛演示不依赖外网。
- FastAPI、本地 Docker MySQL 和 React 的启动方式。

不要加入 `LISTING_REFRESH_MINUTES`，也不要描述真实/演示模式切换。

### Step 5: 运行全量验证

```bash
cd backend
uv run pytest -q

cd ../web
npm test -- --run
npm run build
npx playwright test e2e/liang.spec.ts
```

Expected: 全部 PASS，现有瞻小二、行情和 workflow 无回归。

### Step 6: 做无外网依赖和误导文案审计

```bash
rg -n "grainmarket|source_url|fetched_at|freshness|data_scope|LISTING_REFRESH|market/refresh" \
  backend/app/sourcing backend/app/agent/liang_* web/src/features/liang README.md

rg -n "公开挂牌|真实库存|实时行情|刚刚同步" web/src/features/liang
```

Expected: 粮小二首版代码无匹配；README 若提及未来扩展，必须明确“本次不实现”。

### Step 7: 对照设计验收

逐项核对设计文档第 5～18 节：

- 双入口与四 Tab
- 常驻对话
- Mock 数据常驻标识
- 单粮源主推与备选
- 淘汰原因与核验清单
- 确认式写操作
- 粮到运交接
- 无外网稳定演示

发现遗漏只补对应最小测试和实现，不扩展首版范围。

### Step 8: 最终差异检查

```bash
git diff --check
git status --short
git diff --stat
```

不要自动提交。

---

## 执行顺序与依赖

```text
Task 1 领域模型与 Schema
  └─ Task 2 固定 Mock 数据与 Repository
       ├─ Task 3 市场/粮源/供应方 API
       └─ Task 4 确定性寻源规则
            └─ Task 5 任务、运行与方案 API
                 ├─ Task 6 LangChain Tools 与服务
                 │    └─ Task 7 Agent 分派与粮到运交接
                 └─ Task 8 前端骨架与路由
                      └─ Task 9 粮源市场
                           └─ Task 10 方案/任务/供应方
                                └─ Task 11 常驻对话与确认卡
                                     └─ Task 12 集成、E2E 与全量验证
```

Task 3 和 Task 4 可在 Task 2 后分别开发，但合并前都必须通过 Task 5 服务测试。前端若在 API 完成前开发，只能使用与 `liang-v1` 一致的 fixture，不得另造第二套业务数据。

---

## 完成定义

全部满足才算完成：

- `/agent/liang` 默认显示一批可浏览、可筛选的演示粮源。
- 页面持续表明当前使用 Mock 数据。
- 应用启动后本地 MySQL 幂等获得 `liang-v1`。
- 粮小二首版不依赖公开接口、外网、同步任务或刷新配置。
- 无任务时不伪造个性化推荐。
- 有任务时由确定性 Python 规则生成单粮源主推、备选和淘汰原因。
- 北安、榆树、铁岭、通辽场景结果稳定可复现。
- 每个方案都有交易前待核验清单。
- LangChain 对话在四个 Tab 常驻并共享任务上下文。
- 所有写操作先确认，模型不能直接写库。
- 粮到运交接可确认、重试且幂等。
- 我的办事可重新进入粮小二任务。
- 后端、前端、构建和 E2E 测试全部通过。
- 断网后仍可完成市场浏览和确定性寻源；模型不可用时有清晰降级。
- 没有自动 Git commit。
