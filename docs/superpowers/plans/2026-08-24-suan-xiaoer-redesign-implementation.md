# 算小二三 Tab 重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现“成本测算、盈亏推演、测算记录”三个 Tab，让算小二能够接收散乱报价和其他小二结果，形成可解释的综合成本决策、轻量盈亏推演与企业经验沉淀。

**Architecture:** 新增独立 `costing` 后端模块，LangChain 只负责文本提取与结果解释，所有成本和盈亏数字由 Decimal 确定性规则计算。前端沿用现有小二页模式，在同一个成本测算 Tab 内完成输入、确认、计算和对比；记录使用 JSON 快照保存，避免为竞赛首版建设复杂版本模型。企业经验由独立 `knowledge` 模块持久化，并在配置 Mem0 时同步写入共享记忆，未配置时不影响主流程。

**Tech Stack:** Python 3.12、FastAPI、SQLAlchemy 2、Pydantic 2、MySQL/SQLite tests、LangChain、mem0、React 18、TypeScript 5、Tailwind CSS 4、Vite 6

**Spec:** `docs/superpowers/specs/2026-08-24-suan-xiaoer-redesign.md`

## Global Constraints

- 始终使用简体中文文案，代码注释和技术名词可保留英文。
- 后端使用 FastAPI，本地 Docker MySQL；测试继续使用 SQLite `StaticPool`。
- LangChain 不得生成正式成本、利润、排序或节省金额；正式数字只来自 Decimal 规则函数。
- 每个关键字段保留来源与状态，不显示虚假的匹配率或风险概率。
- 其他小二只提供本专业候选，算小二只负责跨专业统一总账，不重复建设粮源、物流或资金市场。
- 只实现单笔业务，不实现会计净利润、税务、现金流、多批次库存和复杂版本树。
- AI 不可用时，手工录入、确定性计算、记录查询和知识库查询仍可用。
- 不自动读取微信、邮箱、Excel、PDF 或图片。
- 禁止自动提交 Git；每个任务以测试通过和 `git diff --check` 作为检查点，不执行 `git commit`。
- 保留工作区中用户已有的删除和修改，不恢复 `2026-08-23` 旧版算小二规格与计划。

## File Structure

### 后端新增

- `backend/app/costing/__init__.py`：算小二模块入口。
- `backend/app/costing/schemas.py`：方案、字段来源、成本结果、盈亏结果和 API 请求结构。
- `backend/app/costing/rules.py`：Decimal 成本、排序、差异与盈亏纯函数。
- `backend/app/costing/models.py`：测算记录 JSON 快照模型。
- `backend/app/costing/repository.py`：记录创建、列表、详情和复制。
- `backend/app/costing/llm.py`：报价提取、结果解释和经验摘要，包含无模型降级。
- `backend/app/costing/routes.py`：`/api/costing` API。
- `backend/app/knowledge/__init__.py`：企业经验模块入口。
- `backend/app/knowledge/models.py`：共享经验模型。
- `backend/app/knowledge/repository.py`：经验查询、编辑和忽略。
- `backend/app/knowledge/memory.py`：Mem0 可选同步与搜索适配器。
- `backend/app/knowledge/routes.py`：`/api/knowledge/experiences` API。
- `backend/tests/costing/test_rules.py`：成本和盈亏规则测试。
- `backend/tests/costing/test_routes.py`：测算 API 和记录状态测试。
- `backend/tests/costing/test_llm.py`：AI 提取、解释和降级测试。
- `backend/tests/knowledge/test_experiences.py`：经验沉淀、编辑和忽略测试。

### 后端修改

- `backend/app/main.py`：注册 costing/knowledge 模型与路由。
- `backend/tests/conftest.py`：将新模型注册到测试元数据。
- `backend/app/liang/routes.py`：增加粮源方案到算小二的只读交接。
- `backend/app/logistics/routes.py`：增加运输方案到算小二的只读交接。
- `backend/tests/liang/test_routes.py`：增加粮小二交接测试。
- `backend/tests/logistics/test_routes.py`：增加运小二交接测试。
- `backend/pyproject.toml`、`backend/uv.lock`：加入 `mem0ai`。
- `backend/.env.example`：增加可选 `MEM0_CONFIG_JSON`。

### 前端新增

- `web/src/features/suan/types.ts`：与后端一一对应的类型。
- `web/src/features/suan/api.ts`：算小二和经验 API 客户端。
- `web/src/features/suan/SuanPage.tsx`：三 Tab 外壳与当前记录上下文。
- `web/src/features/suan/CostingTab.tsx`：输入、确认、测算、对比和降本动作。
- `web/src/features/suan/ProfitTab.tsx`：单笔盈亏与三个关键情景。
- `web/src/features/suan/RecordsTab.tsx`：记录列表、详情和复制。
- `web/src/features/suan/QuoteInput.tsx`：自然语言输入与 AI 提取入口。
- `web/src/features/suan/SchemeEditor.tsx`：一至三个方案的最小字段确认卡。
- `web/src/features/suan/CostComparison.tsx`：结论、横向成本和差异拆解。
- `web/src/features/suan/HandoffAction.tsx`：携带目标跳转其他小二的确认卡。
- `web/src/features/suan/SuanAssistant.tsx`：跨 Tab 可收起的上下文问答侧栏。
- `web/src/features/suan/format.ts`：金额、吨价和百分比格式化。

### 前端修改

