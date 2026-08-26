# 瞻小二 Mock-first Implementation Plan

> 日期：2026-08-22  
> 对应设计：`docs/superpowers/specs/2026-08-22-zhan-xiaoer-design.md`  
> 执行原则：AI 竞赛稳定演示优先；本计划不接入公开行情或资讯，不依赖外网。

**Goal:** 将 `/agent/zhan` 实现为可独立查看演示市场全景、与 LangChain 瞻小二对话、生成玉米采购研判、创建关注并确认生成粮小二预填任务的完整页面。

**Architecture:** React 通过 REST 与现有 NDJSON 流式接口访问单体 FastAPI。FastAPI 使用 SQLAlchemy 访问本地 Docker MySQL，并在启动时幂等初始化固定 `zhan-v1` Mock 行情、指标和事件。价格变化、区域价差、趋势方向、证据完整度、关注触发和采购建议骨架由确定性 Python 计算；LangChain 只基于工具返回的结构化证据进行解释并生成操作预览。写操作由用户确认后通过业务 API 执行。

**Tech Stack:** Python 3.12、FastAPI、SQLAlchemy 2、PyMySQL、Pydantic 2、LangChain 1.x、React 18、TypeScript、Tailwind CSS 4、Recharts、Vitest、Testing Library、Playwright、本地 Docker MySQL 8.4。

---

## Global Constraints

- 行情价格、区域价格、指标、事件全部来自固定 `zhan-v1` Mock 数据，统一 `data_kind=simulated`。
- 用户采购条件和关注阈值标记 `data_kind=user_input`。
- 趋势、价差、事件影响、研判和关注结果标记 `data_kind=inference`。
- UI 常驻显示“当前为演示行情”，不得写“官方价格”“公开事实”“实时行情”或“刚刚同步”。
- 不实现公开接口客户端、HTML/JSON 解析器、HTTP 抓取、后台同步、手动数据刷新、最后成功快照或新鲜度。
- 不增加 `APScheduler`、行情刷新环境变量或真实/演示模式切换。
- 关注条件在创建、修改、打开页面或用户点击“重新检查”时用当前 Mock 数据即时计算，不做定时轮询。
- Agent 统一使用 LangChain，但模型不计算数值指标、不自行触发写操作。
- 研判必须包含支持依据、反对依据、失效条件和演示数据声明。
- 用户确认后才能保存研判、创建关注或交接粮小二。
- 不做自动采购、询价、下单、签约、付款或外部消息通知。
- 不引入消息队列、向量数据库、独立流系统或多 Agent 编排平台。
- 每个 Task 测试先行，完成后检查差异。
- 不自动创建 Git commit。

---

## 从原计划中移除的工作

以下内容不进入首版实现：

- 国家粮食交易中心或其他公开行情、资讯来源。
- `national_grain_client.py` 及公开响应 fixture。
- `HTTPX` 行情抓取与接口适配。
- `sync.py`、`start_market_scheduler()` 和自适应更新。
- `APScheduler` 行情/关注后台任务。
- `source_name`、`source_url`、`source_published_at`、`fetched_at`、`freshness` 字段。
- `classify_freshness()` 及过期数据判断。
- `/api/market/refresh` 手动刷新接口。
- 启动时官方同步和页面打开时自动同步。
- `DEMO_MODE` 下的公开/模拟模式分支。
- 公开数据失败、空响应和最后成功快照逻辑。

公开数据接入只保留为设计文档中的后续方向，不为其预建首版代码。

---

## 文件结构与职责

### 后端新增或实现

```text
backend/app/market/
├── __init__.py
├── models.py                # Mock 行情、指标和事件
├── schemas.py               # 市场 REST Schema
├── metrics.py               # 变化、价差、方向、完整度计算
├── repository.py            # 行情查询
├── service.py               # 全景与品种聚合
├── routes.py                # /api/market/*
└── mock_seed.py             # 固定 zhan-v1 数据集

backend/app/workflow/
├── models.py                # 研判、关注、会话、交接
├── schemas.py
├── repository.py
├── service.py
└── routes.py

backend/app/agent/
├── schemas.py
├── prompt.py
├── tools.py
├── service.py
└── routes.py

backend/tests/market/
├── test_models.py
├── test_metrics.py
├── test_mock_seed.py
├── test_repository.py
└── test_routes.py

backend/tests/workflow/
├── test_service.py
└── test_routes.py

backend/tests/agent/
├── test_schemas.py
├── test_tools.py
├── test_service.py
└── test_routes.py
```

### 后端修改

```text
backend/app/database.py
backend/app/main.py
backend/tests/conftest.py
pyproject.toml              # 仅保留实际需要的依赖
```

### 前端新增或实现

