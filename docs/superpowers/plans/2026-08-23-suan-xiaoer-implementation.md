# 算小二 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/agent/suan` 从通用占位页实现为支持多来源方案录入、统一到厂成本、单笔业务盈亏推演、可验证降本建议和版本追踪的算小二专业服务页。

**Architecture:** 新增独立的 `backend/app/calculation` 领域模块，使用 SQLAlchemy/MySQL 保存测算任务、方案身份、版本快照和降本行动；普通 Python + Decimal 完成全部成本、毛利、情景和排序计算，LangChain + Qwen 只做报价字段提取和确定性结果解释。前端新增 `web/src/features/suan`，五个 Tab 共享当前任务、版本与对话上下文，通过现有 `/agent/:id` 路由接入。

**Tech Stack:** Python 3.12、FastAPI、SQLAlchemy 2、Pydantic 2、MySQL/SQLite tests、LangChain `ChatOpenAI`、React 18、TypeScript 5.6、Tailwind CSS 4、Vite 6。

**Spec:** `docs/superpowers/specs/2026-08-23-suan-xiaoer-design.md`

## Global Constraints

- 始终使用简体中文进行产品文案、注释和交付说明；技术标识保留英文。
- 不自动执行 `git commit`；每个任务结束只运行测试并设置人工审查检查点。
- 沿用 FastAPI、本地 Docker MySQL、React 和 LangChain，不引入状态管理、财务、工作流或图表新框架。
- 默认 Tab 顺序固定为：`方案测算 → 成本对比 → 盈亏推演 → 降本助手 → 测算任务`。
- 所有正式成本、毛利、盈亏平衡点和情景差值必须由 Decimal 确定性规则计算；模型不得生成或修改正式数字。
- 报价解析、估算口径、选择意向方案、保存情景、采用降本建议和跨小二交接均需用户确认。
- 数据来源必须区分 `confirmed`、`user_input`、`handoff`、`estimated`、`missing`、`inference`。
- 竞赛首版使用固定 `suan-v1` 演示数据，页面以“参考口径、估算、待确认、更新时间”表达，不在主界面醒目标注 Mock。
- 首版按整批采购、整批销售计算，不处理未售库存估值、企业会计净利润、税务筹划或完整损益表。
- 首版不自动读取微信/邮箱、不做 OCR、不自动联系供应方、不自动执行交易、不自动邀请其他小二。
- 深色科技风沿用现有色板；紫色为算小二局部强调色，青绿表达已确认与正向结果，琥珀色表达估算与待确认。
- 只修改算小二所需文件及必要的路由/模型注册，不重构瞻小二、行情或关注功能。

---

## File Structure

### Backend

- `backend/app/calculation/__init__.py`：综合测算领域包标识。
- `backend/app/calculation/models.py`：任务、方案、版本、降本行动和轻量小二交接 SQLAlchemy 模型。
- `backend/app/calculation/schemas.py`：字段来源、方案、销售条件、计算结果和 API 请求模型。
- `backend/app/calculation/rules.py`：Decimal 纯函数，完成校验、成本、盈亏、排序和情景计算。
- `backend/app/calculation/seed.py`：固定 `suan-v1` 方案、代表任务和返回交接数据。
- `backend/app/calculation/repository.py`：SQLAlchemy 查询、版本号生成和确认后持久化。
- `backend/app/calculation/llm.py`：LangChain 报价提取和结果解释，无 key 时模板降级。
- `backend/app/calculation/routes.py`：预览、任务、版本、决策、行动、交接和 Agent API。
- `backend/app/main.py`：注册 calculation 模型、路由和 lifespan seed。
- `backend/tests/calculation/test_rules.py`：公式、精度、排序、估算和情景纯函数测试。
- `backend/tests/calculation/test_seed.py`：固定数据与幂等 seed 测试。
- `backend/tests/calculation/test_routes.py`：预览、任务、版本、决策、行动和交接 API 测试。
- `backend/tests/calculation/test_llm.py`：无模型降级、字段提取边界和正式数字保护测试。
- `backend/tests/conftest.py`：注册 calculation models 到 SQLite metadata。

### Frontend

- `web/src/features/suan/types.ts`：方案、计算结果、任务、版本、行动和 Agent 类型。
- `web/src/features/suan/api.ts`：所有 `/api/calculations` 和 `/api/agent/suan` 请求封装。
- `web/src/features/suan/SuanPage.tsx`：五 Tab 壳、当前任务/版本状态和对话侧栏。
- `web/src/features/suan/SchemeEntryTab.tsx`：混合输入、字段核对和确认测算。
- `web/src/features/suan/CostComparisonTab.tsx`：统一成本卡、构成图、明细与意向确认。
- `web/src/features/suan/ProfitSimulationTab.tsx`：销售条件、毛利指标和临时情景。
- `web/src/features/suan/CostOptimizerTab.tsx`：有依据的降本机会、影响预览和交接确认。
- `web/src/features/suan/CalculationTasksTab.tsx`：任务筛选、版本轨迹、待办和恢复入口。
- `web/src/features/suan/components/SourceBadge.tsx`：字段来源与确认状态徽章。
- `web/src/features/suan/components/SuanChat.tsx`：跨 Tab 对话侧栏，只生成解释、草稿和确认卡。
- `web/src/pages/agents/AgentServicePage.tsx`：对 `agent.id === "suan"` 渲染 `SuanPage`。
- `web/src/data/agents.ts`：更新算小二五个 Tab 名称。
- `docs/粮达网Plus产品设计文档-V2.md`：同步算小二确认后的 Tab 与职责摘要。

---

### Task 1: 建立测算领域模型与固定演示数据

**Files:**
- Create: `backend/app/calculation/__init__.py`
- Create: `backend/app/calculation/models.py`
- Create: `backend/app/calculation/seed.py`
- Create: `backend/tests/calculation/__init__.py`
- Create: `backend/tests/calculation/test_seed.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces: `CalculationTask`、`CalculationScheme`、`CalculationVersion`、`CostAction`、`AgentHandoff`。
- Produces: `seed_calculation_demo_data(db: Session) -> None`。
- Consumes: `app.database.Base`、现有 `Base.metadata.create_all()` 和 lifespan seed 模式。

- [ ] **Step 1: 写模型注册与 seed 幂等性失败测试**

```python
# backend/tests/calculation/test_seed.py
from app.calculation.models import CalculationScheme, CalculationTask
from app.calculation.seed import DATASET_VERSION, seed_calculation_demo_data


def test_seed_is_idempotent(db_session):
    seed_calculation_demo_data(db_session)
    first = (
        db_session.query(CalculationTask).count(),
        db_session.query(CalculationScheme).count(),
    )
    seed_calculation_demo_data(db_session)
    assert (
        db_session.query(CalculationTask).count(),
        db_session.query(CalculationScheme).count(),
    ) == first


def test_seed_has_three_comparable_corn_schemes(db_session):
    seed_calculation_demo_data(db_session)
    task = db_session.query(CalculationTask).filter_by(task_code="SUAN-V1-CORN-200").one()
    schemes = db_session.query(CalculationScheme).filter_by(task_id=task.id).all()
    assert len(schemes) == 3
    assert {s.source_kind for s in schemes} == {"manual", "handoff"}
    assert all(s.dataset_version == DATASET_VERSION for s in schemes)