- `web/src/pages/agents/AgentServicePage.tsx`：为 `suan` 路由接入 `SuanPage`。
- `web/src/data/agents.ts`：算小二 Tab 改为三个确认名称。
- `web/src/features/qian/MatchRecordsTab.tsx`：钱小二交接后写入会话并进入算小二。
- `web/src/features/yun/PlansTab.tsx`：主推运输方案增加“交给算小二”入口。
- `web/src/features/liang/SourcingTab.tsx`：主推/备选粮源增加“交给算小二”入口。
- `web/src/pages/Knowledge.tsx`：在“历史业务方案”中展示共享经验并支持编辑、忽略。

---

### Task 1: 建立成本与盈亏确定性领域规则

**Files:**
- Create: `backend/app/costing/__init__.py`
- Create: `backend/app/costing/schemas.py`
- Create: `backend/app/costing/rules.py`
- Create: `backend/tests/costing/__init__.py`
- Create: `backend/tests/costing/test_rules.py`

**Interfaces:**
- Consumes: 无。
- Produces: `SchemeInput`、`CostComparison`、`ProfitScenario`；`calculate_scheme(scheme)`、`compare_schemes(schemes)`、`calculate_profit(scheme, request)`。

- [ ] **Step 1: 写成本规则失败测试**

在 `backend/tests/costing/test_rules.py` 写入明确数字用例：

```python
from decimal import Decimal

import pytest

from app.costing.rules import calculate_scheme, compare_schemes, calculate_profit
from app.costing.schemas import ProfitRequest, SchemeInput


def make_scheme(**changes) -> SchemeInput:
    data = {
        "scheme_id": "A",
        "name": "吉林粮源 A + 铁路方案",
        "variety_name": "玉米",
        "quantity_tons": Decimal("300"),
        "purchase_price_yuan_per_ton": Decimal("2300"),
        "tax_included": True,
        "quality_discount_yuan_per_ton": Decimal("12"),
        "freight_yuan_per_ton": Decimal("160"),
        "loading_yuan_per_ton": Decimal("8"),
        "loss_rate_pct": Decimal("0.5"),
        "financing_cost_yuan": Decimal("6000"),
        "other_cost_yuan": Decimal("0"),
        "constraints_met": True,
        "pending_items": [],
        "field_meta": {},
    }
    data.update(changes)
    return SchemeInput(**data)


def test_calculate_scheme_uses_loss_once():
    result = calculate_scheme(make_scheme())
    assert result.purchase_total_yuan == Decimal("690000.00")
    assert result.total_cost_yuan == Decimal("750000.00")
    assert result.usable_quantity_tons == Decimal("298.5000")
    assert result.delivered_cost_yuan_per_ton == Decimal("2512.56")


def test_compare_schemes_excludes_failed_hard_condition():
    result = compare_schemes([
        make_scheme(),
        make_scheme(scheme_id="B", name="不满足质量条件", constraints_met=False),
    ])
    assert result.recommended_scheme_id == "A"
    assert result.results[1].eligible is False


def test_profit_scenario_returns_margin_and_break_even():
    profit = calculate_profit(
        make_scheme(),
        ProfitRequest(
            selling_price_yuan_per_ton=Decimal("2600"),
            sales_fulfillment_cost_yuan=Decimal("3000"),
        ),
    )
    assert profit.total_profit_yuan == Decimal("23100.00")
    assert profit.profit_yuan_per_ton == Decimal("77.39")
    assert profit.break_even_price_yuan_per_ton == Decimal("2522.61")


def test_comparison_rejects_mixed_tax_basis():
    with pytest.raises(ValueError, match="含税口径"):
        compare_schemes([make_scheme(), make_scheme(scheme_id="B", tax_included=False)])
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/costing/test_rules.py -v`

Expected: FAIL，原因是 `app.costing.rules` 和相关类型尚不存在。

- [ ] **Step 3: 实现最小 Pydantic 类型**

在 `schemas.py` 定义下列稳定接口，Decimal 输出由 Pydantic JSON 序列化为字符串：