```text
web/src/features/zhan/
├── api.ts
├── types.ts
├── ZhanPage.tsx
├── ZhanPage.test.tsx
├── ZhanContext.tsx
├── ZhanShell.tsx
├── components/
│   ├── DemoMarketBanner.tsx
│   ├── ZhanTabs.tsx
│   ├── VarietyPulse.tsx
│   ├── PriceChart.tsx
│   ├── RegionPriceTable.tsx
│   ├── MarketJudgment.tsx
│   ├── MarketEventList.tsx
│   ├── ZhanChatDrawer.tsx
│   ├── ActionProposalCard.tsx
│   ├── EvidenceList.tsx
│   └── ProcurementForm.tsx
├── hooks/
│   ├── useMarketOverview.ts
│   ├── useProcurementAnalysis.ts
│   └── useZhanChat.ts
└── tabs/
    ├── OverviewTab.tsx
    ├── VarietyTab.tsx
    ├── AnalysisTab.tsx
    ├── WatchesTab.tsx
    └── RecordsTab.tsx

web/e2e/zhan.spec.ts
```

### 前端修改

```text
web/src/App.tsx
web/src/pages/agents/AgentServicePage.tsx
web/src/pages/MyTasks.tsx
web/src/index.css
vite.config.ts
playwright.config.ts
```

---

## Task 1: 建立 Mock-first 市场与工作流数据模型

**Files:**

- Create/Modify: `backend/app/market/models.py`
- Create/Modify: `backend/app/market/schemas.py`
- Create/Modify: `backend/app/workflow/models.py`
- Create/Modify: `backend/app/workflow/schemas.py`
- Create: `backend/tests/market/test_models.py`
- Modify: `backend/app/database.py`
- Modify: `backend/tests/conftest.py`

### Step 1: 写模型失败测试

覆盖：

- `MarketPrice` 保存品种、等级、地区、价格口径、固定演示时间和数据集版本。
- `MarketMetric` 保存库存、到货、成交或供应强弱指标。
- `MarketEvent` 保存固定事件时间和演示内容。
- 三类市场记录均为 `data_kind=simulated`。
- `AnalysisRecord` 保存用户条件、指标快照、规则版本和结构化结果。
- `WatchCondition` 保存条件、状态、最近检查时间和触发原因。
- `HandoffTask` 可承载瞻到粮的结构化 payload。

示例：

```python
def test_market_price_has_mock_metadata(db_session):
    price = MarketPrice(
        point_code="ZHAN-V1-CORN-NE-20260822",
        variety_code="corn",
        variety_name="玉米",
        grade_name="二等",
        region_code="north_east",
        region_name="东北",
        quote_type="出库价",
        price=2320,
        unit="元/吨",
        observed_at=datetime(2026, 8, 22, 9, 0, tzinfo=CHINA_TZ),
        data_kind="simulated",
        mock_dataset_version="zhan-v1",
        mock_generated_at=MOCK_GENERATED_AT,
    )
    db_session.add(price)
    db_session.commit()
    assert price.data_kind == "simulated"
```

### Step 2: 运行测试确认失败

```bash
cd backend
uv run pytest tests/market/test_models.py -q
```

Expected: FAIL，模型字段尚未实现。

### Step 3: 实现市场模型

`MarketPrice`：

- `point_code` 稳定唯一键。
- 品种、等级、地区。
- `quote_type`、含税/含运口径、价格、单位。
- `observed_at` 演示时间。
- `data_kind`、`mock_dataset_version`、`mock_generated_at`。
- `created_at`、`updated_at`。

`MarketMetric`：

- `metric_code` 稳定唯一键。
- 品种、地区、指标类型、数值、单位和演示时间。
- Mock 元信息。

`MarketEvent`：

- `event_code` 稳定唯一键。
- 标题、摘要、品种、地区和 `event_at`。
- Mock 元信息。

不要保留 `source_name`、`source_url`、`source_published_at`、`fetched_at` 或 `freshness`。

### Step 4: 实现工作流模型

保持简单：

- `AnalysisRecord`：输入 JSON、指标快照 JSON、结果 JSON、规则版本、数据集版本。
- `WatchCondition`：条件 JSON、状态、最近检查时间、触发说明。
- 会话、消息和交接复用现有模型。
- 写接口使用 `request_token` 实现重复点击幂等。

首版不添加软删除、任务调度表或事件出站表。

### Step 5: 实现 Schema

市场响应统一包含：

```python
data_kind: Literal["simulated"] = "simulated"
mock_dataset_version: str
mock_generated_at: datetime
```

研判结果包含 `mock_data_notice`。所有 Decimal 以字符串返回，避免前端浮点误差。

### Step 6: 验证

```bash
cd backend
uv run pytest tests/market/test_models.py -q
git diff --check
```

Expected: PASS。

---

## Task 2: 实现固定 `zhan-v1` 数据集、Repository 与指标计算

**Files:**