```

- [ ] **Step 2: 运行测试确认模块尚不存在**

Run: `cd backend && uv run pytest tests/calculation/test_seed.py -v`  
Expected: FAIL，包含 `ModuleNotFoundError: No module named 'app.calculation'`。

- [ ] **Step 3: 创建四个最小 SQLAlchemy 模型**

```python
# backend/app/calculation/models.py
class CalculationTask(Base):
    __tablename__ = "calculation_tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(128))
    variety_name: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    current_version_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    selected_scheme_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_agent: Mapped[str | None] = mapped_column(String(32), nullable=True)
    next_action: Mapped[str] = mapped_column(String(256), default="补充并确认测算条件")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class CalculationScheme(Base):
    __tablename__ = "calculation_schemes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("calculation_tasks.id"), index=True)
    scheme_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    scheme_name: Mapped[str] = mapped_column(String(128))
    source_kind: Mapped[str] = mapped_column(String(24))  # manual / pasted / handoff
    source_agent: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    dataset_version: Mapped[str] = mapped_column(String(32), default="suan-v1")


class CalculationVersion(Base):
    __tablename__ = "calculation_versions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("calculation_tasks.id"), index=True)
    version_no: Mapped[int] = mapped_column(Integer)
    base_version_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str] = mapped_column(String(128))
    input_snapshot_json: Mapped[str] = mapped_column(Text)
    result_snapshot_json: Mapped[str] = mapped_column(Text)
    estimated_fields_json: Mapped[str] = mapped_column(Text, default="[]")
    missing_fields_json: Mapped[str] = mapped_column(Text, default="[]")
    rule_version: Mapped[str] = mapped_column(String(32), default="suan-rules-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CostAction(Base):
    __tablename__ = "cost_actions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("calculation_tasks.id"), index=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("calculation_versions.id"), index=True)
    action_type: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(128))
    payload_json: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="draft")
    target_agent: Mapped[str | None] = mapped_column(String(32), nullable=True)
    handoff_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AgentHandoff(Base):
    __tablename__ = "agent_handoffs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("calculation_tasks.id"), index=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("calculation_versions.id"), index=True)
    source_agent: Mapped[str] = mapped_column(String(32), default="suan")
    target_agent: Mapped[str] = mapped_column(String(32))
    goal: Mapped[str] = mapped_column(String(256))
    payload_json: Mapped[str] = mapped_column(Text)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

为 `(task_id, version_no)` 增加唯一约束；不增加软删除、审计表或 ORM relationship。

- [ ] **Step 4: 写入固定 `suan-v1` 数据**

`seed.py` 使用固定 `task_code` 和 `scheme_code` 幂等写入：

| scheme_code | 名称 | 货价 | 运费 | 装卸 | 损耗 | 质量折价 | 来源 |
|---|---|---:|---:|---:|---:|---:|---|
| `SUAN-V1-A` | 哈尔滨粮源 A | 2385 | 285 | 18 | 0.8% | 3400 元 | manual |
| `SUAN-V1-B` | 锦州港粮源 B | 2430 | 205 | 18 | 0.6% | 2400 元 | handoff/yun |
| `SUAN-V1-C` | 长春粮源 C | 2405 | 250 | 22 | 1.0% | 5200 元 | handoff/liang |

每个方案数量为 200 吨；方案 C 的资金周期和方案 B 的质量折价将在 Task 2 的输入快照中标记为 `estimated`。本任务只写任务与三个方案身份，避免在确定性引擎完成前硬编码一份可能漂移的计算结果。

```python
DATASET_VERSION = "suan-v1"
RULE_VERSION = "suan-rules-v1"

def seed_calculation_demo_data(db: Session) -> None:
    task = db.scalar(select(CalculationTask).where(CalculationTask.task_code == "SUAN-V1-CORN-200"))
    if task is not None:
        return
    task = CalculationTask(
        task_code="SUAN-V1-CORN-200", title="200 吨东北玉米采购测算",
        variety_name="玉米", status="draft", next_action="确认三个方案的统一成本口径",
    )
    db.add(task)
    db.flush()
    db.add_all([
        CalculationScheme(task_id=task.id, scheme_code="SUAN-V1-A", scheme_name="哈尔滨粮源 A", source_kind="manual", dataset_version=DATASET_VERSION),
        CalculationScheme(task_id=task.id, scheme_code="SUAN-V1-B", scheme_name="锦州港粮源 B", source_kind="handoff", source_agent="yun", dataset_version=DATASET_VERSION),
        CalculationScheme(task_id=task.id, scheme_code="SUAN-V1-C", scheme_name="长春粮源 C", source_kind="handoff", source_agent="liang", dataset_version=DATASET_VERSION),
    ])
    db.commit()
```

- [ ] **Step 5: 注册测试 metadata、应用模型和 lifespan seed**

在 `backend/tests/conftest.py` 增加 `import app.calculation.models`；在 `backend/app/main.py` 导入 calculation models、router 和 `seed_calculation_demo_data`，建表后调用 seed，并 `app.include_router(calculation_router)`。

- [ ] **Step 6: 运行 seed 测试与现有回归**

Run: `cd backend && uv run pytest tests/calculation/test_seed.py -v`  
Expected: PASS。  
Run: `cd backend && uv run pytest -q`  
Expected: 现有测试全部 PASS。不要提交。

---

### Task 2: 实现 Decimal 确定性成本与盈亏引擎

**Files:**
- Create: `backend/app/calculation/schemas.py`
- Create: `backend/app/calculation/rules.py`
- Create: `backend/tests/calculation/test_rules.py`

**Interfaces:**
- Produces: `SchemeInput`、`SalesInput`、`CalculationResult`、`ComparisonResult`。
- Produces: `calculate_scheme(scheme: SchemeInput, sales: SalesInput | None = None) -> CalculationResult`。
- Produces: `compare_schemes(schemes: list[SchemeInput], sales: SalesInput | None = None) -> ComparisonResult`。
- Produces: `preview_scenario(scheme: SchemeInput, changes: dict[str, Decimal], sales: SalesInput | None) -> CalculationResult`。
- Consumes: Task 1 中快照字段命名，不访问数据库或模型。

- [ ] **Step 1: 写公式、精度和损耗不重复计入的失败测试**