```python
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

FieldSource = Literal["user", "liang", "yun", "qian"]
FieldStatus = Literal["confirmed", "pending", "estimated"]


class FieldMeta(BaseModel):
    source: FieldSource = "user"
    status: FieldStatus = "confirmed"
    note: str = ""


class SchemeDraft(BaseModel):
    scheme_id: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=128)
    variety_name: str | None = None
    quantity_tons: Decimal | None = Field(default=None, gt=0)
    purchase_price_yuan_per_ton: Decimal | None = Field(default=None, gt=0)
    tax_included: bool | None = None
    quality_discount_yuan_per_ton: Decimal | None = Field(default=None, ge=0)
    freight_yuan_per_ton: Decimal | None = Field(default=None, ge=0)
    loading_yuan_per_ton: Decimal | None = Field(default=None, ge=0)
    loss_rate_pct: Decimal | None = Field(default=None, ge=0, lt=100)
    financing_cost_yuan: Decimal | None = Field(default=None, ge=0)
    other_cost_yuan: Decimal | None = Field(default=None, ge=0)
    constraints_met: bool = True
    pending_items: list[str] = Field(default_factory=list)
    field_meta: dict[str, FieldMeta] = Field(default_factory=dict)


class SchemeInput(SchemeDraft):
    variety_name: str
    quantity_tons: Decimal = Field(gt=0)
    purchase_price_yuan_per_ton: Decimal = Field(gt=0)
    tax_included: bool
    quality_discount_yuan_per_ton: Decimal = Field(ge=0)
    freight_yuan_per_ton: Decimal = Field(ge=0)
    loading_yuan_per_ton: Decimal = Field(ge=0)
    loss_rate_pct: Decimal = Field(ge=0, lt=100)
    financing_cost_yuan: Decimal = Field(ge=0)
    other_cost_yuan: Decimal = Field(ge=0)


class CostBreakdown(BaseModel):
    purchase_yuan_per_ton: Decimal
    quality_yuan_per_ton: Decimal
    freight_yuan_per_ton: Decimal
    loading_yuan_per_ton: Decimal
    loss_impact_yuan_per_ton: Decimal
    financing_yuan_per_ton: Decimal
    other_yuan_per_ton: Decimal


class SchemeResult(BaseModel):
    scheme_id: str
    name: str
    eligible: bool
    total_cost_yuan: Decimal
    usable_quantity_tons: Decimal
    delivered_cost_yuan_per_ton: Decimal
    purchase_total_yuan: Decimal
    breakdown: CostBreakdown
    pending_items: list[str]


class CostDifference(BaseModel):
    scheme_id: str
    against_scheme_id: str
    delivered_cost_delta_yuan_per_ton: Decimal
    total_cost_delta_yuan: Decimal


class CostComparison(BaseModel):
    recommended_scheme_id: str | None
    results: list[SchemeResult]
    differences: list[CostDifference]
    contains_estimates: bool
    explanation: str = ""


class ProfitRequest(BaseModel):
    selling_price_yuan_per_ton: Decimal = Field(gt=0)
    sales_fulfillment_cost_yuan: Decimal = Field(default=Decimal("0"), ge=0)
    freight_yuan_per_ton: Decimal | None = Field(default=None, ge=0)
    loss_rate_pct: Decimal | None = Field(default=None, ge=0, lt=100)


class ProfitScenario(BaseModel):
    selling_price_yuan_per_ton: Decimal
    total_profit_yuan: Decimal
    profit_yuan_per_ton: Decimal
    margin_pct: Decimal
    break_even_price_yuan_per_ton: Decimal
    safety_space_yuan_per_ton: Decimal


class CalculateRequest(BaseModel):
    schemes: list[SchemeInput] = Field(min_length=1, max_length=3)


class SaveRecordRequest(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    source_text: str = ""
    schemes: list[SchemeDraft] = Field(min_length=1, max_length=3)
    calculation: CostComparison | None = None
    selected_scheme_id: str | None = None


class AskRequest(BaseModel):
    tab: Literal["costing", "profit", "records"]
    question: str = Field(min_length=1, max_length=500)
    record_id: int | None = None


class ProfitQuestionRequest(BaseModel):
    baseline_selling_price_yuan_per_ton: Decimal = Field(gt=0)
    sales_fulfillment_cost_yuan: Decimal = Field(default=Decimal("0"), ge=0)
    question: str = Field(min_length=1, max_length=500)
```

- [ ] **Step 4: 实现 Decimal 纯函数**

在 `rules.py` 使用统一舍入函数：

```python
from decimal import Decimal, ROUND_HALF_UP

from app.costing.schemas import (
    CostBreakdown, CostComparison, CostDifference, ProfitRequest,
    ProfitScenario, SchemeInput, SchemeResult,
)

MONEY = Decimal("0.01")
QTY = Decimal("0.0001")


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def calculate_scheme(scheme: SchemeInput) -> SchemeResult:
    quantity = scheme.quantity_tons
    usable = (quantity * (Decimal("1") - scheme.loss_rate_pct / Decimal("100"))).quantize(QTY)
    purchase = scheme.purchase_price_yuan_per_ton * quantity
    quality = scheme.quality_discount_yuan_per_ton * quantity
    freight = scheme.freight_yuan_per_ton * quantity
    loading = scheme.loading_yuan_per_ton * quantity
    total = purchase + quality + freight + loading + scheme.financing_cost_yuan + scheme.other_cost_yuan
    delivered = total / usable
    zero_loss_ton = total / quantity
    return SchemeResult(
        scheme_id=scheme.scheme_id,
        name=scheme.name,
        eligible=scheme.constraints_met,
        total_cost_yuan=money(total),
        usable_quantity_tons=usable,
        delivered_cost_yuan_per_ton=money(delivered),
        purchase_total_yuan=money(purchase),
        breakdown=CostBreakdown(
            purchase_yuan_per_ton=money(scheme.purchase_price_yuan_per_ton),
            quality_yuan_per_ton=money(scheme.quality_discount_yuan_per_ton),
            freight_yuan_per_ton=money(scheme.freight_yuan_per_ton),
            loading_yuan_per_ton=money(scheme.loading_yuan_per_ton),
            loss_impact_yuan_per_ton=money(delivered - zero_loss_ton),
            financing_yuan_per_ton=money(scheme.financing_cost_yuan / usable),
            other_yuan_per_ton=money(scheme.other_cost_yuan / usable),
        ),
        pending_items=scheme.pending_items,
    )
```

`compare_schemes` 先校验一至三个方案、品种一致和含税口径一致；排除 `constraints_met=False` 后按 `delivered_cost_yuan_per_ton` 排序。`calculate_profit(scheme: SchemeInput, request: ProfitRequest)` 在传入运费或损耗情景时用 `scheme.model_copy(update=...)` 生成临时方案并重新调用 `calculate_scheme`，不修改原对象。