- Create/Modify: `backend/app/market/mock_seed.py`
- Create/Modify: `backend/app/market/repository.py`
- Create/Modify: `backend/app/market/metrics.py`
- Create: `backend/tests/market/test_mock_seed.py`
- Create: `backend/tests/market/test_repository.py`
- Create/Modify: `backend/tests/market/test_metrics.py`
- Modify: `backend/app/main.py`

### Step 1: 写固定种子失败测试

要求：

- 重复执行种子不新增记录。
- 所有记录为 `simulated` 和 `zhan-v1`。
- 玉米有 30 天价格序列、多区域价格、指标和正反事件。
- 小麦为震荡、大豆偏弱、稻谷证据不足。
- 没有随机值，没有网络请求。
- 每条记录有稳定业务唯一键。

```python
def test_zhan_seed_is_idempotent(db_session):
    seed_zhan_mock_data(db_session)
    first = market_counts(db_session)
    seed_zhan_mock_data(db_session)
    assert market_counts(db_session) == first
```

### Step 2: 定义数据集常量

```python
MOCK_DATASET_VERSION = "zhan-v1"
MOCK_GENERATED_AT = datetime(2026, 8, 22, 10, 0, tzinfo=CHINA_TZ)
```

固定数据显式维护在 Python 列表中，不从外部 JSON 下载。价格序列不得在启动时随机生成。

### Step 3: 实现 Repository

提供：

- `list_varieties()`
- `get_latest_prices(variety_code)`
- `get_price_series(variety_code, region_code, range_days)`
- `get_region_prices(variety_code)`
- `get_metrics(variety_code)`
- `get_events(variety_code)`

默认排序使用演示时间和稳定业务键。查询使用 SQLAlchemy 参数化条件。

### Step 4: 写指标失败测试

覆盖：

- 日变化、周变化。
- 同口径区域价差。
- 价格方向分类。
- 波动区间。
- 证据完整度。
- 缺少基准点时返回缺失状态。
- 口径不同时不比较。
- 相同输入输出稳定。

### Step 5: 实现纯函数指标

至少包含：

- `compute_change(current, previous)`
- `compute_spread(left, right)`
- `classify_direction(series)`
- `compute_volatility_band(series)`
- `compute_evidence_completeness(required, available)`

删除 `classify_freshness()`。指标函数不访问数据库、不调用 LangChain。

### Step 6: 接入 lifespan

建表后执行 `seed_zhan_mock_data()`，不依赖 `DEMO_MODE`。初始化失败记录日志并允许应用启动，以便健康检查和错误页工作；不得回退到公开数据或随机行情。

### Step 7: 验证

```bash
cd backend
uv run pytest tests/market/test_mock_seed.py tests/market/test_repository.py tests/market/test_metrics.py -q
git diff --check
```

Expected: PASS；测试过程没有网络请求。

---

## Task 3: 实现市场全景与品种行情 API

**Files:**

- Create/Modify: `backend/app/market/service.py`
- Create/Modify: `backend/app/market/routes.py`
- Create/Modify: `backend/tests/market/test_routes.py`
- Modify: `backend/app/main.py`

### Step 1: 写 API 失败测试

覆盖：

- `GET /api/market/overview`。
- `GET /api/market/varieties/{code}`。
- `GET /api/market/varieties/{code}/prices`。
- `GET /api/market/varieties/{code}/regions`。
- `GET /api/market/varieties/{code}/events`。
- 四品种全景和默认玉米。
- 7/30/90 天范围。
- 不存在品种返回 404。
- 响应带 `simulated`、`zhan-v1` 和生成时间。
- 不存在 `/api/market/refresh`。

```python
def test_overview_exposes_mock_metadata(client, seeded_market):
    body = client.get("/api/market/overview").json()
    assert body["data_kind"] == "simulated"
    assert body["mock_dataset_version"] == "zhan-v1"
    assert "freshness" not in body
    assert "source_url" not in body
```

### Step 2: 运行测试确认失败

```bash
cd backend
uv run pytest tests/market/test_routes.py -q
```

### Step 3: 实现全景聚合

返回：

- 四品种行情脉搏。
- 选中品种价格曲线。
- 重点区域价格。
- 演示事件。
- 确定性市场判断骨架。
- 支持/反对证据。
- 证据完整度和缺失字段。
- Mock 元信息。

判断标题使用“瞻小二演示判断”，不得写“今日真实判断”。

### Step 4: 实现品种详情

包含：

- 核心指标。
- 价格形成链。
- 供给、需求、库存物流、政策事件四类驱动。
- 支持与反对证据。
- 下一步动作建议。

证据只引用本地对象 ID，不返回外部来源链接。

### Step 5: 实现缺失数据降级

稻谷等证据不足场景：

- 缺失指标显示 `--`。
- `missing_data` 列出字段。
- 降低 `evidence_completeness`。
- 不返回强行动文案。

### Step 6: 验证

```bash
cd backend
uv run pytest tests/market/test_routes.py -q
git diff --check
```

Expected: PASS。

---

## Task 4: 实现确定性采购研判与关注判断