```python
# backend/tests/calculation/test_rules.py
from decimal import Decimal
from app.calculation.rules import calculate_scheme
from app.calculation.schemas import SalesInput, SchemeInput


def base_scheme(**changes):
    data = dict(
        scheme_code="A",
        scheme_name="方案 A",
        variety_name="玉米",
        quantity_tons=Decimal("100"),
        purchase_unit_price=Decimal("2000"),
        tax_included=True,
        transport_unit_price=Decimal("100"),
        handling_unit_price=Decimal("20"),
        loss_rate=Decimal("0.02"),
        quality_discount_total=Decimal("1000"),
        capital_base=Decimal("0"),
        annual_capital_rate=Decimal("0"),
        capital_days=0,
        other_cost_total=Decimal("1000"),
        field_sources={},
    )
    data.update(changes)
    return SchemeInput(**data)


def test_calculate_arrival_cost_uses_usable_quantity_once():
    result = calculate_scheme(base_scheme())
    assert result.purchase_business_total == Decimal("214000.00")
    assert result.usable_quantity == Decimal("98.00")
    assert result.arrival_unit_cost == Decimal("2183.67")
    assert result.loss_impact_unit == Decimal("43.67")


def test_calculate_profit_and_break_even():
    sales = SalesInput(sale_unit_price=Decimal("2300"), saleable_quantity=Decimal("98"), sales_unit_cost=Decimal("10"), receivable_days=0)
    result = calculate_scheme(base_scheme(), sales)
    assert result.total_gross_profit == Decimal("10420.00")
    assert result.unit_gross_profit == Decimal("106.33")
    assert result.break_even_sale_price == Decimal("2193.67")
```

- [ ] **Step 2: 运行测试确认类型与函数尚不存在**

Run: `cd backend && uv run pytest tests/calculation/test_rules.py -v`  
Expected: FAIL，包含 `ImportError` 或 `ModuleNotFoundError`。

- [ ] **Step 3: 定义 Pydantic 输入与输出类型**

```python
FieldSource = Literal["confirmed", "user_input", "handoff", "estimated", "missing", "inference"]

class SchemeInput(BaseModel):
    scheme_code: str
    scheme_name: str
    variety_name: str
    quantity_tons: Decimal = Field(gt=0)
    purchase_unit_price: Decimal = Field(gt=0)
    purchase_price_unit: Literal["元/吨"] = "元/吨"
    quantity_unit: Literal["吨"] = "吨"
    tax_included: bool | None
    transport_unit_price: Decimal = Field(ge=0)
    handling_unit_price: Decimal = Field(ge=0)
    loss_rate: Decimal = Field(ge=0, lt=1)
    quality_discount_total: Decimal = Field(ge=0)
    capital_base: Decimal = Field(ge=0)
    annual_capital_rate: Decimal = Field(ge=0, le=1)
    capital_days: int = Field(ge=0)
    other_cost_total: Decimal = Field(ge=0)
    field_sources: dict[str, FieldSource]

class SalesInput(BaseModel):
    sale_unit_price: Decimal = Field(gt=0)
    saleable_quantity: Decimal = Field(gt=0)
    sales_unit_cost: Decimal = Field(ge=0)
    receivable_days: int = Field(ge=0)

class CalculationResult(BaseModel):
    scheme_code: str
    purchase_total: Decimal
    transport_total: Decimal
    handling_total: Decimal
    quality_discount_total: Decimal
    capital_cost_total: Decimal
    receivable_capital_cost_total: Decimal
    other_cost_total: Decimal
    purchase_business_total: Decimal
    usable_quantity: Decimal
    arrival_unit_cost: Decimal
    loss_impact_unit: Decimal
    sales_revenue: Decimal | None
    total_gross_profit: Decimal | None
    unit_gross_profit: Decimal | None
    gross_margin_rate: Decimal | None
    break_even_sale_price: Decimal | None
    estimated_fields: list[str]
    missing_fields: list[str]
```

`ComparisonResult` 包含 `results`、`recommended_scheme_code | None`、`difference_reasons`、`recommendation_boundary` 和 `comparable`。

- [ ] **Step 4: 实现透明 Decimal 公式**

```python
MONEY = Decimal("0.01")
QUANTITY = Decimal("0.01")

def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)

def calculate_scheme(scheme: SchemeInput, sales: SalesInput | None = None) -> CalculationResult:
    purchase_total = scheme.purchase_unit_price * scheme.quantity_tons
    transport_total = scheme.transport_unit_price * scheme.quantity_tons
    handling_total = scheme.handling_unit_price * scheme.quantity_tons
    capital_cost = scheme.capital_base * scheme.annual_capital_rate * Decimal(scheme.capital_days) / Decimal("365")
    total = purchase_total + transport_total + handling_total + scheme.quality_discount_total + capital_cost + scheme.other_cost_total
    usable = scheme.quantity_tons * (Decimal("1") - scheme.loss_rate)
    arrival = total / usable
    zero_loss_unit = total / scheme.quantity_tons
    sales_revenue = total_profit = unit_profit = margin_rate = break_even = None
    receivable_cost = Decimal("0")
    if sales is not None:
        if sales.saleable_quantity > usable:
            raise ValueError("可销售数量不能超过预计可用数量")
        receivable_cost = scheme.capital_base * scheme.annual_capital_rate * Decimal(sales.receivable_days) / Decimal("365")
        sales_revenue = sales.sale_unit_price * sales.saleable_quantity
        sales_cost = sales.sales_unit_cost * sales.saleable_quantity
        total_profit = sales_revenue - total - receivable_cost - sales_cost
        unit_profit = total_profit / sales.saleable_quantity
        margin_rate = total_profit / sales_revenue
        break_even = (total + receivable_cost + sales_cost) / sales.saleable_quantity
    return CalculationResult(
        scheme_code=scheme.scheme_code, purchase_total=money(purchase_total),
        transport_total=money(transport_total), handling_total=money(handling_total),
        quality_discount_total=money(scheme.quality_discount_total),
        capital_cost_total=money(capital_cost), receivable_capital_cost_total=money(receivable_cost),
        other_cost_total=money(scheme.other_cost_total), purchase_business_total=money(total),
        usable_quantity=usable.quantize(QUANTITY), arrival_unit_cost=money(arrival),
        loss_impact_unit=money(arrival - zero_loss_unit),
        sales_revenue=money(sales_revenue) if sales_revenue is not None else None,
        total_gross_profit=money(total_profit) if total_profit is not None else None,
        unit_gross_profit=money(unit_profit) if unit_profit is not None else None,
        gross_margin_rate=margin_rate.quantize(Decimal("0.0001")) if margin_rate is not None else None,
        break_even_sale_price=money(break_even) if break_even is not None else None,
        estimated_fields=[k for k, v in scheme.field_sources.items() if v == "estimated"],
        missing_fields=[k for k, v in scheme.field_sources.items() if v == "missing"],
    )
```

如果 `sales.saleable_quantity > usable_quantity`，抛出 `ValueError("可销售数量不能超过预计可用数量")`。所有金额在输出边界统一量化，内部中间值不提前取整。

- [ ] **Step 5: 写资金成本、排序与情景不改原对象测试**

```python
def test_capital_cost_uses_365_day_basis():
    result = calculate_scheme(base_scheme(capital_base=Decimal("200000"), annual_capital_rate=Decimal("0.06"), capital_days=30))
    assert result.capital_cost_total == Decimal("986.30")

def test_compare_recommends_lowest_comparable_arrival_cost():
    result = compare_schemes([base_scheme(), base_scheme(scheme_code="B", scheme_name="方案 B", transport_unit_price=Decimal("80"))])
    assert result.comparable is True
    assert result.recommended_scheme_code == "B"

def test_preview_scenario_does_not_mutate_base():
    original = base_scheme()
    preview = preview_scenario(original, {"transport_unit_price": Decimal("80")}, None)
    assert preview.arrival_unit_cost < calculate_scheme(original).arrival_unit_cost
    assert original.transport_unit_price == Decimal("100")
```