- [ ] **Step 5: 运行规则测试并检查差异**

Run: `cd backend && uv run pytest tests/costing/test_rules.py -v`

Expected: 4 tests PASS。

Run: `git diff --check`

Expected: 无输出。

---

### Task 2: 实现测算预览、记录持久化与记录状态

**Files:**
- Create: `backend/app/costing/models.py`
- Create: `backend/app/costing/repository.py`
- Create: `backend/app/costing/routes.py`
- Create: `backend/tests/costing/test_routes.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/conftest.py`

**Interfaces:**
- Consumes: Task 1 的 `SchemeDraft`、`SchemeInput`、`CostComparison`、`ProfitRequest`。
- Produces: `POST /api/costing/calculate`、`POST /api/costing/records`、`GET /api/costing/records`、`GET /api/costing/records/{id}`、`POST /api/costing/records/{id}/profit-preview`、`POST /api/costing/records/{id}/profit`、`POST /api/costing/records/{id}/clone`。

- [ ] **Step 1: 写 API 失败测试**

在 `test_routes.py` 覆盖：预览不落库、保存后状态为 `calculated`、单方案可算、混合税价返回 422、保存盈亏后状态为 `completed`、复制记录产生新 ID。

```python
SCHEME = {
    "scheme_id": "A", "name": "方案 A", "variety_name": "玉米",
    "quantity_tons": "300", "purchase_price_yuan_per_ton": "2300",
    "tax_included": True, "quality_discount_yuan_per_ton": "12",
    "freight_yuan_per_ton": "160", "loading_yuan_per_ton": "8",
    "loss_rate_pct": "0.5", "financing_cost_yuan": "6000",
    "other_cost_yuan": "0", "constraints_met": True,
    "pending_items": [], "field_meta": {},
}


def test_preview_then_save_and_complete_record(client, monkeypatch):
    monkeypatch.setattr("app.costing.llm.explain_comparison", lambda value: "方案 A 综合成本最低")
    preview = client.post("/api/costing/calculate", json={"schemes": [SCHEME]})
    assert preview.status_code == 200
    assert client.get("/api/costing/records").json()["items"] == []

    saved = client.post("/api/costing/records", json={
        "title": "300 吨玉米到厂成本", "source_text": "微信报价原文",
        "schemes": [SCHEME], "calculation": preview.json(),
        "selected_scheme_id": "A",
    })
    assert saved.status_code == 200
    assert saved.json()["status"] == "completed"

    profit = client.post(f"/api/costing/records/{saved.json()['id']}/profit", json={
        "selling_price_yuan_per_ton": "2600",
        "sales_fulfillment_cost_yuan": "3000",
    })
    assert profit.status_code == 200
    assert profit.json()["profit"]["total_profit_yuan"] == "23100.00"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/costing/test_routes.py -v`

Expected: FAIL，原因是模型、路由和注册不存在。

- [ ] **Step 3: 实现单表 JSON 快照模型**

`CostingRecord` 字段固定为：`id`、`record_code`、`title`、`status`、`source_text`、`schemes_snapshot`、`calculation_snapshot`、`selected_scheme_id`、`profit_snapshot`、`ai_explanation`、`created_at`、`updated_at`。`status` 只允许 `pending/calculated/completed`，不增加子任务表或版本表。

```python
class CostingRecord(Base):
    __tablename__ = "costing_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    record_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(16), index=True)
    source_text: Mapped[str] = mapped_column(Text, default="")
    schemes_snapshot: Mapped[list] = mapped_column(JSON)
    calculation_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    selected_scheme_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    profit_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ai_explanation: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
```

- [ ] **Step 4: 实现 repository 和路由**

`POST /calculate` 调用 `compare_schemes` 并将 `llm.explain_comparison` 返回值写入响应的 `explanation`，不写库。`POST /records` 根据快照自动派生状态：无计算结果为 `pending`，有计算但无意向为 `calculated`，有 `selected_scheme_id` 或盈亏为 `completed`。

所有 ValueError 转为 422 中文错误。`profit-preview` 只计算不写库；`profit` 保存 `profit_snapshot` 并将状态改为 `completed`；`clone` 复制输入快照但清空计算、意向和盈亏，状态为 `pending`。

- [ ] **Step 5: 注册模块并运行测试**

在 `main.py` 导入 `costing_models` 并 `include_router(costing_router)`；在 `tests/conftest.py` 导入 `app.costing.models`。

Run: `cd backend && uv run pytest tests/costing/test_routes.py tests/costing/test_rules.py -v`

Expected: 全部 PASS。

Run: `git diff --check`

Expected: 无输出。

---

### Task 3: 实现报价提取和受约束的 AI 解释

**Files:**
- Create: `backend/app/costing/llm.py`
- Create: `backend/tests/costing/test_llm.py`
- Modify: `backend/app/costing/routes.py`

**Interfaces:**
- Consumes: `SchemeDraft`、`CostComparison`。
- Produces: `extract_schemes(text: str) -> dict`、`explain_comparison(comparison: CostComparison) -> str`、`answer_with_context(tab, question, record) -> str`、`extract_profit_change(question) -> dict`、`POST /api/costing/extract`、`POST /api/costing/ask`、`POST /api/costing/records/{id}/profit-question`。

- [ ] **Step 1: 写提取与防编造失败测试**