**Files:**

- Create/Modify: `backend/app/workflow/service.py`
- Create: `backend/app/workflow/judgment.py`
- Create: `backend/tests/workflow/test_judgment.py`
- Create/Modify: `backend/tests/workflow/test_service.py`

### Step 1: 写采购研判失败测试

代表条件：

- 品种：玉米。
- 数量：120 吨。
- 地区：东北。
- 等级：二等。
- 采购窗口：15 天。

断言：

- 行动为 `staged_purchase`。
- 建议比例区间为 40%～60%。
- 有支持和反对证据。
- 有失效条件和继续关注指标。
- 带 `zhan-v1` 与演示声明。
- 相同输入重复执行结果一致。
- 关键数据不足时动作降级为 `verify_first`。

### Step 2: 写关注判断失败测试

覆盖：

- 价格低于/高于阈值。
- 日变化或周变化阈值。
- 区域价差阈值。
- 指标方向变化。
- 指定演示事件。
- 缺少数据进入 `data_pending`。
- 当前值满足时立即 `triggered`。
- 不依赖系统定时器。

### Step 3: 实现研判输入与结果

```python
class ProcurementInput(BaseModel):
    variety_code: str
    quantity_tons: Decimal
    required_by: date
    grade_name: str | None = None
    target_region: str | None = None
    max_price: Decimal | None = None
    inventory_days: int | None = None
    risk_preference: Literal["low", "medium", "high"] = "medium"

class ProcurementJudgment(BaseModel):
    action: Literal["buy_now", "staged_purchase", "wait", "verify_first"]
    purchase_ratio_range: tuple[int, int] | None
    time_window: str
    supporting_evidence: list[EvidenceItem]
    opposing_evidence: list[EvidenceItem]
    invalidation_conditions: list[str]
    watch_metrics: list[str]
    missing_data: list[str]
    evidence_completeness: Literal["high", "medium", "low"]
    mock_data_notice: str
```

### Step 4: 实现纯 Python 规则

- 先计算价格方向、区域价差、波动、指标方向和事件影响。
- 再根据采购窗口、库存天数和风险偏好生成建议骨架。
- 规则输出证据 ID 和原因码。
- LangChain 不参与数值或行动类型计算。
- 不输出精确到个位数的采购比例。

### Step 5: 实现关注即时判断

`evaluate_watch_condition(condition, market_snapshot)` 为纯函数。Service 在以下时机调用：

- 创建关注后。
- 修改关注后。
- 列出关注时。
- `POST /api/watches/{id}/evaluate` 时。

“重新检查”只重算，不改变 Mock 数据。不要创建 `workflow/scheduler.py`。

### Step 6: 验证

```bash
cd backend
uv run pytest tests/workflow/test_judgment.py tests/workflow/test_service.py -q
git diff --check
```

Expected: PASS。

---

## Task 5: 持久化研判、关注、会话和瞻到粮交接

**Files:**

- Create/Modify: `backend/app/workflow/repository.py`
- Modify: `backend/app/workflow/service.py`
- Create/Modify: `backend/tests/workflow/test_service.py`

### Step 1: 写工作流失败测试

覆盖：

- `preview` 计算研判但不写数据库。
- 保存研判保留用户输入、指标、事件和规则版本快照。
- 重新研判创建新记录，不覆盖旧记录。
- 创建关注立即计算状态。
- 打开关注列表重新计算当前状态。
- 相同 `request_token` 不重复保存或交接。
- 瞻到粮 payload 包含采购约束、研判摘要和 Mock 声明。
- 交接不替粮小二选择最终粮源。

### Step 2: 实现 Repository

提供：

- `create_analysis_record`
- `list_analysis_records`
- `get_analysis_record`
- `create_watch`
- `update_watch`
- `list_watches`
- `save_watch_evaluation`
- `create_handoff_once`

只用普通事务完成一次请求，不增加软删除或后台一致性机制。

### Step 3: 实现保存研判

保存：

- 用户条件快照，`data_kind=user_input`。
- `zhan-v1` 数据集版本。
- 使用的价格、指标和事件 ID。
- 确定性指标快照。
- 结构化研判结果，`data_kind=inference`。
- 创建时间。

### Step 4: 实现瞻到粮交接

交接 payload 至少包含：

- 品种、数量、等级、目标地区。
- 最晚采购/使用时间。
- 预算与价格口径。
- 采购节奏建议和风险摘要。
- 继续关注指标。
- `market_data_kind="simulated"`。
- `mock_dataset_version="zhan-v1"`。

目标 `agent_id=liang`。确认后生成预填任务，不自动触发粮小二推荐。

### Step 5: 验证

```bash
cd backend
uv run pytest tests/workflow/test_service.py -q
git diff --check
```

Expected: PASS。

---

## Task 6: 实现 LangChain 瞻小二 Schema、Tools 与服务

**Files:**