- [ ] **Step 6: 实现校验、排序、差异原因和情景复制**

`compare_schemes` 先检查 `tax_included is not None`、单位已统一和至少两个方案；关键口径缺失时返回 `comparable=False`、不设置推荐。成本相差小于 1% 且推荐方案含更多估算项时，`recommendation_boundary` 明确写“成本接近，需先核验估算项”。

- [ ] **Step 7: 用同一计算引擎补齐 seed 的 V1 快照**

在 `seed.py` 增加 `demo_scheme_inputs() -> list[SchemeInput]`，逐条返回 Task 1 表格对应的完整输入：A/B/C 数量均为 200，其他费用为 0；A/B 的资金基数为 0；C 的 `capital_base=481000`、`annual_capital_rate=0.06`、`capital_days=30`。B 的 `quality_discount_total` 与 C 的 `capital_days` 来源为 `estimated`，其余字段为 `confirmed` 或 `handoff`。调用 `compare_schemes(demo_scheme_inputs())` 生成 `CalculationVersion`，不硬编码结果：

```python
inputs = demo_scheme_inputs()
comparison = compare_schemes(inputs)
version = CalculationVersion(
    task_id=task.id, version_no=1, reason="首次确认测算",
    input_snapshot_json=json.dumps({"schemes": [s.model_dump(mode="json") for s in inputs], "sales": None}, ensure_ascii=False),
    result_snapshot_json=json.dumps(comparison.model_dump(mode="json"), ensure_ascii=False),
    estimated_fields_json='["SUAN-V1-B.quality_discount_total", "SUAN-V1-C.capital_days"]',
    missing_fields_json="[]", rule_version=RULE_VERSION,
)
db.add(version)
db.flush()
task.current_version_id = version.id
task.status = "calculated"
```

扩展 `test_seed.py`：重新运行 `calculate_scheme`，断言 V1 快照中每个 `arrival_unit_cost` 与规则结果一致。

- [ ] **Step 8: 运行纯函数测试与全量回归**

Run: `cd backend && uv run pytest tests/calculation/test_rules.py -v`  
Expected: PASS。  
Run: `cd backend && uv run pytest -q`  
Expected: 全部 PASS。不要提交。

---

### Task 3: 实现方案校验、报价提取与无模型降级

**Files:**
- Create: `backend/app/calculation/llm.py`
- Create: `backend/tests/calculation/test_llm.py`
- Modify: `backend/app/calculation/schemas.py`
- Modify: `backend/app/calculation/rules.py`

**Interfaces:**
- Produces: `validate_scheme(scheme: SchemeInput) -> ValidationResult`。
- Produces: `parse_quote(text: str) -> QuoteExtraction`。
- Produces: `explain_comparison(result: ComparisonResult) -> AgentExplanation`。
- Consumes: Task 2 的 `SchemeInput`、`ComparisonResult`；不得访问数据库。

- [ ] **Step 1: 写关键缺项与无 API key 降级测试**

```python
def test_validate_scheme_blocks_unknown_tax_basis():
    result = validate_scheme(base_scheme(tax_included=None))
    assert result.can_calculate is False
    assert "tax_included" in result.missing_fields

def test_parse_quote_without_key_keeps_unknown_fields_missing(monkeypatch):
    monkeypatch.setattr("app.calculation.llm.QWEN_API_KEY", "")
    result = parse_quote("锦州港玉米，含税价2430元/吨，200吨，运费205元/吨")
    assert result.extracted["purchase_unit_price"] == "2430"
    assert result.extracted["quantity_tons"] == "200"
    assert "loss_rate" in result.missing_fields
    assert result.source == "template"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/calculation/test_llm.py -v`  
Expected: FAIL，缺少 `validate_scheme`、`parse_quote` 或 `llm.py`。

- [ ] **Step 3: 定义结构化校验与提取响应**

```python
class ValidationIssue(BaseModel):
    field: str
    kind: Literal["missing", "conflict", "estimate"]
    message: str
    impact: Literal["blocking", "high", "medium", "low"]

class ValidationResult(BaseModel):
    can_calculate: bool
    issues: list[ValidationIssue]
    missing_fields: list[str]
    estimated_fields: list[str]

class QuoteExtraction(BaseModel):
    extracted: dict[str, str | bool]
    field_sources: dict[str, FieldSource]
    source_spans: dict[str, str]
    confidence: dict[str, Decimal]
    missing_fields: list[str]
    confirmation_summary: str
    source: Literal["qwen", "template"]
```

- [ ] **Step 4: 实现确定性校验**

阻断项固定为：税价口径未知、数量/货价缺失或非正数、单位无法换算。`parse_quote` 将“元/公斤”乘 1000 转成“元/吨”、将“公斤”除以 1000 转成“吨”，并在 `source_spans` 保留原单位；其他单位进入 conflict。高影响待确认项固定为：运费是否含装卸、水分/质量折价规则、损耗率、资金周期。用户将字段标记为 `estimated` 后允许计算，但保留 issue。

- [ ] **Step 5: 实现模板解析与 LangChain 提取**

模板解析仅识别带明确单位的价格、吨位、运费和“含税/不含税”词，不猜测损耗或资金条件。Qwen 使用 Pydantic structured output，系统提示词要求：未出现的字段不输出、每个字段返回原文片段、不得计算成本。

```python
SYSTEM_PROMPT = (
    "你是算小二的报价字段提取器。只提取原文明确出现的业务字段，"
    "不得补造缺失数据，不得计算成本或利润；每个字段必须附原文片段。"
)

def parse_quote(text: str) -> QuoteExtraction:
    template = _template_parse(text)
    if not qwen_available():
        return template
    try:
        return _parse_with_qwen(text)
    except Exception:
        logger.exception("算小二报价提取失败，回退模板")
        return template
```

- [ ] **Step 6: 实现规则解释降级**

`explain_comparison` 使用 `recommended_scheme_code`、`difference_reasons` 和 `recommendation_boundary` 生成 100–180 字模板；Qwen 只能改写这些结构化结论，返回内容不得包含未出现在输入 JSON 中的新金额。

```python
class AgentExplanation(BaseModel):
    message: str
    evidence_refs: list[str]
    amount_refs: list[str]
    source: Literal["qwen", "rule"]
```

- [ ] **Step 7: 运行测试**

Run: `cd backend && uv run pytest tests/calculation/test_llm.py tests/calculation/test_rules.py -v`  
Expected: PASS，无需真实 API key。不要提交。

---

### Task 4: 实现任务、版本、预览与决策 API