```python
from app.costing import llm
from app.costing.rules import compare_schemes
from tests.costing.test_rules import make_scheme


def test_fallback_extracts_two_quotes_and_asks_tax_basis(monkeypatch):
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    result = llm.extract_schemes(
        "方案A：玉米300吨，2300元/吨，运费160元/吨；"
        "方案B：玉米300吨，2320元/吨，运费130元/吨"
    )
    assert result["llm_available"] is False
    assert len(result["schemes"]) == 2
    assert "含税" in "".join(result["questions"])
    assert result["schemes"][0]["loss_rate_pct"] is None


def test_explanation_fallback_only_uses_calculated_numbers(monkeypatch):
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    comparison = compare_schemes([make_scheme()])
    text = llm.explain_comparison(comparison)
    assert comparison.recommended_scheme_id in text
    assert "预计节省" not in text


def test_profit_question_fallback_extracts_price_drop(monkeypatch):
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    assert llm.extract_profit_change("售价跌30元还能不能做？") == {
        "selling_price_delta_yuan_per_ton": "-30"
    }
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/costing/test_llm.py -v`

Expected: FAIL，原因是接口尚未实现。

- [ ] **Step 3: 实现规则降级提取和固定补问顺序**

规则提取至少识别方案分隔、品种、吨数、元/吨、运费、装卸、损耗和含税关键词。未出现的字段保持 `None`，不得填默认正式值。补问顺序固定为含税口径、运费是否含装卸、质量扣价、损耗率、资金成本。

```python
QUESTION_FIELDS = [
    ("tax_included", "这些报价是否都是含税价？"),
    ("loading_yuan_per_ton", "运费是否已经包含装卸费用？"),
    ("quality_discount_yuan_per_ton", "是否有水分、杂质或容重扣价？"),
    ("loss_rate_pct", "本次预计运输损耗率是多少？"),
    ("financing_cost_yuan", "是否需要计入本次资金占用成本？"),
]


def high_impact_questions(schemes: list[dict]) -> list[str]:
    questions = []
    for field, question in QUESTION_FIELDS:
        if any(item.get(field) is None for item in schemes):
            questions.append(question)
        if len(questions) == 2:
            break
    return questions
```

- [ ] **Step 4: 实现 LangChain 结构化提取和解释回退**

复用钱小二的 `_config()` 和 `ChatOpenAI.with_structured_output` 模式。系统提示词必须包含：只提取原文明确字段、缺失保持空值、不得生成成本数字、每次最多返回三个方案。解释提示词只传入 `CostComparison.model_dump(mode="json")`，要求引用方案 ID 和已计算字段，不允许重新计算。

`answer_with_context` 只接收当前 Tab、记录快照和用户问题；无模型时按 Tab 返回结构化模板。`extract_profit_change` 只提取销售价、运费或损耗率的绝对值/增减值，不执行计算。规则降级至少识别“售价跌 30 元”“运费涨 15 元”“损耗增加 0.3%”。

- [ ] **Step 5: 接入 API 并运行测试**

`POST /api/costing/extract` 接收 `{ "text": str }`，空字符串返回 422“请粘贴报价或描述测算方案”。`POST /api/costing/ask` 接收 `{ "tab": str, "question": str, "record_id": int | null }`。`profit-question` 接收基准销售价、销售履约费和一句话问题，先提取变量，再调用 `calculate_profit`，响应同时返回 `changes` 与正式 `result`。

Run: `cd backend && uv run pytest tests/costing/test_llm.py tests/costing/test_routes.py -v`

Expected: 全部 PASS，关闭 Qwen 时仍有可用响应。

---

### Task 4: 实现企业经验持久化与 Mem0 可选同步

**Files:**
- Create: `backend/app/knowledge/__init__.py`
- Create: `backend/app/knowledge/models.py`
- Create: `backend/app/knowledge/repository.py`
- Create: `backend/app/knowledge/memory.py`
- Create: `backend/app/knowledge/routes.py`
- Create: `backend/tests/knowledge/__init__.py`
- Create: `backend/tests/knowledge/test_experiences.py`
- Modify: `backend/app/costing/llm.py`
- Modify: `backend/app/costing/routes.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/pyproject.toml`
- Modify: `backend/uv.lock`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: 已完成 `CostingRecord` 和 `llm.summarize_experience(record)`。
- Produces: `SharedExperience`；`POST /api/knowledge/experiences/{id}/ignore`、`PATCH /api/knowledge/experiences/{id}`、`GET /api/knowledge/experiences`；`search_memories(query, limit=5)`。

- [ ] **Step 1: 写经验生命周期失败测试**

测试保存盈亏后自动出现一条带 `source_record_id` 的经验、编辑只改内容、忽略后默认列表不再返回、Mem0 未配置时接口照常可用。

```python
def test_completed_costing_creates_editable_experience(client, saved_costing_record, monkeypatch):
    monkeypatch.setattr("app.knowledge.memory.sync_experience", lambda item: None)
    response = client.post(
        f"/api/costing/records/{saved_costing_record['id']}/profit",
        json={"selling_price_yuan_per_ton": "2600", "sales_fulfillment_cost_yuan": "3000"},
    )
    assert response.status_code == 200
    items = client.get("/api/knowledge/experiences").json()["items"]
    assert len(items) == 1
    assert items[0]["source_record_id"] == saved_costing_record["id"]

    edited = client.patch(
        f"/api/knowledge/experiences/{items[0]['id']}",
        json={"content": "华南到货需同时比较物流与水分折价。"},
    )
    assert edited.json()["content"].startswith("华南到货")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/knowledge/test_experiences.py -v`