- Create/Modify: `backend/app/agent/schemas.py`
- Create/Modify: `backend/app/agent/prompt.py`
- Create/Modify: `backend/app/agent/tools.py`
- Create/Modify: `backend/app/agent/service.py`
- Create/Modify: `backend/tests/agent/test_schemas.py`
- Create/Modify: `backend/tests/agent/test_tools.py`
- Create/Modify: `backend/tests/agent/test_service.py`

### Step 1: 写 Agent 失败测试

覆盖：

- Tools 返回 `zhan-v1` 证据和 ID。
- Tools 均为只读。
- 模型不能自行计算价格变化或采购行动类型。
- 回答明确当前是演示行情。
- 结论包含支持和反对证据。
- 写意图只返回 `ActionProposal`。
- 模型失败时返回确定性研判骨架。

### Step 2: 定义只读 Tools

- `get_market_overview`
- `get_price_series`
- `get_region_prices`
- `get_market_events`
- `get_procurement_context`
- `get_watch_conditions`
- `get_analysis_record`
- `preview_procurement_judgment`

最后一个 Tool 调用 Task 4 规则，不让模型自由决定行动类型。

### Step 3: 编写系统提示

必须说明：

- 当前市场事实全部来自 `zhan-v1` Mock 数据。
- 不得称为官方、公开、实时或真实价格。
- 引用证据 ID。
- 不虚构缺失指标。
- 同时呈现支持与反对依据。
- 写操作只生成确认卡。
- 不展示内部思维链。

### Step 4: 实现结构化输出与回退

Pydantic 校验 `ProcurementJudgment` 和 `ActionProposal`。结构不合法时允许一次受控修复；仍失败则返回普通 Python 生成的研判骨架。

### Step 5: 实现 NDJSON 事件

沿用现有协议：

- `status`
- `text_delta`
- `evidence_reference`
- `analysis_reference`
- `action_proposal`
- `done`
- `error`

状态只显示“正在读取演示行情”等业务摘要。

### Step 6: 验证

```bash
cd backend
uv run pytest tests/agent/test_schemas.py tests/agent/test_tools.py tests/agent/test_service.py -q
git diff --check
```

Expected: PASS。

---

## Task 7: 暴露研判、关注、Agent 与交接 API

**Files:**

- Create/Modify: `backend/app/workflow/routes.py`
- Create/Modify: `backend/app/agent/routes.py`
- Create/Modify: `backend/tests/workflow/test_routes.py`
- Create/Modify: `backend/tests/agent/test_routes.py`
- Modify: `backend/app/main.py`

### Step 1: 写 API 失败测试

覆盖：

- `POST /api/analysis/preview` 不写库。
- `POST /api/analysis` 保存确认后的结果。
- `GET /api/analysis` 和 `GET /api/analysis/{id}`。
- `POST /api/analysis/{id}/handoffs/liang`。
- 关注查询、创建、修改和重新检查。
- Agent 会话与流式消息。
- 相同 `request_token` 幂等。
- 请求不匹配的会话或对象返回 404/403。
- 模型错误事件不破坏已保存状态。

### Step 2: 实现 REST 路由

```text
POST /api/analysis/preview
POST /api/analysis
GET  /api/analysis
GET  /api/analysis/{id}
POST /api/analysis/{id}/handoffs/liang

GET   /api/watches
POST  /api/watches
PATCH /api/watches/{id}
POST  /api/watches/{id}/evaluate
```

写接口必须包含 `request_token`。非法输入 422，状态冲突 409，不存在 404。

### Step 3: 实现 Agent 路由

会话中的 `agent_id=zhan` 使用瞻小二 LangChain 服务。保持统一会话和 NDJSON 协议，为后续粮小二分派留下直接映射，不另建专用聊天表。

### Step 4: 集成我的办事状态

关注触发和交接任务复用现有 workflow 数据，不建立第二套任务中心：

- `triggered` 关注进入待确认。
- 瞻到粮交接显示来源、目标和状态。
- 点击交接任务可进入粮小二并带 `task_id`。

### Step 5: 验证

```bash
cd backend
uv run pytest tests/market tests/workflow tests/agent -q
git diff --check
```

Expected: PASS。

---

## Task 8: 建立前端测试、类型、API、专属路由与上下文

**Files:**

- Create/Modify: `web/src/features/zhan/types.ts`
- Create/Modify: `web/src/features/zhan/api.ts`
- Create/Modify: `web/src/features/zhan/ZhanContext.tsx`
- Create/Modify: `web/src/features/zhan/ZhanShell.tsx`
- Create/Modify: `web/src/features/zhan/ZhanPage.tsx`
- Create/Modify: `web/src/features/zhan/ZhanPage.test.tsx`
- Create: `web/src/features/zhan/components/DemoMarketBanner.tsx`
- Create/Modify: `web/src/features/zhan/components/ZhanTabs.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/pages/agents/AgentServicePage.tsx`
- Modify: `vite.config.ts`
- Modify: `playwright.config.ts`