**Files:**
- Create: `backend/app/calculation/repository.py`
- Create: `backend/app/calculation/routes.py`
- Create: `backend/tests/calculation/test_routes.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces: `/api/calculations/quotes/parse`、`/schemes/validate`、`/preview`、`/scenarios/preview`。
- Produces: `/api/calculations/tasks`、`/tasks/{id}`、`/tasks/{id}/versions`、`/versions/{id}`、`/versions/{id}/comparison`、`/tasks/{id}/decision`、`/tasks/{id}/close`。
- Consumes: Tasks 1–3 的模型、schemas、rules 和 llm。

- [ ] **Step 1: 写预览不写库与创建版本失败测试**

```python
SCHEMES = [{
    "scheme_code": "A", "scheme_name": "方案 A", "variety_name": "玉米",
    "quantity_tons": "100", "purchase_unit_price": "2000", "tax_included": True,
    "transport_unit_price": "100", "handling_unit_price": "20", "loss_rate": "0.02",
    "quality_discount_total": "1000", "capital_base": "0", "annual_capital_rate": "0",
    "capital_days": 0, "other_cost_total": "1000", "field_sources": {}
}, {
    "scheme_code": "B", "scheme_name": "方案 B", "variety_name": "玉米",
    "quantity_tons": "100", "purchase_unit_price": "2020", "tax_included": True,
    "transport_unit_price": "70", "handling_unit_price": "20", "loss_rate": "0.01",
    "quality_discount_total": "500", "capital_base": "0", "annual_capital_rate": "0",
    "capital_days": 0, "other_cost_total": "1000", "field_sources": {}
}]

def test_preview_never_writes_task(client, db_session):
    response = client.post("/api/calculations/preview", json={"schemes": SCHEMES})
    assert response.status_code == 200
    assert db_session.query(CalculationTask).count() == 0

def test_create_task_saves_v1_snapshot(client):
    response = client.post("/api/calculations/tasks", json={"title": "玉米比价", "variety_name": "玉米", "schemes": SCHEMES, "reason": "首次确认测算", "user_confirmed": True})
    assert response.status_code == 200
    task = response.json()
    assert task["status"] == "calculated"
    assert task["current_version"]["version_no"] == 1
```

- [ ] **Step 2: 运行测试确认路由不存在**

Run: `cd backend && uv run pytest tests/calculation/test_routes.py -v`  
Expected: FAIL，预览接口返回 404。

- [ ] **Step 3: 实现 repository 的小函数边界**

```python
def list_tasks(db: Session, status: str | None = None) -> list[CalculationTask]:
    stmt = select(CalculationTask).order_by(CalculationTask.updated_at.desc(), CalculationTask.id.desc())
    if status is not None:
        stmt = stmt.where(CalculationTask.status == status)
    return list(db.scalars(stmt).all())

def get_task(db: Session, task_id: int) -> CalculationTask | None:
    return db.get(CalculationTask, task_id)

def list_versions(db: Session, task_id: int) -> list[CalculationVersion]:
    stmt = select(CalculationVersion).where(CalculationVersion.task_id == task_id).order_by(CalculationVersion.version_no.desc())
    return list(db.scalars(stmt).all())

def next_version_no(db: Session, task_id: int) -> int:
    current = db.scalar(select(func.max(CalculationVersion.version_no)).where(CalculationVersion.task_id == task_id))
    return (current or 0) + 1

def create_version(db: Session, task: CalculationTask, payload: VersionCreate, result: ComparisonResult) -> CalculationVersion:
    version = CalculationVersion(
        task_id=task.id, version_no=next_version_no(db, task.id),
        base_version_id=payload.base_version_id, reason=payload.reason,
        input_snapshot_json=json.dumps(payload.model_dump(mode="json"), ensure_ascii=False),
        result_snapshot_json=json.dumps(result.model_dump(mode="json"), ensure_ascii=False),
        estimated_fields_json=json.dumps(sorted({f for r in result.results for f in r.estimated_fields}), ensure_ascii=False),
        missing_fields_json=json.dumps(sorted({f for r in result.results for f in r.missing_fields}), ensure_ascii=False),
    )
    db.add(version)
    db.flush()
    task.current_version_id = version.id
    task.status = "calculated"
    db.flush()
    return version
```

序列化 JSON 时 Decimal 统一转字符串；读取时交给 Pydantic 还原。repository 不调用 LLM，不包含业务公式。

- [ ] **Step 4: 实现预览和只读 API**

`POST /preview` 运行校验与 `compare_schemes`，返回比较结果、估算项和规则解释；`POST /scenarios/preview` 复制指定方案并替换白名单变量；两者都不 commit。GET 列表按 `updated_at desc`，详情包含当前版本、方案身份和下一步待办。

- [ ] **Step 5: 实现用户确认后的版本写入**

创建任务时写任务、方案身份和 V1；修改条件/保存情景时写新版本并更新 `current_version_id`。请求必须包含 `user_confirmed: true`，否则返回 422。

```python
class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    variety_name: str = Field(min_length=1, max_length=32)
    schemes: list[SchemeInput] = Field(min_length=2)
    sales: SalesInput | None = None
    reason: str = Field(min_length=1, max_length=128)
    user_confirmed: bool

class VersionCreate(BaseModel):
    base_version_id: int | None = None
    schemes: list[SchemeInput] = Field(min_length=2)
    sales: SalesInput | None = None
    reason: str = Field(min_length=1, max_length=128)
    user_confirmed: bool
```

- [ ] **Step 6: 实现意向选择、关闭和 404/422 边界**

选择意向方案必须属于当前任务；成功后状态改为 `decision_formed`。关闭后状态改为 `closed`，但版本仍可读。未知任务/方案返回 404，不兼容口径返回 422 且 `detail` 指向具体字段。

- [ ] **Step 7: 增加版本不覆盖回归测试**

```python
def test_new_version_keeps_v1(client):
    task = _create_task(client)
    response = client.post(f"/api/calculations/tasks/{task['id']}/versions", json={
        "base_version_id": task["current_version"]["id"], "schemes": SCHEMES,
        "reason": "运费变化", "user_confirmed": True,
    })
    assert response.json()["version_no"] == 2
    versions = client.get(f"/api/calculations/tasks/{task['id']}/versions").json()
    assert [v["version_no"] for v in versions] == [2, 1]
```

- [ ] **Step 8: 运行 API 和全量测试**

Run: `cd backend && uv run pytest tests/calculation/test_routes.py -v`  
Expected: PASS。  
Run: `cd backend && uv run pytest -q`  
Expected: 全部 PASS。不要提交。

---

### Task 5: 实现降本行动、跨小二交接与算小二 Agent API

**Files:**
- Modify: `backend/app/calculation/schemas.py`
- Modify: `backend/app/calculation/repository.py`
- Modify: `backend/app/calculation/routes.py`
- Modify: `backend/app/calculation/llm.py`
- Modify: `backend/tests/calculation/test_routes.py`
- Modify: `backend/tests/calculation/test_llm.py`

**Interfaces:**
- Produces: `build_cost_actions(comparison, scenarios) -> list[CostActionDraft]`。
- Produces: `/api/calculations/versions/{id}/actions`、`/api/calculations/actions`、`/api/calculations/handoffs`。
- Produces: `/api/agent/suan/chat`。
- Consumes: 当前任务/版本、Task 2 的确定性情景和 Task 3 的解释层。

- [ ] **Step 1: 写建议必须有依据与交接必须确认的失败测试**

```python
def test_actions_have_evidence_and_preview_delta(client):
    task = _create_task(client)
    actions = client.get(f"/api/calculations/versions/{task['current_version']['id']}/actions").json()
    assert actions
    assert all(a["evidence_refs"] and a["verification_method"] for a in actions)
    assert all(a["impact_low"] is not None and a["impact_high"] is not None for a in actions)