Expected: FAIL，原因是 knowledge 模块不存在。

- [ ] **Step 3: 实现经验模型和 CRUD**

`SharedExperience` 只包含 `id`、`source_record_id`、`content`、`tags` JSON、`status`、`created_at`、`updated_at`。`status` 只允许 `active/ignored`。以 `source_record_id` 唯一约束避免重复完成同一记录时生成多条经验。

- [ ] **Step 4: 加入 Mem0 可选适配器**

Run: `cd backend && uv add mem0ai`

在 `.env.example` 增加：

```dotenv
# 可选：Mem0 JSON 配置；留空时企业经验仍保存在 MySQL，并使用数据库查询降级
MEM0_CONFIG_JSON=
```

`memory.py` 只在变量非空时初始化，任何初始化、写入或搜索异常都记录日志并回退数据库：

```python
def _client():
    raw = os.getenv("MEM0_CONFIG_JSON", "").strip()
    if not raw:
        return None
    from mem0 import Memory
    return Memory.from_config(json.loads(raw))


def sync_experience(item) -> None:
    client = _client()
    if client is None:
        return
    client.add(
        [{"role": "assistant", "content": item.content}],
        user_id="liangda-enterprise",
        metadata={"experience_id": item.id, "source_record_id": item.source_record_id},
    )
```

- [ ] **Step 5: 在完成盈亏时自动沉淀并运行测试**

`summarize_experience` 有模型时生成一句不超过 80 字的经验；无模型时从推荐方案最大两项成本差异生成规则版句子。只引用已确认计算结果，不能写成普遍事实。任何记录首次进入 `completed` 状态时创建经验，包括保存意向方案和保存盈亏推演；`source_record_id` 唯一约束负责去重。

Run: `cd backend && uv run pytest tests/knowledge/test_experiences.py tests/costing -v`

Expected: 全部 PASS。

---

### Task 5: 打通粮、运、钱小二到算小二的结构化交接

**Files:**
- Modify: `backend/app/liang/routes.py`
- Modify: `backend/app/logistics/routes.py`
- Modify: `backend/tests/liang/test_routes.py`
- Modify: `backend/tests/logistics/test_routes.py`
- Modify: `web/src/features/liang/api.ts`
- Modify: `web/src/features/liang/types.ts`
- Modify: `web/src/features/liang/SourcingTab.tsx`
- Modify: `web/src/features/yun/api.ts`
- Modify: `web/src/features/yun/types.ts`
- Modify: `web/src/features/yun/PlansTab.tsx`
- Modify: `web/src/features/qian/MatchRecordsTab.tsx`

**Interfaces:**
- Consumes: 三个现有小二的已保存主推/备选快照。
- Produces: 统一 `SuanHandoff` 会话结构；`POST /api/liang/tasks/{id}/handoff/suan`、`POST /api/logistics/tasks/{id}/handoff/suan`；已有 `POST /api/finance/matches/{id}/handoff/suan` 保持兼容。

- [ ] **Step 1: 写两个新增交接端点失败测试**

断言无主推时返回 422；有主推时只返回已有字段和 `pending_items`，不创建算小二记录、不修改原任务状态。

```python
def test_sourcing_handoff_to_suan_is_read_only(client, saved_sourcing_task):
    response = client.post(f"/api/liang/tasks/{saved_sourcing_task['id']}/handoff/suan")
    assert response.status_code == 200
    body = response.json()
    assert body["source_agent"] == "liang"
    assert body["target_agent"] == "suan"
    assert body["schemes"][0]["purchase_price_yuan_per_ton"]
    assert client.get(f"/api/liang/tasks/{saved_sourcing_task['id']}").json()["status"] == "completed"
```

- [ ] **Step 2: 实现统一交接响应**

三个响应在前端归一为：

```typescript
export interface SuanHandoff {
  source_agent: "liang" | "yun" | "qian";
  target_agent: "suan";
  source_ref: string;
  schemes: Partial<SchemeDraft>[];
  pending_items: string[];
}
```

粮小二把 `price` 写入货价、`quality_penalty` 写入质量折价；不得把 `delivered_price` 再当成货价，避免重复计算。运小二只写运输方案标题和参考运费中值，保留“报价待询运确认”。钱小二只写资金费用和期限。粮小二交接创建新的方案草稿；运小二和钱小二交接作为成本组成卡进入页面，由用户选择应用到一个或多个已有方案，不擅自形成不完整的正式方案。

- [ ] **Step 3: 实现前端交接确认与跳转**

三个小二均先展示交接确认，再调用 API。成功后执行：

```typescript
sessionStorage.setItem("suan_pending_handoff", JSON.stringify(handoff));
navigate("/agent/suan");
```

按钮文案分别为“交给算小二算总账”“带运输方案算总账”“交给算小二测成本”。不在原小二页面显示“算小二已完成”。

- [ ] **Step 4: 运行后端测试和前端构建**

Run: `cd backend && uv run pytest tests/liang/test_routes.py tests/logistics/test_routes.py tests/finance/test_match_routes.py -v`

Expected: 全部 PASS。

Run: `cd web && npm run build`

Expected: TypeScript 和 Vite build 成功。