### Step 1: 写页面骨架失败测试

覆盖：

- `/agent/zhan` 渲染专属页面。
- 默认 Tab 为市场全景。
- 五个 Tab 可切换。
- 常驻显示“当前为演示行情”、`zhan-v1` 和生成时间。
- 默认品种为玉米。
- 切换 Tab 保留当前品种。
- 对话入口在所有 Tab 可见。
- 不显示刷新和数据模式切换。

### Step 2: 定义前端类型

```ts
export type DataKind = "simulated" | "user_input" | "inference";

export interface MockMarketMeta {
  data_kind: "simulated";
  mock_dataset_version: string;
  mock_generated_at: string;
}

export interface PricePoint extends MockMarketMeta {
  id: number;
  observed_at: string;
  price: string;
  unit: string;
  region_code: string;
  quote_type: string;
}
```

不要定义 `source_url`、`fetched_at` 或 `freshness`。

### Step 3: 实现 API Client

封装市场、研判、关注、记录和 Agent 接口。普通请求失败统一转换为可展示错误；NDJSON 使用单独流式解析器。

### Step 4: 实现 Context

管理：

- 当前 Tab。
- 当前品种、地区和时间范围。
- 当前采购输入与研判。
- 选中价格点或事件。
- 对话抽屉状态。

服务端列表数据由 Hook 加载，不引入复杂全局状态库。

### Step 5: 实现路由和 Banner

`AgentServicePage` 遇到 `agentId === "zhan"` 时渲染 `ZhanPage`。Banner 固定文案：

> 当前为竞赛演示行情，仅用于功能演示，不代表真实市场，也不可直接作为交易依据。

### Step 6: 验证

```bash
cd web
npm test -- --run src/features/zhan/ZhanPage.test.tsx
npm run build
git diff --check
```

Expected: PASS。

---

## Task 9: 实现跨 Tab 常驻对话、证据引用与确认卡

**Files:**

- Create/Modify: `web/src/features/zhan/hooks/useZhanChat.ts`
- Create/Modify: `web/src/features/zhan/components/ZhanChatDrawer.tsx`
- Create/Modify: `web/src/features/zhan/components/ActionProposalCard.tsx`
- Create/Modify: `web/src/features/zhan/components/EvidenceList.tsx`
- Modify: `web/src/features/zhan/ZhanShell.tsx`
- Create: `web/src/features/zhan/components/ZhanChatDrawer.test.tsx`

### Step 1: 写对话失败测试

覆盖：

- 五个 Tab 都能打开对话。
- 切换 Tab 或品种不丢消息。
- 当前品种、筛选、研判和选中证据随消息发送。
- NDJSON 文本、状态、证据引用、研判引用和错误正常渲染。
- Agent 明确使用演示行情。
- 操作提案先展示确认卡。
- 重复点击确认只提交一次。
- 收起抽屉不清消息。

### Step 2: 实现流式 Hook

- 创建/复用 `agent_id=zhan` 会话。
- 逐行解析 NDJSON。
- 支持 `AbortController`。
- 品种或任务变化时插入本地上下文提示。
- 卸载时取消请求。

### Step 3: 实现证据引用

价格点、区域价格、指标和事件引用点击后切换到对应 Tab 并高亮对象。只展示业务证据，不展示模型思维链。

### Step 4: 实现确认卡

支持：

- `save_analysis`
- `create_watch`
- `update_watch`
- `handoff_to_liang`

每张卡使用稳定 `request_token`。成功后刷新对应状态；失败保留卡片并允许重试。

### Step 5: 实现响应式抽屉

桌面右侧 400px，窄屏底部全屏。占位：

> 问瞻小二行情，或描述你的采购计划……

### Step 6: 验证

```bash
cd web
npm test -- --run src/features/zhan/components/ZhanChatDrawer.test.tsx
git diff --check
```

Expected: PASS。

---

## Task 10: 实现市场全景与品种行情

**Files:**

- Create/Modify: `web/src/features/zhan/hooks/useMarketOverview.ts`
- Create/Modify: `web/src/features/zhan/components/VarietyPulse.tsx`
- Create/Modify: `web/src/features/zhan/components/PriceChart.tsx`
- Create/Modify: `web/src/features/zhan/components/RegionPriceTable.tsx`
- Create/Modify: `web/src/features/zhan/components/MarketJudgment.tsx`
- Create/Modify: `web/src/features/zhan/components/MarketEventList.tsx`
- Create/Modify: `web/src/features/zhan/tabs/OverviewTab.tsx`
- Create/Modify: `web/src/features/zhan/tabs/VarietyTab.tsx`
- Create: `web/src/features/zhan/tabs/OverviewTab.test.tsx`
- Create: `web/src/features/zhan/tabs/VarietyTab.test.tsx`
- Modify: `web/src/index.css`