def test_handoff_requires_confirmation(client):
    task = _create_task(client)
    response = client.post("/api/calculations/handoffs", json={
        "task_id": task["id"], "version_id": task["current_version"]["id"],
        "target_agent": "yun", "goal": "核实路线报价", "payload": {},
        "user_confirmed": False,
    })
    assert response.status_code == 422
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/calculation/test_routes.py -k 'actions or handoff' -v`  
Expected: FAIL，接口 404。

- [ ] **Step 3: 定义并实现建议准入规则**

```python
class CostActionDraft(BaseModel):
    action_type: Literal["transport", "quality", "capital", "sourcing"]
    title: str
    impact_low: Decimal
    impact_high: Decimal
    confidence: Literal["high", "medium", "range"]
    evidence_refs: list[str]
    prerequisites: list[str]
    verification_method: str
    target_agent: Literal["yun", "liang", "qian"] | None
    scenario_changes: dict[str, Decimal]
```

`build_cost_actions` 仅从以下差值生成建议：候选方案已存在的更低运输费、已测算的质量折价区间、付款/回款周期情景、采购价目标差。没有 `evidence_refs` 或无法运行 scenario 的建议直接丢弃。

- [ ] **Step 4: 实现行动保存与轻量交接**

保存行动写 `CostAction(status="saved")`。交接写入 Task 1 的 `AgentHandoff(status="pending")`，并把 ID 回填到 `CostAction.handoff_id`；不新增通用工作流引擎。为演示任务 seed 一条 `returned` 交接：目标 `yun`，原运费 205 元/吨，返回运费 187 元/吨、时效 7 天、`data_kind=simulated`。用户点击采用返回结果时，仍通过 Task 4 的版本接口创建 V2。

- [ ] **Step 5: 实现只读/草稿 Agent chat**

```python
class SuanChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    active_tab: Literal["entry", "comparison", "profit", "optimizer", "tasks"]
    task_id: int | None = None
    version_id: int | None = None
    selected_scheme_code: str | None = None

class SuanChatResponse(BaseModel):
    message: str
    evidence_refs: list[str]
    missing_fields: list[str]
    scenario_request: dict[str, str] | None
    suggested_actions: list[CostActionDraft]
    confirmation_card: dict | None
    source: Literal["qwen", "rule"]
```

Chat 只读取上下文、调用报价解析/计算/解释或生成确认卡。它不得调用 `db.commit()`；测试通过请求前后任务、版本和行动数量相等验证。

- [ ] **Step 6: 写 Agent 不写库与不编造数字测试**

```python
def test_agent_chat_never_writes_business_state(client, db_session):
    before = db_session.query(CalculationVersion).count()
    response = client.post("/api/agent/suan/chat", json={"message": "为什么推荐B？", "active_tab": "comparison"})
    assert response.status_code == 200
    assert db_session.query(CalculationVersion).count() == before

def test_rule_fallback_numbers_come_from_evidence(monkeypatch):
    monkeypatch.setattr("app.calculation.llm.QWEN_API_KEY", "")
    comparison = compare_schemes(demo_scheme_inputs())
    explanation = explain_comparison(comparison)
    assert explanation.source == "rule"
    payload = comparison.model_dump_json()
    assert all(amount in payload for amount in explanation.amount_refs)
```

- [ ] **Step 7: 运行后端完整回归**

Run: `cd backend && uv run pytest tests/calculation -v`  
Expected: PASS。  
Run: `cd backend && uv run pytest -q`  
Expected: 全部 PASS。不要提交。

---

### Task 6: 建立算小二前端类型、API、五 Tab 页面壳与来源徽章

**Files:**
- Create: `web/src/features/suan/types.ts`
- Create: `web/src/features/suan/api.ts`
- Create: `web/src/features/suan/SuanPage.tsx`
- Create: `web/src/features/suan/components/SourceBadge.tsx`
- Modify: `web/src/pages/agents/AgentServicePage.tsx`
- Modify: `web/src/data/agents.ts`

**Interfaces:**
- Consumes: Tasks 4–5 的 `/api/calculations` JSON。
- Produces: `SuanPage`、`SUAN_TABS`、`SourceBadge` 和共享 `currentTask/currentVersion` 状态。
- Produces: `parseQuote`、`previewCalculation`、`createCalculationTask`、`previewScenario`、`fetchTasks`、`fetchActions`、`sendSuanMessage`。

- [ ] **Step 1: 更新算小二 Tab 文案并接入独立页面**

```ts
// web/src/data/agents.ts
tabs: ["方案测算", "成本对比", "盈亏推演", "降本助手", "测算任务"],
```

```tsx
// web/src/pages/agents/AgentServicePage.tsx
import SuanPage from "../../features/suan/SuanPage";

if (agent.id === "zhan") return <ZhanPage />;
if (agent.id === "suan") return <SuanPage />;
```

- [ ] **Step 2: 定义与后端完全一致的 TypeScript 类型**

```ts
export type FieldSource = "confirmed" | "user_input" | "handoff" | "estimated" | "missing" | "inference";
export type TaskStatus = "draft" | "pending_confirmation" | "calculated" | "decision_formed" | "closed";