---

### Task 6: 建立算小二三 Tab 前端壳、类型和 API 客户端

**Files:**
- Create: `web/src/features/suan/types.ts`
- Create: `web/src/features/suan/api.ts`
- Create: `web/src/features/suan/format.ts`
- Create: `web/src/features/suan/SuanPage.tsx`
- Create: `web/src/features/suan/SuanAssistant.tsx`
- Modify: `web/src/pages/agents/AgentServicePage.tsx`
- Modify: `web/src/data/agents.ts`

**Interfaces:**
- Consumes: Task 2 至 5 的 API 和 `SuanHandoff`。
- Produces: `SuanPage`；`onRecordSaved(record)`、`onOpenProfit(record)`、`onReuse(record)` 三个跨 Tab 回调。

- [ ] **Step 1: 定义与 API JSON 一致的 TypeScript 类型**

金额字段统一使用 `string`，不在浏览器中重新生成正式成本。`types.ts` 至少导出 `FieldMeta`、`SchemeDraft`、`SchemeInput`、`SchemeResult`、`CostComparison`、`ProfitRequest`、`ProfitScenario`、`ProfitQuestionRequest`、`ProfitQuestionResponse`、`AskRequest`、`CostingRecord`、`SuanHandoff`、`SharedExperience`。

- [ ] **Step 2: 实现 API 客户端**

`api.ts` 复用钱小二 `http/post` 错误格式，并导出：

```typescript
export const extractSchemes = (text: string) =>
  post<ExtractResponse>("/api/costing/extract", { text });
export const calculateCosts = (schemes: SchemeInput[]) =>
  post<CostComparison>("/api/costing/calculate", { schemes });
export const saveCostingRecord = (body: SaveRecordRequest) =>
  post<CostingRecord>("/api/costing/records", body);
export const fetchCostingRecords = () =>
  http<{ items: CostingRecord[] }>("/api/costing/records");
export const previewProfit = (id: number, body: ProfitRequest) =>
  post<ProfitScenario>(`/api/costing/records/${id}/profit-preview`, body);
export const saveProfit = (id: number, body: ProfitRequest) =>
  post<CostingRecord>(`/api/costing/records/${id}/profit`, body);
export const askSuan = (body: AskRequest) =>
  post<{ answer: string }>("/api/costing/ask", body);
export const previewProfitQuestion = (id: number, body: ProfitQuestionRequest) =>
  post<ProfitQuestionResponse>(`/api/costing/records/${id}/profit-question`, body);
```

- [ ] **Step 3: 实现三 Tab 页面壳和上下文**

`SuanPage` 使用 `const TABS = ["成本测算", "盈亏推演", "测算记录"] as const`，从 `sessionStorage` 读取一次 `suan_pending_handoff` 后立即删除，避免刷新时重复导入。当前记录仅保存在 `SuanPage` state，不引入全局状态库。

页面内容区右侧渲染可收起 `SuanAssistant`。组件提交当前 Tab、当前记录 ID 和问题，切换 Tab 不清空本次页面会话；切换记录时清空旧问答，避免串用业务上下文。窄屏下侧栏改为底部抽屉，不遮挡主要按钮。

- [ ] **Step 4: 接入路由并构建**

在 `AgentServicePage` 中增加 `if (agent.id === "suan") return <SuanPage />;`；同步 `agents.ts` 的三个 Tab。

Run: `cd web && npm run build`

Expected: TypeScript 无未使用变量，Vite build 成功，访问 `/agent/suan` 不再出现占位页。

---

### Task 7: 实现成本测算连续流程和降本交接

**Files:**
- Create: `web/src/features/suan/QuoteInput.tsx`
- Create: `web/src/features/suan/SchemeEditor.tsx`
- Create: `web/src/features/suan/CostComparison.tsx`
- Create: `web/src/features/suan/HandoffAction.tsx`
- Create: `web/src/features/suan/CostingTab.tsx`
- Modify: `web/src/features/suan/SuanPage.tsx`
- Modify: `web/src/features/liang/LiangPage.tsx`
- Modify: `web/src/features/yun/YunPage.tsx`
- Modify: `web/src/features/qian/QianPage.tsx`

**Interfaces:**
- Consumes: `extractSchemes`、`calculateCosts`、`saveCostingRecord` 和可能存在的 `SuanHandoff`。
- Produces: 保存后的 `CostingRecord`；输出给其他小二的 `{ target_agent, target_value, reason, source_record_id }`。

- [ ] **Step 1: 实现未测算和交接进入状态**

独立进入显示三行自然语言输入和示例“方案A：300吨玉米，含税2300元/吨，运费160元/吨……”。从其他小二进入时，顶部显示来源徽标、已带入字段和缺失字段；必须点击“确认接收”后才合并到编辑区。

- [ ] **Step 2: 实现方案确认卡**

`SchemeEditor` 最多渲染三个方案，每个方案只包含规格中的八组字段。字段旁使用三种状态标签：已确认、待确认、暂按估算；不显示模型置信度。缺少含税、数量或货价时禁用“开始测算”；其他空费用必须由用户明确选择“按 0 估算”后才转成 `estimated`。

- [ ] **Step 3: 实现测算结果与差异拆解**

`CostComparison` 第一屏显示推荐方案、到厂吨成本、相对备选差额和后端 `explanation`。下方使用 CSS 横向条形比例展示五类成本，不引入新图表库；点击成本项展开原值、公式、来源和状态。单方案时显示“当前已完成单方案成本测算，增加方案后可横向比较”。