### Step 1: 写页面失败测试

覆盖：

- 四品种脉搏和默认玉米。
- 7/30/90 天曲线。
- 区域价格与口径不可比状态。
- 演示事件和影响推断分开显示。
- 支持/反对证据同时出现。
- 稻谷数据不足时不显示强结论。
- 每个区域清楚显示演示数据标签。
- 无“官方来源”“实时”“同步”或刷新按钮。
- 加载、空数据和错误状态完整。

### Step 2: 实现市场 Hook

- 全景请求和选中品种请求按需加载。
- 切换品种取消旧请求。
- 时间范围只查询固定数据集子区间。
- 普通“重试”只重试 API，不改变行情数据。

### Step 3: 实现科技风全景

使用深色背景、青色趋势、琥珀色演示标识和紧凑信息布局。图表不使用大面积装饰渐变掩盖数据；tooltip 显示品种、地区、等级、价格口径、单位和演示时间。

### Step 4: 实现市场判断和事件交互

规则骨架始终可见；LangChain 解释可作为增强。点击事件同步高亮曲线时间点和右侧解释。

### Step 5: 实现品种行情

展示核心指标、价格形成链、四类驱动因素、支持/反对证据和继续动作。缺失字段明确写原因。

### Step 6: 验证

```bash
cd web
npm test -- --run \
  src/features/zhan/tabs/OverviewTab.test.tsx \
  src/features/zhan/tabs/VarietyTab.test.tsx
git diff --check
```

Expected: PASS。

---

## Task 11: 实现采购研判、关注、记录与我的办事联动

**Files:**

- Create/Modify: `web/src/features/zhan/hooks/useProcurementAnalysis.ts`
- Create/Modify: `web/src/features/zhan/components/ProcurementForm.tsx`
- Create/Modify: `web/src/features/zhan/tabs/AnalysisTab.tsx`
- Create/Modify: `web/src/features/zhan/tabs/WatchesTab.tsx`
- Create/Modify: `web/src/features/zhan/tabs/RecordsTab.tsx`
- Create: `web/src/features/zhan/tabs/AnalysisTab.test.tsx`
- Create: `web/src/features/zhan/tabs/WatchesTab.test.tsx`
- Create: `web/src/features/zhan/tabs/RecordsTab.test.tsx`
- Modify: `web/src/pages/MyTasks.tsx`

### Step 1: 写采购研判失败测试

覆盖：

- 三个必填条件校验。
- 玉米代表条件稳定显示“分批采购”和 40%～60%。
- 支持、反对证据和失效条件可见。
- 页面常驻演示声明。
- 数据不足时显示“先核验”。
- 保存和交接先确认。
- 修改条件重新研判不会覆盖旧记录。

### Step 2: 写关注与记录失败测试

覆盖：

- 创建关注后立即显示 `monitoring` 或 `triggered`。
- “重新检查”不显示数据刷新文案。
- 缺少指标显示 `data_pending`。
- 暂停和关闭需要确认。
- 历史记录显示条件、数据集版本、证据和交接状态。
- 我的办事显示触发关注和瞻到粮交接。

### Step 3: 实现采购研判页

布局：

1. 采购条件表单。
2. 规则化计算状态。
3. 行动结论与比例区间。
4. 支持证据。
5. 反对依据和失效条件。
6. 继续关注指标。
7. 演示数据声明。
8. 保存、关注和交接动作。

模型失败时仍渲染规则化结果。

### Step 4: 实现我的关注

创建/修改后调用后端即时判断。用户点击“重新检查”时只调用 `evaluate` API。页面解释：

> 当前检查基于固定 zhan-v1 演示行情，不会获取或生成新行情。

### Step 5: 实现研判记录

列表展示品种、数量、行动、保存时间和交接状态。详情展示输入与证据快照。点击“按此条件重新研判”只回填表单。

### Step 6: 集成我的办事

复用现有任务卡：

- 触发关注显示“待确认”。
- 交接任务显示来源瞻小二、目标粮小二和状态。
- 点击粮小二交接进入 `/agent/liang?task_id=...`。

### Step 7: 验证

```bash
cd web
npm test -- --run \
  src/features/zhan/tabs/AnalysisTab.test.tsx \
  src/features/zhan/tabs/WatchesTab.test.tsx \
  src/features/zhan/tabs/RecordsTab.test.tsx
git diff --check
```

Expected: PASS。

---

## Task 12: 完成无网络 E2E、视觉检查、文档与全量验证

**Files:**

- Create/Modify: `web/e2e/zhan.spec.ts`
- Modify: `README.md`
- Review: `docs/superpowers/specs/2026-08-22-zhan-xiaoer-design.md`
- Review: `docs/superpowers/plans/2026-08-22-zhan-xiaoer-implementation.md`
- Review: `docs/粮达e销产品设计文档-V2.md`

### Step 1: 编写核心 E2E