export interface SchemeInput {
  scheme_code: string; scheme_name: string; variety_name: string;
  quantity_tons: string; purchase_unit_price: string; purchase_price_unit: "元/吨"; quantity_unit: "吨"; tax_included: boolean | null;
  transport_unit_price: string; handling_unit_price: string; loss_rate: string;
  quality_discount_total: string; capital_base: string; annual_capital_rate: string;
  capital_days: number; other_cost_total: string; field_sources: Record<string, FieldSource>;
}
export interface SalesInput { sale_unit_price: string; saleable_quantity: string; sales_unit_cost: string; receivable_days: number; }
export interface CalculationResult { scheme_code: string; purchase_total: string; transport_total: string; handling_total: string; quality_discount_total: string; capital_cost_total: string; receivable_capital_cost_total: string; other_cost_total: string; purchase_business_total: string; usable_quantity: string; arrival_unit_cost: string; loss_impact_unit: string; sales_revenue: string | null; total_gross_profit: string | null; unit_gross_profit: string | null; gross_margin_rate: string | null; break_even_sale_price: string | null; estimated_fields: string[]; missing_fields: string[]; }
export interface ComparisonResult { results: CalculationResult[]; recommended_scheme_code: string | null; difference_reasons: string[]; recommendation_boundary: string; comparable: boolean; }
export interface CalculationVersion { id: number; version_no: number; reason: string; inputs: { schemes: SchemeInput[]; sales?: SalesInput | null }; result: ComparisonResult; estimated_fields: string[]; missing_fields: string[]; created_at: string; }
export interface CalculationTask { id: number; task_code: string; title: string; variety_name: string; status: TaskStatus; selected_scheme_id: number | null; selected_scheme_code: string | null; next_action: string; current_version: CalculationVersion | null; created_at: string; updated_at: string; }
```

同时定义 `QuoteExtraction`、`ValidationResult`、`CostAction`、`SuanChatResponse`，字段名严格复制后端 schema。

- [ ] **Step 3: 实现统一请求与 API 封装**

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

所有 Decimal 继续使用字符串传输，浏览器只在显示时 `Number()`，提交时保持字符串，避免前端浮点重新计算正式结果。

- [ ] **Step 4: 实现来源徽章**

```tsx
const META: Record<FieldSource, { label: string; tone: string }> = {
  confirmed: { label: "已确认", tone: "text-emerald-300 bg-emerald-400/10" },
  user_input: { label: "用户输入", tone: "text-sky-300 bg-sky-400/10" },
  handoff: { label: "小二方案", tone: "text-cyan-300 bg-cyan-400/10" },
  estimated: { label: "估算", tone: "text-amber-300 bg-amber-400/10" },
  missing: { label: "待补充", tone: "text-red-300 bg-red-400/10" },
  inference: { label: "规则推断", tone: "text-violet-300 bg-violet-400/10" },
};
```

- [ ] **Step 5: 创建 `SuanPage` 五 Tab 壳和共享状态**

```tsx
export const SUAN_TABS = ["方案测算", "成本对比", "盈亏推演", "降本助手", "测算任务"] as const;

export default function SuanPage() {
  const [activeTab, setActiveTab] = useState<(typeof SUAN_TABS)[number]>("方案测算");
  const [currentTask, setCurrentTask] = useState<CalculationTask | null>(null);
  const [currentVersion, setCurrentVersion] = useState<CalculationVersion | null>(null);
  const [draftSchemes, setDraftSchemes] = useState<SchemeInput[]>([]);
  const [chatOpen, setChatOpen] = useState(true);
  // 头部沿用 ZhanPage 最大宽度与 AgentSwitcher；正文右侧预留 320px 对话侧栏。
}
```

页面壳统一提供加载、请求失败、数据未初始化和重试状态；后端返回的 `detail` 原样显示为中文业务提示。任一 Tab 失败不能清空 `currentTask` 或其他 Tab 已加载数据。

- [ ] **Step 6: 运行 TypeScript 构建检查**

Run: `cd web && npm run build`  
Expected: PASS，`/agent/suan` 不再进入通用占位页，五个 Tab 可切换。不要提交。

---

### Task 7: 实现“方案测算”和“成本对比”核心闭环

**Files:**
- Create: `web/src/features/suan/SchemeEntryTab.tsx`
- Create: `web/src/features/suan/CostComparisonTab.tsx`
- Modify: `web/src/features/suan/SuanPage.tsx`

**Interfaces:**
- Consumes: `parseQuote`、`validateScheme`、`previewCalculation`、`createCalculationTask`、`selectDecision`。
- Produces: `onTaskCreated(task)`、`onDraftChanged(schemes)` 和 `onGoToComparison()`。

- [ ] **Step 1: 实现三种方案入口与报价解析**

左栏固定展示“粘贴报价文本、手工录入、接收小二方案”。粘贴后调用 `parseQuote`，将结果追加为草稿方案，不自动保存；原文片段放在字段详情里，不直接占据主表。

```tsx
const handleParse = async () => {
  setParsing(true);
  try {
    const result = await parseQuote(quoteText);
    setDraftSchemes((current) => [...current, extractionToScheme(result, current.length + 1)]);
    setExtraction(result);
  } finally {
    setParsing(false);
  }
};
```

- [ ] **Step 2: 实现结构化字段核对表**

按“基础业务、采购与质量、物流与损耗、资金与其他”分组；每个输入旁显示 `SourceBadge`。阻断字段缺失使用红色边框，高影响估算使用琥珀色；允许用户把估算改为已确认，但必须发生显式输入或确认点击。

- [ ] **Step 3: 实现三步流程与确认卡**

顶部步骤固定为“导入方案 → 核对口径 → 确认并测算”。至少两个方案且所有阻断项清除后才能打开确认卡。确认卡列出方案数量、口径、估算项和与旧版本的差异；用户确认后才调用创建任务/新版本 API。

- [ ] **Step 4: 实现成本对比摘要卡与构成图**

方案卡展示到厂吨成本、业务总成本、估算数量和与主推差值。成本构成图使用 CSS flex 百分比条，不新增 ECharts 实例；明细行展示货价、物流、装卸、质量、资金、其他和损耗影响。

- [ ] **Step 5: 实现 AI 决策解释与结论边界**

右栏只展示后端返回的推荐、差异原因和 `recommendation_boundary`。`comparable=false` 时显示“暂不推荐”和补充入口，不渲染主推徽章。提供“只看已确认项”的展示筛选，但不在前端重新计算排序。

- [ ] **Step 6: 实现意向方案确认**

点击“选为意向”先展示方案、到厂吨成本、估算项和影响说明；确认后调用 `/decision` 并刷新任务。成功后开放“进入盈亏推演”，取消不调用 API。

- [ ] **Step 7: 运行构建和手动闭环**

Run: `cd web && npm run build`  
Expected: PASS。  
Manual: `/agent/suan` → 粘贴两份报价 → 查看 AI 提取和缺项 → 补充/确认估算 → 创建 V1 → 成本对比解释“最低货价不等于最低综合成本” → 选择意向。不要提交。

---

### Task 8: 实现“盈亏推演”和“降本助手”

**Files:**
- Create: `web/src/features/suan/ProfitSimulationTab.tsx`
- Create: `web/src/features/suan/CostOptimizerTab.tsx`
- Modify: `web/src/features/suan/SuanPage.tsx`

**Interfaces:**
- Consumes: 当前版本、`previewScenario`、`saveVersion`、`fetchActions`、`saveAction`、`createHandoff`。
- Produces: 临时 `scenarioPreview`，确认后才更新 `currentVersion`。

- [ ] **Step 1: 实现销售条件与四个核心指标**

销售条件包含销售价、可销售数量、销售费用和回款周期。指标固定为预计吨毛利、预计总毛利、毛利率、盈亏平衡销售价；所有数字来自后端 preview，不在 React 中重算。

- [ ] **Step 2: 实现白名单情景控件**

支持采购价、运费、损耗率、质量折价、销售价、付款/回款周期。输入变更 300ms 防抖后调用 preview；结果区同时显示基准值、情景值和差值，并固定展示“临时情景，尚未保存”。

```tsx
const saveScenario = async () => {
  if (!currentTask || !scenarioPreview || !confirmed) return;
  const version = await saveVersion(currentTask.id, {
    base_version_id: currentVersion.id,
    schemes: scenarioPreview.inputs.schemes,
    sales: scenarioPreview.inputs.sales,
    reason: scenarioName,
    user_confirmed: true,
  });
  onVersionSaved(version);
};
```

- [ ] **Step 3: 实现 AI 情景问句入口**

快捷问句“销售价下跌30元”“保住50元吨毛利”“回款延迟15天”只生成结构化变量变更并调用 preview。无法识别的问句提示用户选择变量，不由模型直接回答数字。

- [ ] **Step 4: 实现降本机会排序和证据展示**

每张卡必须展示影响区间、可信度、依据引用、前置条件、验证方式和目标小二。没有依据或影响区间的数据不渲染为正式建议；“通用建议”可放在说明区但不能带节省数字。

- [ ] **Step 5: 实现影响预览、保存行动和交接确认**

“预览替换结果”调用 scenario preview；“加入行动清单”打开保存确认；“邀请运/粮/钱小二”展示目标、携带字段和任务范围，确认后调用 handoff。页面写“待核实/已发起”，不得写“已节省/已锁定/已成交”。

- [ ] **Step 6: 运行构建和手动路径**

Run: `cd web && npm run build`  
Expected: PASS。  
Manual: 输入销售条件 → 查看毛利与盈亏点 → 下调销售价 30 元 → 确认原版本未变化 → 查看运输降本机会 → 预览影响 → 确认发起运小二交接。不要提交。

---

### Task 9: 实现“测算任务”、跨 Tab 对话与最终回归

**Files:**
- Create: `web/src/features/suan/CalculationTasksTab.tsx`
- Create: `web/src/features/suan/components/SuanChat.tsx`
- Modify: `web/src/features/suan/SuanPage.tsx`
- Modify: `backend/tests/calculation/test_routes.py`
- Modify: `docs/粮达网Plus产品设计文档-V2.md`

**Interfaces:**
- Consumes: 任务列表/详情/版本 API、`sendSuanMessage`、当前 Tab/任务/版本/选中方案。
- Produces: 可恢复任务、可查看版本轨迹、可收起跨 Tab 对话侧栏。

- [ ] **Step 1: 实现任务筛选、摘要和下一步**

筛选固定为“全部、进行中、已完成”；进行中包含 `draft/pending_confirmation/calculated/decision_formed`，已完成为 `closed`。任务卡展示当前版本、意向方案、估算/缺失项数量和 `next_action`。

- [ ] **Step 2: 实现任务详情和版本轨迹**

版本按 `version_no desc` 展示创建原因、输入变化、成本/毛利摘要和用户选择。点击旧版本只切换只读查看；“复制为新测算”将旧输入带回方案测算草稿，不直接创建任务。

- [ ] **Step 3: 实现返回行动的版本确认**

seed 的路线行动显示“运小二已返回 187 元/吨参考费用”。用户点击后先看到 `205 → 187` 的变更卡；确认后调用版本 API 生成 V2，V1 仍可查看。

- [ ] **Step 4: 实现 `SuanChat` 上下文与跨 Tab 保留**

```ts
interface SuanChatContext {
  active_tab: "entry" | "comparison" | "profit" | "optimizer" | "tasks";
  task_id: number | null;
  version_id: number | null;
  selected_scheme_code: string | null;
}
```

对话状态保存在 `SuanPage`。桌面端右侧 320px，可收起为“问算小二”；窄屏改为底部抽屉。报价提取回复提供“应用到草稿”，情景回复提供“预览此情景”，写操作回复只渲染确认卡，不直接调用写 API。

- [ ] **Step 5: 补充关键只读边界回归测试**

```python
def test_scenario_preview_keeps_current_version(client):
    task = _create_task(client)
    before = client.get(f"/api/calculations/tasks/{task['id']}").json()
    client.post("/api/calculations/scenarios/preview", json={
        "scheme": SCHEMES[0], "changes": {"transport_unit_price": "80"}
    })
    after = client.get(f"/api/calculations/tasks/{task['id']}").json()
    assert after["current_version"]["id"] == before["current_version"]["id"]