- [ ] **Step 4: 实现基于规则结果的三类降本动作**

只展示确有对应成本项的动作：运费交运小二、质量折价交粮小二、资金成本交钱小二。确认卡显示目标值、计算依据和将携带字段。跳转时使用 React Router state：

```typescript
navigate(`/agent/${targetAgent}`, {
  state: {
    source_agent: "suan",
    source_record_id: recordId,
    target_value: targetValue,
    reason,
  },
});
```

目标小二当前首版只需从 React Router `location.state` 读取并显示“来自算小二的降本目标”提示条，允许用户按原流程重新办理，不自动创建任务。提示条提供“使用这个目标”和“忽略”；使用后仅预填已有表单能承接的字段，不能承接的目标保留为业务备注。

- [ ] **Step 5: 保存记录并构建**

用户点击“保存测算”才调用 `saveCostingRecord`；预览、修改和 AI 解释均不自动落库。保存后通知 `SuanPage` 设置当前记录，并启用“进入盈亏推演”。

Run: `cd web && npm run build`

Expected: build 成功；手工检查输入、确认、结果、单方案提示和交接确认四种状态。

---

### Task 8: 实现盈亏推演、测算记录和知识库展示

**Files:**
- Create: `web/src/features/suan/ProfitTab.tsx`
- Create: `web/src/features/suan/RecordsTab.tsx`
- Modify: `web/src/features/suan/SuanPage.tsx`
- Modify: `web/src/features/suan/api.ts`
- Modify: `web/src/pages/Knowledge.tsx`

**Interfaces:**
- Consumes: 已保存且存在 `selected_scheme_id` 的 `CostingRecord`、利润与经验 API。
- Produces: 已完成记录、三个临时情景、可编辑和可忽略的共享经验列表。

- [ ] **Step 1: 实现盈亏基础输入和结果**

未选择意向方案时显示明确空状态并提供“返回成本测算选择方案”。有意向方案时只输入预计销售价和销售履约费用。结果展示吨毛利、总毛利、毛利率、盈亏平衡价和安全空间；固定提示“这是单笔业务测算毛利，不等同于企业会计净利润”。

- [ ] **Step 2: 实现三个临时情景**

提供售价下降、运费上涨、损耗增加三个快捷入口，以及一句话问题输入。快捷入口提交结构化变量到 `profit-preview`；一句话问题提交到 `profit-question`，由后端提取变量后调用同一规则函数。所有数字使用后端响应。临时情景用“相对基准 ±X 元/吨”展示，不写库；点击“保存当前推演”才调用 `saveProfit`。

- [ ] **Step 3: 实现记录列表、详情和复制**

列表筛选只使用全部、待补充、已测算、已完成。卡片显示规格要求的摘要；详情使用已有快照，不重新调用 AI。继续待补充记录时回到成本测算；已计算记录条件变化时调用 clone 后回到成本测算，避免覆盖旧记录。

- [ ] **Step 4: 在企业知识库展示共享经验**

`Knowledge.tsx` 的“历史业务方案”Tab 调用 `GET /api/knowledge/experiences`。每条经验显示内容、来源记录、创建时间和“编辑/忽略”；其他知识库 Tab 保持现状，不顺带实现无关功能。接口失败时显示可重试错误，不把经验写死在前端。

- [ ] **Step 5: 构建并完成视觉检查**

Run: `cd web && npm run build`

Expected: build 成功；1280px 桌面宽度下无横向溢出，深色科技风、紫色算小二强调色与现有页面一致。

---

### Task 9: 完成全量回归和代表场景验收

**Files:**
- Modify only if verification finds a defect: files already listed in Tasks 1-8

**Interfaces:**
- Consumes: 全部已实现功能。
- Produces: 可演示的算小二闭环，不增加新功能。

- [ ] **Step 1: 运行后端全量测试**

Run: `cd backend && uv run pytest -v`

Expected: 所有既有测试和新增测试 PASS；不得通过删除或跳过旧测试取得通过。

- [ ] **Step 2: 运行前端生产构建**

Run: `cd web && npm run build`

Expected: TypeScript 严格检查和 Vite build PASS。

- [ ] **Step 3: 执行无 AI 降级验收**

在 `QWEN_API_KEY` 为空、`MEM0_CONFIG_JSON` 为空时验证：报价规则提取可用、手动修改可用、成本和盈亏数字可算、记录可保存、企业经验保存在 MySQL、历史可查询。

- [ ] **Step 4: 执行代表场景**

使用以下输入完成端到端检查：

```text
方案A：吉林玉米300吨，含税2300元/吨，质量折价12元/吨，
运费160元/吨，装卸8元/吨，损耗0.5%，资金成本6000元。
方案B：黑龙江玉米300吨，含税2275元/吨，质量折价28元/吨，
运费178元/吨，装卸8元/吨，损耗0.8%，资金成本4500元。
```

验收顺序：AI 整理两个方案；确认口径；输出统一到厂吨成本；解释低货价方案未必胜出；选择意向；试算售价下降 30 元；保存盈亏；携带目标运费返回运小二；在知识库看到带来源经验。

- [ ] **Step 5: 检查工作区边界**

Run: `git diff --check && git status --short`

Expected: 无空白错误；只出现本计划涉及文件和用户原有变更；不执行 Git 提交。