流程：

1. 打开 `/agent/zhan`。
2. 看到“当前为演示行情”和 `zhan-v1`。
3. 查看玉米 30 天曲线、区域价格和事件。
4. 切换品种后图表、判断和事件同步。
5. 输入“15 天内采购 120 吨东北二等玉米”。
6. 得到分批采购、40%～60%、支持/反对证据。
7. 确认保存研判。
8. 创建价格关注并即时检查。
9. 确认交接粮小二。
10. 在我的办事打开交接任务。

### Step 2: 建立稳定测试环境

- 本地 MySQL 使用幂等 `zhan-v1`。
- E2E 不访问任何公开网站。
- 浏览器层固定 Agent NDJSON 响应，避免比赛和 CI 依赖真实模型。
- 后端单测单独验证 LangChain 工具绑定。
- 不随机生成曲线、事件或关注状态。
- Playwright webServer 不需要 `DEMO_MODE`。

### Step 3: 运行后端全量测试

```bash
cd backend
uv run pytest -q
```

Expected: PASS。

### Step 4: 运行前端全量测试与构建

```bash
cd web
npm test -- --run
npm run build
npx playwright test e2e/zhan.spec.ts
```

Expected: PASS。

### Step 5: 做无外网依赖审计

```bash
rg -n "grainmarket|national_grain|httpx|APScheduler|scheduler|source_url|fetched_at|freshness|market/refresh|DEMO_MODE" \
  backend/app/market backend/app/agent backend/app/workflow web/src/features/zhan README.md
```

Expected: 瞻小二首版代码无相关实现；其他既有模块若有匹配，确认未被瞻小二调用。

检查误导文案：

```bash
rg -n "官方价格|公开事实|实时行情|刚刚同步|数据已刷新" web/src/features/zhan
```

Expected: 无匹配。

### Step 6: 视觉检查

桌面和窄屏检查：

- 五个 Tab、Banner 和常驻对话。
- 图表 tooltip 和事件联动。
- 研判证据层级。
- 确认卡和错误状态。
- 长标题、空数据和 `data_pending`。
- 科技风一致，但信息密度高于装饰。

### Step 7: 更新 README 与产品文档

README 明确：

- 瞻小二首版仅使用固定 `zhan-v1` Mock 行情。
- 启动时自动幂等初始化。
- 不需要公开接口密钥、行情刷新变量或外网。
- 所有价格、指标和事件仅用于演示。
- FastAPI、本地 Docker MySQL、React 和测试启动方式。

产品文档不得声称真实行情、实时同步、自动采购或完整真实粮源搜索已实现。

### Step 8: 最终验收与差异检查

逐项核对设计文档第 5～17 节，然后运行：

```bash
git diff --check
git status --short
git diff --stat
```

只补遗漏的最小测试与实现，不扩展首版范围，不自动提交。

---

## 执行顺序与依赖

```text
Task 1 市场与工作流模型
  └─ Task 2 zhan-v1、Repository 与指标
       ├─ Task 3 市场全景与品种 API
       └─ Task 4 确定性采购研判与关注
            └─ Task 5 研判、关注与交接持久化
                 ├─ Task 6 LangChain Tools 与服务
                 │    └─ Task 7 业务与 Agent API
                 └─ Task 8 前端类型、路由与上下文
                      └─ Task 9 常驻对话与确认卡
                           └─ Task 10 市场全景与品种行情
                                └─ Task 11 研判/关注/记录/我的办事
                                     └─ Task 12 E2E、视觉与全量验证
```

Task 3 和 Task 4 可在 Task 2 后分别开发，但进入 Task 6 前必须统一证据 Schema。前端若先行，只能使用与 `zhan-v1` 一致的 fixture，不得另造第二套行情逻辑。

---

## 完成定义

全部满足才算完成：

- `/agent/zhan` 默认显示四品种演示市场全景。
- 页面持续显示“当前为演示行情”和 `zhan-v1`。
- 本地 MySQL 可幂等初始化固定价格、指标和事件。
- 瞻小二不依赖公开接口、外网、同步任务、调度器或刷新配置。
- 价格变化、价差、趋势、证据完整度和关注判断由确定性代码计算。
- 玉米代表采购条件稳定输出分批采购和 40%～60% 建议。
- 建议同时包含支持、反对依据和失效条件。
- LangChain 对话在五个 Tab 常驻并共享业务上下文。
- 写操作先确认，模型不能直接写库。
- 关注创建和打开时即时判断，不使用后台轮询。
- 研判记录保存用户条件、证据和数据集版本快照。
- 瞻到粮交接可确认、重试且幂等。
- 我的办事可查看触发关注和交接任务。
- 模型不可用时市场页面和规则化研判仍可用。
- 后端、前端、构建和 E2E 测试全部通过。
- 竞赛演示断网后仍可完成市场浏览、研判、关注检查和交接。
- 没有自动 Git commit。