def test_returned_handoff_requires_confirmed_new_version(client):
    task = _create_task(client)
    before_count = len(client.get(f"/api/calculations/tasks/{task['id']}/versions").json())
    client.get(f"/api/calculations/versions/{task['current_version']['id']}/actions")
    after_count = len(client.get(f"/api/calculations/tasks/{task['id']}/versions").json())
    assert after_count == before_count
```

- [ ] **Step 6: 同步总产品文档**

将总产品文档第 8.6 节更新为五个确认 Tab，并用一段话说明“采购比价为主、贸易毛利为辅；AI 负责提取与解释，确定性引擎负责数字”。不复制专项规格全文。

- [ ] **Step 7: 执行异常与降级回归**

补充或运行以下断言：报价文本无法识别时返回空提取结果和手工录入提示；税价/单位冲突返回 422 且不创建版本；可销售数量超过预计可用数量返回明确错误且不保存；Qwen 抛异常时解析与解释回退规则版；没有可比方案时 `recommended_scheme_code=null`；读取行动或交接失败不删除当前任务和版本。前端逐一检查加载失败、数据为空、重试和 Agent 不可用状态，确认结构化测算仍可继续。

- [ ] **Step 8: 运行最终自动回归**

Run: `cd backend && uv run pytest -q`  
Expected: 全部 PASS。  
Run: `cd web && npm run build`  
Expected: PASS。  
Run: `git diff --check`  
Expected: 无输出。

- [ ] **Step 9: 执行代表场景验收**

使用“200 吨东北二等玉米，两个粮源报价 + 一个运小二方案”：

1. 粘贴报价后正确提取货价、吨位和运费，水分扣价与付款周期保持待确认。
2. 用户确认估算后生成 V1，成本对比能解释最低货价为何不是最低到厂成本。
3. 输入销售价后展示吨毛利、总毛利与盈亏平衡点。
4. 销售价下调 30 元只产生临时情景，不覆盖 V1。
5. 降本助手只展示有证据和影响区间的建议。
6. 邀请运小二前必须确认结构化交接。
7. 运小二返回 187 元/吨参考费用后，用户确认才生成 V2。
8. 任务页可同时查看 V2 和 V1，并生成决策摘要。

- [ ] **Step 10: 人工审查检查点**

检查 `git status --short` 只包含本计划范围内文件；确认页面没有“会计净利润、实时成交、已锁定运力、自动节省、自动下单”等越界文案；确认主界面不醒目标注 Mock，但详情如实展示 `suan-v1` 演示来源；不执行 Git 提交，由用户自行决定版本控制操作。

---

## Task Dependency Order

```text
Task 1 模型与 seed
  └─ Task 2 确定性计算
       └─ Task 3 校验与 LLM
            └─ Task 4 任务/版本 API
                 └─ Task 5 行动/交接/Agent API
                      └─ Task 6 前端壳与类型
                           └─ Task 7 方案测算 + 成本对比
                                └─ Task 8 盈亏推演 + 降本助手
                                     └─ Task 9 任务 + 对话 + 总回归
```

每个 Task 完成后运行其指定测试并停在人工审查点。不得因为后续 Task 依赖而跳过当前测试；不得提前实现未到达的页面或接口。
