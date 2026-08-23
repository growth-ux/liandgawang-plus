# 钱小二 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/agent/qian` 从通用占位页实现为可浏览粮贸金融产品、用自然语言确认资金需求、获得可解释产品推荐并保存匹配记录的钱小二专业服务页。

**Architecture:** 新增独立 `backend/app/finance` 模块，使用 SQLAlchemy/MySQL 保存金融产品和匹配快照，普通 Python + Decimal 完成硬条件筛选、稳定排序与参考资金成本计算，LangChain 只做需求字段提取和确定性结果解释。前端新增 `web/src/features/qian`，三个 Tab 共享当前需求、产品和匹配结果，通过现有 `/agent/:id` 路由接入。

**Tech Stack:** Python 3.12、FastAPI、SQLAlchemy 2、Pydantic 2、MySQL/SQLite tests、LangChain `ChatOpenAI`、React 18、TypeScript 5.6、Tailwind CSS 4、Vite 6。

**Spec:** `docs/superpowers/specs/2026-08-23-qian-xiaoer-design.md`

## Global Constraints

- 始终使用简体中文进行产品文案、注释和交付说明；技术标识保留英文。
- 不自动执行 `git commit`；每个任务结束只运行测试并设置人工审查检查点。
- 沿用 FastAPI、本地 Docker MySQL、React 和 LangChain，不引入状态管理、金融、工作流或图表新框架。
- 默认 Tab 顺序固定为：`金融市场 → 智能匹配 → 我的匹配`。
- 首版只回答“市场上有什么”和“我适合哪个”，不实现贷款申请、材料上传、授信审批、放款进度、现金流管理或贷后管理。
- 所有额度、期限、准入判断、排序和参考资金成本必须由确定性规则完成；模型不得生成或修改正式数字。
- 明确不符合额度、期限、用途、增信方式或必要凭证的产品不得进入主推与备选。
- 匹配结果只展示一个主推、一个至两个备选，并给出代表性排除原因；不展示不透明数字匹配分。
- 产品、费用与准入条件只能来自 MySQL 产品池；AI 不得推荐产品池以外的产品。
- 用户确认需求后才执行匹配；用户点击保存后才写入“我的匹配”。
- 首版不接入 Mem0，不从历史记录推断企业偏好。
- 固定演示产品使用稳妥的机构名称，不冒充真实银行当前在售产品；页面使用“参考成本”“需人工确认”“更新时间”等表达。
- 页面固定提示“参考匹配，不代表授信或放款承诺”。
- 深色科技风沿用现有色板，钱小二使用暖橙色强调；青绿表示符合，琥珀表示待确认，红色只表示明确不符合。
- 只修改钱小二所需文件及必要的模型、路由注册和总产品文档，不重构其他小二。

---

## File Structure

### Backend

- `backend/app/finance/__init__.py`：资金服务领域包标识。
- `backend/app/finance/models.py`：金融产品和匹配快照 SQLAlchemy 模型。
- `backend/app/finance/schemas.py`：产品、需求、候选结果和 API 请求响应模型。
- `backend/app/finance/seed.py`：固定 `qian-v1` 金融产品池，幂等写入 10 款产品。
- `backend/app/finance/rules.py`：Decimal 参考成本、硬条件筛选和稳定排序纯函数。
- `backend/app/finance/repository.py`：产品筛选、详情、匹配记录保存和历史查询。
- `backend/app/finance/llm.py`：LangChain 需求抽取、结果解释和无 Key 规则降级。
- `backend/app/finance/routes.py`：市场、抽取、预览、保存、历史和轻量交接 API。
- `backend/app/main.py`：注册 finance 模型、router 和 lifespan seed。
- `backend/tests/finance/__init__.py`：finance 测试包。
- `backend/tests/finance/test_seed.py`：演示产品完整性与幂等测试。
- `backend/tests/finance/test_rules.py`：硬筛选、排序、成本和无完全匹配测试。
- `backend/tests/finance/test_market_routes.py`：市场概览、筛选和详情 API 测试。
- `backend/tests/finance/test_llm.py`：自然语言降级抽取和 AI 边界测试。
- `backend/tests/finance/test_match_routes.py`：预览、保存、历史、详情和算小二交接测试。
- `backend/tests/conftest.py`：注册 finance models 到 SQLite metadata。

### Frontend

- `web/src/features/qian/types.ts`：产品、筛选、需求、候选、预览和历史记录类型。
- `web/src/features/qian/api.ts`：所有 `/api/finance` 请求封装。
- `web/src/features/qian/QianPage.tsx`：三个 Tab 壳和跨 Tab 状态。
- `web/src/features/qian/FinanceMarketTab.tsx`：市场概览、筛选和产品列表。
- `web/src/features/qian/ProductDrawer.tsx`：产品完整条件、费用口径和匹配入口。
- `web/src/features/qian/SmartMatchTab.tsx`：自然语言输入、需求确认、结果和保存动作。
- `web/src/features/qian/MatchRecordsTab.tsx`：历史匹配、查看与重新匹配。
- `web/src/pages/agents/AgentServicePage.tsx`：对 `agent.id === "qian"` 渲染 `QianPage`。
- `web/src/data/agents.ts`：将钱小二 Tab 更新为三个已确认名称。
- `docs/粮达网Plus产品设计文档-V2.md`：同步钱小二首版定位和三个 Tab。

---

### Task 1: 建立金融产品模型与固定产品池

**Files:**
- Create: `backend/app/finance/__init__.py`
- Create: `backend/app/finance/models.py`
- Create: `backend/app/finance/seed.py`
- Create: `backend/app/finance/routes.py`
- Create: `backend/tests/finance/__init__.py`
- Create: `backend/tests/finance/test_seed.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces: `FinanceProduct`、`FinanceMatchRecord`。
- Produces: `seed_finance_products(db: Session) -> None`。
- Consumes: `app.database.Base`、现有 `Base.metadata.create_all()` 和 lifespan seed 模式。

- [ ] **Step 1: 写产品池数量、类别和幂等性失败测试**

```python
# backend/tests/finance/test_seed.py
from app.finance.models import FinanceProduct
from app.finance.seed import DATASET_VERSION, seed_finance_products


def test_seed_is_idempotent(db_session):
    seed_finance_products(db_session)
    first = db_session.query(FinanceProduct).count()
    seed_finance_products(db_session)
    assert db_session.query(FinanceProduct).count() == first == 10


def test_seed_covers_four_finance_categories(db_session):
    seed_finance_products(db_session)
    rows = db_session.query(FinanceProduct).all()
    assert {row.category for row in rows} == {
        "purchase_working", "order_finance", "warehouse_finance", "receivable_finance"
    }
    assert all(row.dataset_version == DATASET_VERSION for row in rows)
    assert all(row.is_active for row in rows)


def test_seed_has_products_for_demo_requirement(db_session):
    seed_finance_products(db_session)
    rows = db_session.query(FinanceProduct).all()
    assert any(
        row.min_amount_yuan <= 300_000 <= row.max_amount_yuan
        and row.min_days <= 45 <= row.max_days
        and "credit" in row.guarantee_modes
        for row in rows
    )
```

- [ ] **Step 2: 运行测试确认 finance 模块尚不存在**

Run: `cd backend && uv run pytest tests/finance/test_seed.py -v`
Expected: FAIL，包含 `ModuleNotFoundError: No module named 'app.finance'`。

- [ ] **Step 3: 创建两个最小 SQLAlchemy 模型**

```python
# backend/app/finance/models.py
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FinanceProduct(Base):
    __tablename__ = "finance_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(64))
    institution_name: Mapped[str] = mapped_column(String(64))
    category: Mapped[str] = mapped_column(String(32), index=True)
    scenario: Mapped[str] = mapped_column(String(256))
    min_amount_yuan: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    max_amount_yuan: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    min_days: Mapped[int] = mapped_column(Integer)
    max_days: Mapped[int] = mapped_column(Integer)
    annual_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric(7, 3), nullable=True)
    fee_note: Mapped[str] = mapped_column(String(256), default="")
    purposes: Mapped[list] = mapped_column(JSON)
    guarantee_modes: Mapped[list] = mapped_column(JSON)
    required_credentials: Mapped[list] = mapped_column(JSON)
    min_business_years: Mapped[Decimal | None] = mapped_column(Numeric(5, 1), nullable=True)
    requirements: Mapped[list] = mapped_column(JSON)
    data_updated_at: Mapped[str] = mapped_column(String(32))
    dataset_version: Mapped[str] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class FinanceMatchRecord(Base):
    __tablename__ = "finance_match_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    source_type: Mapped[str] = mapped_column(String(16), default="manual")
    source_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    requirement_snapshot: Mapped[dict] = mapped_column(JSON)
    result_snapshot: Mapped[dict] = mapped_column(JSON)
    explanation: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

- [ ] **Step 4: 写入 10 款固定参考产品**

在 `backend/app/finance/seed.py` 使用下表数据。所有金额单位为元，`annual_rate_pct` 表示百分数而不是小数；`required_credentials` 中的项目全部为必要凭证：

| product_code | 产品/机构 | 类别 | 额度 | 期限 | 年化参考 | 增信方式 | 必要凭证 | 最低经营年限 |
|---|---|---|---:|---:|---:|---|---|---:|
| `QIAN-V1-PW-01` | 粮采周转贷 / 谷穗金融服务中心 | purchase_working | 10万–100万 | 15–90天 | 5.2% | credit,guarantee | purchase_contract | 1年 |
| `QIAN-V1-PW-02` | 小额采购快融 / 惠粮产业服务 | purchase_working | 5万–50万 | 7–60天 | 7.2% | credit | purchase_contract | 0.5年 |
| `QIAN-V1-PW-03` | 粮企经营贷 / 启禾普惠服务 | purchase_working | 20万–200万 | 90–365天 | 6.8% | credit,guarantee | business_license,bank_flow | 2年 |
| `QIAN-V1-OF-01` | 订单采购融 / 丰融供应链服务 | order_finance | 20万–300万 | 30–180天 | 5.8% | order,guarantee | purchase_contract,purchase_order | 1年 |
| `QIAN-V1-OF-02` | 采购合同快融 / 衡信产业金融服务 | order_finance | 10万–150万 | 30–120天 | 6.3% | order,credit | purchase_contract | 1年 |
| `QIAN-V1-OF-03` | 联保采购融 / 谷链产业服务 | order_finance | 30万–200万 | 30–180天 | 5.9% | guarantee | purchase_contract | 1.5年 |
| `QIAN-V1-WH-01` | 粮仓快融 / 丰仓供应链服务 | warehouse_finance | 50万–500万 | 30–365天 | 4.9% | warehouse_receipt | warehouse_receipt | 1年 |
| `QIAN-V1-WH-02` | 货权周转融 / 粮链金融服务 | warehouse_finance | 100万–800万 | 60–365天 | 5.1% | controlled_goods | controlled_goods | 2年 |
| `QIAN-V1-AR-01` | 应收速融 / 商穗保理服务 | receivable_finance | 30万–300万 | 30–180天 | 6.1% | receivable | receivable_invoice | 1年 |
| `QIAN-V1-AR-02` | 核心企业应收融 / 联禾商业保理 | receivable_finance | 50万–500万 | 30–270天 | 5.6% | receivable | receivable_invoice,delivery_receipt | 1.5年 |

四类产品统一支持的 `purposes` 分别为：采购周转与订单融资写 `['grain_purchase']`，仓单融资写 `['inventory_turnover']`，应收融资写 `['receivable_turnover']`。`requirements` 写成完整中文短句，例如粮采周转贷为 `['企业持续经营满1年', '具有真实粮食采购合同', '经营与征信情况需人工核验']`。

```python
# backend/app/finance/seed.py
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.finance.models import FinanceProduct

DATASET_VERSION = "qian-v1"
DATA_UPDATED_AT = "2026-08-23"


def seed_finance_products(db: Session) -> None:
    for item in PRODUCTS:
        exists = db.scalar(
            select(FinanceProduct).where(FinanceProduct.product_code == item["product_code"])
        )
        if exists is None:
            db.add(FinanceProduct(**item))
    db.commit()
```

- [ ] **Step 5: 注册模型与应用启动 seed**

在 `backend/tests/conftest.py` 增加 `import app.finance.models  # noqa: F401`。在 `backend/app/main.py`：

```python
from app.finance import models as finance_models  # noqa: F401
from app.finance.routes import router as finance_router
from app.finance.seed import seed_finance_products

# lifespan 的 SessionLocal 块内
seed_finance_products(db)

# 其他 include_router 之后
app.include_router(finance_router)
```

`backend/app/finance/routes.py` 此时先创建 `router = APIRouter(prefix="/api/finance", tags=["finance"])`，以便主应用可以导入；后续任务再增加端点。

- [ ] **Step 6: 运行 seed 测试与审查检查点**

Run: `cd backend && uv run pytest tests/finance/test_seed.py -v`
Expected: PASS，3 tests passed。
Run: `git diff --check`
Expected: 无输出。不要提交。

---

### Task 2: 实现确定性硬筛选、排序和参考资金成本

**Files:**
- Create: `backend/app/finance/schemas.py`
- Create: `backend/app/finance/rules.py`
- Create: `backend/tests/finance/test_rules.py`

**Interfaces:**
- Consumes: `FinanceProduct` 列表。
- Produces: `FinanceRequirement`、`FinanceProductOut`、`MatchCandidate`、`MatchPreview` Pydantic 模型。
- Produces: `calculate_reference_cost(amount_yuan: Decimal, annual_rate_pct: Decimal, duration_days: int) -> Decimal`。
- Produces: `match_products(requirement: FinanceRequirement, products: list[FinanceProduct]) -> MatchPreview`。

- [ ] **Step 1: 写成本、硬过滤、待确认和稳定排序失败测试**

```python
# backend/tests/finance/test_rules.py
from decimal import Decimal
from types import SimpleNamespace

from app.finance.rules import calculate_reference_cost, match_products
from app.finance.schemas import FinanceRequirement


def product(code, rate, *, min_amount=100_000, max_amount=1_000_000,
            min_days=15, max_days=90, guarantees=None, credentials=None,
            min_years=1):
    return SimpleNamespace(
        id=int(code[-1]), product_code=code, name=code, institution_name="测试机构",
        category="purchase_working", scenario="采购周转", min_amount_yuan=Decimal(min_amount),
        max_amount_yuan=Decimal(max_amount), min_days=min_days, max_days=max_days,
        annual_rate_pct=Decimal(rate), fee_note="", purposes=["grain_purchase"],
        guarantee_modes=guarantees or ["credit"], required_credentials=credentials or ["purchase_contract"],
        min_business_years=Decimal(str(min_years)), requirements=["人工核验"],
        data_updated_at="2026-08-23", is_active=True,
    )


DEMAND = FinanceRequirement(
    purpose="grain_purchase", amount_yuan=Decimal("300000"), duration_days=45,
    business_years=Decimal("2"), guarantee_modes=["credit"],
    credentials=["purchase_contract"], source_type="manual",
)


def test_reference_cost_uses_decimal_and_rounds_to_cents():
    assert calculate_reference_cost(Decimal("300000"), Decimal("5.2"), 45) == Decimal("1923.29")


def test_amount_or_duration_mismatch_never_enters_recommendations():
    out = match_products(DEMAND, [
        product("P1", "5.2"),
        product("P2", "4.0", min_amount=500_000),
        product("P3", "3.8", min_days=90, max_days=365),
    ])
    assert out.primary.product.product_code == "P1"
    assert out.backups == []
    assert {item.product.product_code for item in out.rejected} == {"P2", "P3"}


def test_missing_business_years_is_pending_not_fabricated_rejection():
    demand = DEMAND.model_copy(update={"business_years": None})
    out = match_products(demand, [product("P1", "5.2")])
    assert out.primary.product.product_code == "P1"
    assert out.primary.pending_conditions == ["需确认企业持续经营是否满1年"]


def test_missing_required_credential_is_rejected():
    out = match_products(DEMAND, [
        product("P1", "4.9", guarantees=["warehouse_receipt"], credentials=["warehouse_receipt"])
    ])
    assert out.primary is None
    assert "缺少必要凭证" in out.rejected[0].rejection_reasons[0]


def test_sort_is_stable_and_prefers_lower_cost_after_pending_count():
    products = [product("P1", "6.0"), product("P2", "5.2"), product("P3", "5.8")]
    a = match_products(DEMAND, products)
    b = match_products(DEMAND, list(reversed(products)))
    assert a.primary.product.product_code == b.primary.product.product_code == "P2"
    assert [x.product.product_code for x in a.backups] == ["P3", "P1"]
```

- [ ] **Step 2: 运行测试确认 schema 与规则尚不存在**

Run: `cd backend && uv run pytest tests/finance/test_rules.py -v`
Expected: FAIL，包含 `ModuleNotFoundError` 或缺少所列类型与函数。

- [ ] **Step 3: 创建固定的 Pydantic 领域契约**

```python
# backend/app/finance/schemas.py
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Purpose = Literal["grain_purchase", "inventory_turnover", "receivable_turnover"]
SourceType = Literal["manual", "liang", "suan"]


class FinanceRequirement(BaseModel):
    purpose: Purpose
    amount_yuan: Decimal = Field(gt=0, le=100_000_000)
    duration_days: int = Field(ge=1, le=730)
    business_years: Decimal | None = Field(default=None, ge=0, le=100)
    guarantee_modes: list[str] | None = None
    credentials: list[str] | None = None
    source_type: SourceType = "manual"
    source_ref: str | None = Field(default=None, max_length=64)


class FinanceProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_code: str
    name: str
    institution_name: str
    category: str
    scenario: str
    min_amount_yuan: Decimal
    max_amount_yuan: Decimal
    min_days: int
    max_days: int
    annual_rate_pct: Decimal | None
    fee_note: str
    purposes: list[str]
    guarantee_modes: list[str]
    required_credentials: list[str]
    min_business_years: Decimal | None
    requirements: list[str]
    data_updated_at: str


class MatchCandidate(BaseModel):
    product: FinanceProductOut
    estimated_cost_yuan: Decimal | None
    matched_reasons: list[str]
    pending_conditions: list[str]
    rejection_reasons: list[str] = Field(default_factory=list)


class MatchPreview(BaseModel):
    requirement: FinanceRequirement
    primary: MatchCandidate | None
    backups: list[MatchCandidate]
    rejected: list[MatchCandidate]
    explanation: str = ""
```

- [ ] **Step 4: 实现 Decimal 成本和硬条件评估**

```python
# backend/app/finance/rules.py
from decimal import Decimal, ROUND_HALF_UP

from app.finance.schemas import FinanceProductOut, FinanceRequirement, MatchCandidate, MatchPreview


def calculate_reference_cost(amount_yuan: Decimal, annual_rate_pct: Decimal,
                             duration_days: int) -> Decimal:
    value = amount_yuan * annual_rate_pct / Decimal("100") * Decimal(duration_days) / Decimal("365")
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _evaluate(requirement: FinanceRequirement, product) -> tuple[list[str], list[str], list[str]]:
    matched, pending, rejected = [], [], []
    if not (product.min_amount_yuan <= requirement.amount_yuan <= product.max_amount_yuan):
        rejected.append(f"需求金额不在{product.min_amount_yuan}至{product.max_amount_yuan}元额度范围")
    else:
        matched.append("额度覆盖本次资金需求")
    if not (product.min_days <= requirement.duration_days <= product.max_days):
        rejected.append(f"使用期限不在{product.min_days}至{product.max_days}天范围")
    else:
        matched.append("产品期限覆盖本次使用周期")
    if requirement.purpose not in product.purposes:
        rejected.append("产品资金用途与本次需求不一致")
    else:
        matched.append("资金用途一致")
    if requirement.guarantee_modes is None:
        pending.append("需确认可提供或接受的增信方式")
    elif not set(requirement.guarantee_modes) & set(product.guarantee_modes):
        rejected.append("可提供的增信方式不满足产品要求")
    else:
        matched.append("增信方式可匹配")
    if requirement.credentials is None:
        if product.required_credentials:
            pending.append("需确认必要业务凭证是否齐全")
    else:
        missing = set(product.required_credentials) - set(requirement.credentials)
        if missing:
            rejected.append("缺少必要凭证：" + "、".join(sorted(missing)))
        else:
            matched.append("必要业务凭证已具备")
    if product.min_business_years is not None:
        years = Decimal(product.min_business_years)
        if requirement.business_years is None:
            pending.append(f"需确认企业持续经营是否满{years:g}年")
        elif requirement.business_years < years:
            rejected.append(f"企业经营年限不足{years:g}年")
        else:
            matched.append("企业经营年限满足基础条件")
    return matched, pending, rejected
```

- [ ] **Step 5: 实现稳定主推、备选与排除结果**

在 `rules.py` 增加：

```python
def match_products(requirement: FinanceRequirement, products: list) -> MatchPreview:
    feasible: list[MatchCandidate] = []
    rejected_items: list[MatchCandidate] = []
    for row in products:
        product = FinanceProductOut.model_validate(row)
        matched, pending, rejected = _evaluate(requirement, row)
        cost = (
            calculate_reference_cost(requirement.amount_yuan, row.annual_rate_pct, requirement.duration_days)
            if row.annual_rate_pct is not None else None
        )
        candidate = MatchCandidate(
            product=product, estimated_cost_yuan=cost, matched_reasons=matched,
            pending_conditions=pending, rejection_reasons=rejected,
        )
        (rejected_items if rejected else feasible).append(candidate)

    infinity = Decimal("999999999999")
    feasible.sort(key=lambda item: (
        len(item.pending_conditions),
        item.estimated_cost_yuan if item.estimated_cost_yuan is not None else infinity,
        abs(item.product.max_days - requirement.duration_days),
        item.product.product_code,
    ))
    rejected_items.sort(key=lambda item: (len(item.rejection_reasons), item.product.product_code))
    return MatchPreview(
        requirement=requirement,
        primary=feasible[0] if feasible else None,
        backups=feasible[1:3],
        rejected=rejected_items,
    )
```

- [ ] **Step 6: 运行规则测试与全量后端回归**

Run: `cd backend && uv run pytest tests/finance/test_rules.py -v`
Expected: PASS，5 tests passed。
Run: `cd backend && uv run pytest -q`
Expected: 现有测试与 finance 测试全部通过。
Run: `git diff --check`
Expected: 无输出。不要提交。

---

### Task 3: 实现金融市场查询与产品详情 API

**Files:**
- Create: `backend/app/finance/repository.py`
- Modify: `backend/app/finance/routes.py`
- Create: `backend/tests/finance/test_market_routes.py`

**Interfaces:**
- Consumes: `FinanceProduct` 和 `FinanceProductOut`。
- Produces: `list_products(db: Session, filters: dict) -> list[FinanceProduct]`。
- Produces: `get_product(db: Session, product_id: int) -> FinanceProduct | None`。
- Produces: `GET /api/finance/meta`、`GET /api/finance/products`、`GET /api/finance/products/{product_id}`。

- [ ] **Step 1: 写市场概览、筛选和详情失败测试**

```python
# backend/tests/finance/test_market_routes.py
import pytest

from app.finance.seed import seed_finance_products


@pytest.fixture(autouse=True)
def seeded(db_session):
    seed_finance_products(db_session)


def test_meta_exposes_visible_market_summary(client):
    body = client.get("/api/finance/meta").json()
    assert body["product_count"] == 10
    assert set(body["categories"]) == {
        "purchase_working", "order_finance", "warehouse_finance", "receivable_finance"
    }
    assert body["annual_rate_min_pct"] == "4.900"
    assert body["annual_rate_max_pct"] == "7.200"
    assert body["data_updated_at"] == "2026-08-23"


def test_products_filter_by_amount_duration_and_guarantee(client):
    response = client.get(
        "/api/finance/products",
        params={"purpose": "grain_purchase", "amount_yuan": 300000,
                "duration_days": 45, "guarantee_mode": "credit"},
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert items
    assert all(float(x["min_amount_yuan"]) <= 300000 <= float(x["max_amount_yuan"]) for x in items)
    assert all(x["min_days"] <= 45 <= x["max_days"] for x in items)
    assert all("credit" in x["guarantee_modes"] for x in items)


def test_product_detail_and_missing_product(client):
    item = client.get("/api/finance/products").json()["items"][0]
    detail = client.get(f"/api/finance/products/{item['id']}")
    assert detail.status_code == 200
    assert detail.json()["requirements"]
    assert client.get("/api/finance/products/99999").status_code == 404
```

- [ ] **Step 2: 运行测试确认路由尚未实现**

Run: `cd backend && uv run pytest tests/finance/test_market_routes.py -v`
Expected: FAIL，市场端点返回 404。

- [ ] **Step 3: 实现产品查询仓储函数**

```python
# backend/app/finance/repository.py
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.finance.models import FinanceProduct


def list_products(db: Session, filters: dict | None = None) -> list[FinanceProduct]:
    stmt = select(FinanceProduct).where(FinanceProduct.is_active.is_(True))
    filters = filters or {}
    if filters.get("category"):
        stmt = stmt.where(FinanceProduct.category == filters["category"])
    if filters.get("amount_yuan") is not None:
        amount = filters["amount_yuan"]
        stmt = stmt.where(FinanceProduct.min_amount_yuan <= amount,
                          FinanceProduct.max_amount_yuan >= amount)
    if filters.get("duration_days") is not None:
        days = filters["duration_days"]
        stmt = stmt.where(FinanceProduct.min_days <= days, FinanceProduct.max_days >= days)
    rows = list(db.scalars(stmt.order_by(FinanceProduct.id)).all())
    if filters.get("purpose"):
        rows = [row for row in rows if filters["purpose"] in row.purposes]
    if filters.get("guarantee_mode"):
        rows = [row for row in rows if filters["guarantee_mode"] in row.guarantee_modes]
    if filters.get("max_annual_rate_pct") is not None:
        rows = [row for row in rows if row.annual_rate_pct is not None
                and row.annual_rate_pct <= filters["max_annual_rate_pct"]]
    return rows


def get_product(db: Session, product_id: int) -> FinanceProduct | None:
    product = db.get(FinanceProduct, product_id)
    return product if product is not None and product.is_active else None
```

- [ ] **Step 4: 增加市场 API 与中文类别元数据**

在 `routes.py` 定义 `CATEGORY_NAMES` 并实现：

```python
CATEGORY_NAMES = {
    "purchase_working": "采购周转融资",
    "order_finance": "订单融资",
    "warehouse_finance": "仓单/货权融资",
    "receivable_finance": "应收账款融资",
}


@router.get("/meta")
def get_meta(db: Session = Depends(get_db)):
    products = repository.list_products(db)
    rates = [p.annual_rate_pct for p in products if p.annual_rate_pct is not None]
    return {
        "product_count": len(products),
        "categories": list(CATEGORY_NAMES),
        "category_names": CATEGORY_NAMES,
        "annual_rate_min_pct": str(min(rates)) if rates else None,
        "annual_rate_max_pct": str(max(rates)) if rates else None,
        "data_updated_at": max((p.data_updated_at for p in products), default=""),
    }


@router.get("/products")
def get_products(category: str | None = None, purpose: str | None = None,
                 amount_yuan: Decimal | None = None, duration_days: int | None = None,
                 guarantee_mode: str | None = None,
                 max_annual_rate_pct: Decimal | None = None,
                 db: Session = Depends(get_db)):
    filters = {
        "category": category,
        "purpose": purpose,
        "amount_yuan": amount_yuan,
        "duration_days": duration_days,
        "guarantee_mode": guarantee_mode,
        "max_annual_rate_pct": max_annual_rate_pct,
    }
    return {"items": [FinanceProductOut.model_validate(row) for row in repository.list_products(db, filters)]}


@router.get("/products/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = repository.get_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="金融产品不存在或已下架")
    return FinanceProductOut.model_validate(product)
```

- [ ] **Step 5: 运行市场路由测试和回归**

Run: `cd backend && uv run pytest tests/finance/test_market_routes.py -v`
Expected: PASS，3 tests passed。
Run: `cd backend && uv run pytest -q`
Expected: 全部通过。
Run: `git diff --check`
Expected: 无输出。不要提交。

---

### Task 4: 实现自然语言需求抽取与稳定降级

**Files:**
- Create: `backend/app/finance/llm.py`
- Modify: `backend/app/finance/routes.py`
- Create: `backend/tests/finance/test_llm.py`

**Interfaces:**
- Produces: `RequirementExtraction` Pydantic 模型。
- Produces: `extract_requirement(text: str) -> dict`，始终返回 `llm_available`、`fields`、`assumptions` 和 `question`。
- Produces: `POST /api/finance/requirements/extract`。
- 后续 Produces: `explain_match(preview: MatchPreview) -> str`。

- [ ] **Step 1: 写无 Key 仍可演示、缺项补问和不得选产品测试**

```python
# backend/tests/finance/test_llm.py
def test_fallback_extracts_demo_requirement_without_key(client, monkeypatch):
    from app.finance import llm
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    response = client.post("/api/finance/requirements/extract", json={
        "text": "采购200吨玉米，缺30万元，预计45天回款，没有抵押物，有采购合同"
    })
    assert response.status_code == 200
    body = response.json()
    assert body["llm_available"] is False
    assert body["fields"] == {
        "purpose": "grain_purchase", "amount_yuan": "300000",
        "duration_days": 45, "business_years": None,
        "guarantee_modes": ["credit"], "credentials": ["purchase_contract"],
    }
    assert body["question"] == "企业持续经营多久了？"


def test_fallback_asks_amount_before_less_important_fields(client, monkeypatch):
    from app.finance import llm
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    body = client.post("/api/finance/requirements/extract", json={
        "text": "想做一笔粮食采购融资，预计用45天"
    }).json()
    assert body["question"] == "本次资金缺口是多少？"


def test_extract_rejects_empty_text(client):
    response = client.post("/api/finance/requirements/extract", json={"text": "  "})
    assert response.status_code == 422
    assert response.json()["detail"] == "请描述本次资金需求"
```

- [ ] **Step 2: 运行测试确认抽取端点尚不存在**

Run: `cd backend && uv run pytest tests/finance/test_llm.py -v`
Expected: FAIL，端点返回 404 或 `app.finance.llm` 不存在。

- [ ] **Step 3: 实现确定性中文降级提取**

```python
# backend/app/finance/llm.py
import re
from decimal import Decimal


def _fallback_extract(text: str) -> dict:
    amount = None
    amount_match = re.search(r"(?:缺口|还缺|缺|需要|融资)\s*(\d+(?:\.\d+)?)\s*万", text)
    if amount_match:
        amount = Decimal(amount_match.group(1)) * Decimal("10000")
    days_match = re.search(r"(\d+)\s*天", text)
    years_match = re.search(r"(?:经营|成立)\D{0,4}(\d+(?:\.\d+)?)\s*年", text)
    credentials = []
    for keyword, code in {
        "采购合同": "purchase_contract", "采购订单": "purchase_order",
        "仓单": "warehouse_receipt", "货权": "controlled_goods",
        "应收账款": "receivable_invoice", "交货单": "delivery_receipt",
        "银行流水": "bank_flow", "营业执照": "business_license",
    }.items():
        if keyword in text:
            credentials.append(code)
    guarantee_modes = ["credit"] if "没有抵押" in text or "无抵押" in text else None
    fields = {
        "purpose": "grain_purchase" if "采购" in text else None,
        "amount_yuan": str(amount.quantize(Decimal("1"))) if amount is not None else None,
        "duration_days": int(days_match.group(1)) if days_match else None,
        "business_years": years_match.group(1) if years_match else None,
        "guarantee_modes": guarantee_modes,
        "credentials": credentials or None,
    }
    question = None
    if fields["amount_yuan"] is None:
        question = "本次资金缺口是多少？"
    elif fields["duration_days"] is None:
        question = "预计需要使用资金多久？"
    elif fields["purpose"] is None:
        question = "这笔资金主要用于采购、库存周转还是应收周转？"
    elif fields["business_years"] is None:
        question = "企业持续经营多久了？"
    return {"llm_available": False, "fields": fields, "assumptions": [], "question": question}
```

- [ ] **Step 4: 增加 LangChain 结构化抽取，失败时回退**

使用与现有物流 Agent 相同的 Qwen OpenAI-compatible 配置，完整定义：

```python
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

logger = logging.getLogger("qian.finance.llm")
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
QWEN_API_KEY: str | None = None
DEFAULT_MODEL = "qwen-plus"
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"


class RequirementExtraction(BaseModel):
    purpose: str | None = None
    amount_yuan: Decimal | None = None
    duration_days: int | None = None
    business_years: Decimal | None = None
    guarantee_modes: list[str] | None = None
    credentials: list[str] | None = None
    assumptions: list[str] = Field(default_factory=list)
    question: str | None = None


SYSTEM_PROMPT = (
    "你是粮达网 Plus 的资金服务助手钱小二。只把用户描述抽取为资金需求字段，"
    "不得推荐金融产品，不得编造额度、利率、期限、授信或放款结果。"
    "purpose 只能是 grain_purchase、inventory_turnover、receivable_turnover；"
    "guarantee_modes 和 credentials 只能使用提示中给定的枚举。"
)


def _config() -> tuple[str, str, str]:
    if QWEN_API_KEY is not None:
        return QWEN_API_KEY, os.getenv("QWEN_MODEL", DEFAULT_MODEL), os.getenv("QWEN_BASE_URL", DEFAULT_BASE_URL)
    load_dotenv(_ENV_PATH, override=True)
    return (
        os.getenv("QWEN_API_KEY", "").strip(),
        os.getenv("QWEN_MODEL", DEFAULT_MODEL),
        os.getenv("QWEN_BASE_URL", DEFAULT_BASE_URL),
    )


def _build_llm(api_key: str, model: str, base_url: str):
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(model=model, api_key=api_key, base_url=base_url,
                      temperature=0.1, timeout=120, max_retries=1)


def _question_for(fields: dict) -> str | None:
    if fields["amount_yuan"] is None:
        return "本次资金缺口是多少？"
    if fields["duration_days"] is None:
        return "预计需要使用资金多久？"
    if fields["purpose"] is None:
        return "这笔资金主要用于采购、库存周转还是应收周转？"
    if fields["business_years"] is None:
        return "企业持续经营多久了？"
    return None


def extract_requirement(text: str) -> dict:
    fallback = _fallback_extract(text)
    api_key, model, base_url = _config()
    if not api_key:
        return fallback
    try:
        result = _build_llm(api_key, model, base_url).with_structured_output(
            RequirementExtraction
        ).invoke([("system", SYSTEM_PROMPT), ("human", text)])
        if result is None:
            return fallback
        purpose = result.purpose if result.purpose in {
            "grain_purchase", "inventory_turnover", "receivable_turnover"
        } else None
        guarantees = [item for item in (result.guarantee_modes or []) if item in {
            "credit", "guarantee", "order", "warehouse_receipt", "controlled_goods", "receivable"
        }] or None
        credentials = [item for item in (result.credentials or []) if item in {
            "purchase_contract", "purchase_order", "warehouse_receipt", "controlled_goods",
            "receivable_invoice", "delivery_receipt", "business_license", "bank_flow"
        }] or None
        fields = {
            "purpose": purpose,
            "amount_yuan": str(result.amount_yuan) if result.amount_yuan and result.amount_yuan > 0 else None,
            "duration_days": result.duration_days if result.duration_days and result.duration_days > 0 else None,
            "business_years": str(result.business_years) if result.business_years is not None else None,
            "guarantee_modes": guarantees,
            "credentials": credentials,
        }
        return {
            "llm_available": True,
            "fields": fields,
            "assumptions": result.assumptions,
            "question": _question_for(fields),
        }
    except Exception:
        logger.exception("钱小二需求抽取失败，回退规则抽取")
        return fallback
```

无论 LLM 是否可用，关键字段补问顺序固定为金额、期限、用途、经营年限，不让模型自由决定优先级。

- [ ] **Step 5: 增加抽取 API**

```python
class ExtractRequest(BaseModel):
    text: str


@router.post("/requirements/extract")
def extract_requirement_route(body: ExtractRequest):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="请描述本次资金需求")
    return llm.extract_requirement(text)
```

- [ ] **Step 6: 运行 LLM 测试与回归**

Run: `cd backend && uv run pytest tests/finance/test_llm.py -v`
Expected: PASS，3 tests passed。
Run: `cd backend && uv run pytest -q`
Expected: 全部通过。
Run: `git diff --check`
Expected: 无输出。不要提交。

---

### Task 5: 实现匹配预览、保存、历史与轻量算小二交接 API

**Files:**
- Modify: `backend/app/finance/repository.py`
- Modify: `backend/app/finance/llm.py`
- Modify: `backend/app/finance/routes.py`
- Create: `backend/tests/finance/test_match_routes.py`

**Interfaces:**
- Consumes: `FinanceRequirement`、`match_products()`、活动产品池。
- Produces: `POST /api/finance/matches/preview`。
- Produces: `POST /api/finance/matches`、`GET /api/finance/matches`、`GET /api/finance/matches/{match_id}`。
- Produces: `POST /api/finance/matches/{match_id}/handoff/suan`，只返回结构化成本交接，不建立工作流。
- Produces: `create_match_record(db, requirement, preview) -> FinanceMatchRecord`。

- [ ] **Step 1: 写预览、保存、历史和无结果失败测试**

```python
# backend/tests/finance/test_match_routes.py
import pytest

from app.finance.seed import seed_finance_products


@pytest.fixture(autouse=True)
def seeded(db_session):
    seed_finance_products(db_session)


DEMAND = {
    "purpose": "grain_purchase", "amount_yuan": "300000", "duration_days": 45,
    "business_years": "2", "guarantee_modes": ["credit"],
    "credentials": ["purchase_contract"], "source_type": "manual",
}


def test_preview_returns_explainable_primary_backup_and_rejection(client, monkeypatch):
    from app.finance import llm
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    response = client.post("/api/finance/matches/preview", json={"requirement": DEMAND})
    assert response.status_code == 200
    body = response.json()
    assert body["primary"]["product"]["product_code"] == "QIAN-V1-PW-01"
    assert 1 <= len(body["backups"]) <= 2
    assert any("凭证" in "".join(x["rejection_reasons"]) or "增信" in "".join(x["rejection_reasons"])
               for x in body["rejected"])
    assert "粮采周转贷" in body["explanation"]


def test_preview_does_not_save_until_user_requests_save(client):
    client.post("/api/finance/matches/preview", json={"requirement": DEMAND})
    assert client.get("/api/finance/matches").json()["items"] == []
    saved = client.post("/api/finance/matches", json={"requirement": DEMAND})
    assert saved.status_code == 200
    assert len(client.get("/api/finance/matches").json()["items"]) == 1


def test_no_full_match_returns_no_primary_and_clear_message(client):
    demand = DEMAND | {"amount_yuan": "9000000", "duration_days": 600}
    body = client.post("/api/finance/matches/preview", json={"requirement": demand}).json()
    assert body["primary"] is None
    assert body["backups"] == []
    assert body["rejected"]
    assert "没有完全符合" in body["explanation"]


def test_saved_match_detail_and_suan_handoff(client):
    saved = client.post("/api/finance/matches", json={"requirement": DEMAND}).json()
    detail = client.get(f"/api/finance/matches/{saved['id']}")
    assert detail.status_code == 200
    handoff = client.post(f"/api/finance/matches/{saved['id']}/handoff/suan").json()
    assert handoff["source_agent"] == "qian"
    assert handoff["target_agent"] == "suan"
    assert handoff["amount_yuan"] == "300000"
    assert handoff["duration_days"] == 45
    assert handoff["reference_cost_yuan"] == saved["result"]["primary"]["estimated_cost_yuan"]
```

- [ ] **Step 2: 运行测试确认匹配端点尚未实现**

Run: `cd backend && uv run pytest tests/finance/test_match_routes.py -v`
Expected: FAIL，匹配端点返回 404。

- [ ] **Step 3: 实现稳定的规则版解释与受约束 AI 解释**

在 `llm.py` 增加：

```python
def _fallback_explanation(preview: MatchPreview) -> str:
    if preview.primary is None:
        return "当前产品池中没有完全符合本次金额、期限和办理条件的产品，请调整条件或咨询金融顾问。"
    primary = preview.primary
    text = (
        f"主推{primary.product.name}："
        + "；".join(primary.matched_reasons[:3])
        + f"。参考资金成本约{primary.estimated_cost_yuan}元。"
    )
    if primary.pending_conditions:
        text += "仍需确认：" + "；".join(primary.pending_conditions) + "。"
    if preview.backups:
        text += "备选为" + "、".join(x.product.name for x in preview.backups) + "。"
    return text


class MatchExplanation(BaseModel):
    referenced_product_codes: list[str] = Field(default_factory=list)
    summary: str


EXPLANATION_SYSTEM_PROMPT = (
    "你是粮达网 Plus 的资金服务助手钱小二。你的任务是解释已经由确定性规则形成的"
    "金融产品匹配结果。不得新增产品、数字、条件，不得承诺授信、审批或放款。"
)


def explain_match(preview: MatchPreview) -> str:
    fallback = _fallback_explanation(preview)
    api_key, model, base_url = _config()
    if not api_key:
        return fallback
    allowed_codes = {
        item.product.product_code
        for item in ([preview.primary] if preview.primary else []) + preview.backups + preview.rejected
    }
    prompt = (
        "以下是确定性规则形成的金融产品匹配结果。只能解释已有结论，不得新增产品、"
        "额度、利率、期限、授信或放款承诺。\n"
        + json.dumps(preview.model_dump(mode="json"), ensure_ascii=False)
    )
    try:
        result = _build_llm(api_key, model, base_url).with_structured_output(
            MatchExplanation
        ).invoke([("system", EXPLANATION_SYSTEM_PROMPT), ("human", prompt)])
        if result is None or not result.summary.strip():
            return fallback
        if not set(result.referenced_product_codes).issubset(allowed_codes):
            return fallback
        return result.summary.strip()
    except Exception:
        logger.exception("钱小二匹配解释失败，回退规则解释")
        return fallback
```

同时在 `llm.py` 顶部导入 `json`、`logging` 和 `Field`，并定义 `logger = logging.getLogger("qian.finance.llm")`。正式结构化结果始终返回 `match_products()` 原值，解释文本不能反向修改结果。

- [ ] **Step 4: 实现匹配记录仓储**

```python
# backend/app/finance/repository.py
from datetime import datetime

from app.finance.models import FinanceMatchRecord


def _next_match_code(db: Session) -> str:
    prefix = f"QPM{datetime.now():%Y%m%d}-"
    count = db.query(FinanceMatchRecord).filter(
        FinanceMatchRecord.match_code.like(f"{prefix}%")
    ).count()
    return f"{prefix}{count + 1:03d}"


def create_match_record(db: Session, requirement: FinanceRequirement,
                        preview: MatchPreview) -> FinanceMatchRecord:
    row = FinanceMatchRecord(
        match_code=_next_match_code(db), source_type=requirement.source_type,
        source_ref=requirement.source_ref,
        requirement_snapshot=requirement.model_dump(mode="json"),
        result_snapshot=preview.model_dump(mode="json", exclude={"requirement", "explanation"}),
        explanation=preview.explanation,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_match_records(db: Session) -> list[FinanceMatchRecord]:
    return list(db.scalars(select(FinanceMatchRecord).order_by(FinanceMatchRecord.id.desc())).all())


def get_match_record(db: Session, match_id: int) -> FinanceMatchRecord | None:
    return db.get(FinanceMatchRecord, match_id)
```

- [ ] **Step 5: 实现预览、保存、历史、详情和交接路由**

定义 `MatchRequest(BaseModel)`，只有 `requirement: FinanceRequirement`。抽出 `_build_preview(db, requirement)`：读取全部活动产品、调用 `match_products()`，再设置 `preview.explanation = llm.explain_match(preview)`。

响应序列化固定为：

```python
def _serialize_record(row: FinanceMatchRecord) -> dict:
    return {
        "id": row.id, "match_code": row.match_code,
        "source_type": row.source_type, "source_ref": row.source_ref,
        "requirement": row.requirement_snapshot,
        "result": row.result_snapshot | {"explanation": row.explanation},
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
```

端点行为：

- `POST /matches/preview`：只返回 `MatchPreview`，不写数据库。
- `POST /matches`：重新基于当前活动产品计算后保存，不能信任前端上传的旧结果。
- `GET /matches`：返回 `{"items": [...]}`，倒序排列。
- `GET /matches/{id}`：不存在时返回 404 和“匹配记录不存在”。
- `POST /matches/{id}/handoff/suan`：无主推时返回 422；有主推时返回 `source_agent`、`target_agent`、`source_match_id`、`product_code`、`product_name`、`amount_yuan`、`duration_days`、`annual_rate_pct`、`reference_cost_yuan`、`fee_note`、`pending_conditions`。不新增任务表、不修改记录状态。

- [ ] **Step 6: 运行匹配 API 测试和后端全量回归**

Run: `cd backend && uv run pytest tests/finance/test_match_routes.py -v`
Expected: PASS，4 tests passed。
Run: `cd backend && uv run pytest tests/finance -v`
Expected: finance 全部测试通过。
Run: `cd backend && uv run pytest -q`
Expected: 项目全量后端测试通过。
Run: `git diff --check`
Expected: 无输出。不要提交。

---

### Task 6: 建立前端类型、API 与钱小二三 Tab 页面壳

**Files:**
- Create: `web/src/features/qian/types.ts`
- Create: `web/src/features/qian/api.ts`
- Create: `web/src/features/qian/QianPage.tsx`
- Modify: `web/src/pages/agents/AgentServicePage.tsx`
- Modify: `web/src/data/agents.ts`

**Interfaces:**
- Consumes: Task 3–5 的 `/api/finance` JSON 契约。
- Produces: `QianPage` 三 Tab 壳。
- Produces: `fetchFinanceMeta()`、`fetchFinanceProducts(filters)`、`fetchFinanceProduct(id)`、`extractFinanceRequirement(text)`、`previewFinanceMatch(requirement)`、`saveFinanceMatch(requirement)`、`fetchFinanceMatches()`、`fetchFinanceMatch(id)`、`handoffFinanceMatchToSuan(id)`。
- Produces: `Partial<FinanceRequirement>` 跨 Tab 草稿状态。

- [ ] **Step 1: 定义与后端一一对应的 TypeScript 类型**

```typescript
// web/src/features/qian/types.ts
export type FinanceCategory =
  | "purchase_working" | "order_finance" | "warehouse_finance" | "receivable_finance";
export type FinancePurpose = "grain_purchase" | "inventory_turnover" | "receivable_turnover";
export type SourceType = "manual" | "liang" | "suan";

export interface FinanceProduct {
  id: number;
  product_code: string;
  name: string;
  institution_name: string;
  category: FinanceCategory;
  scenario: string;
  min_amount_yuan: string;
  max_amount_yuan: string;
  min_days: number;
  max_days: number;
  annual_rate_pct: string | null;
  fee_note: string;
  purposes: FinancePurpose[];
  guarantee_modes: string[];
  required_credentials: string[];
  min_business_years: string | null;
  requirements: string[];
  data_updated_at: string;
}

export interface FinanceRequirement {
  purpose: FinancePurpose;
  amount_yuan: string;
  duration_days: number;
  business_years: string | null;
  guarantee_modes: string[] | null;
  credentials: string[] | null;
  source_type: SourceType;
  source_ref?: string | null;
}

export interface MatchCandidate {
  product: FinanceProduct;
  estimated_cost_yuan: string | null;
  matched_reasons: string[];
  pending_conditions: string[];
  rejection_reasons: string[];
}

export interface MatchPreview {
  requirement: FinanceRequirement;
  primary: MatchCandidate | null;
  backups: MatchCandidate[];
  rejected: MatchCandidate[];
  explanation: string;
}

export interface MatchRecord {
  id: number;
  match_code: string;
  source_type: SourceType;
  source_ref: string | null;
  requirement: FinanceRequirement;
  result: Omit<MatchPreview, "requirement">;
  created_at: string;
}

export interface FinanceMeta {
  product_count: number;
  categories: FinanceCategory[];
  category_names: Record<FinanceCategory, string>;
  annual_rate_min_pct: string | null;
  annual_rate_max_pct: string | null;
  data_updated_at: string;
}

export interface FinanceProductFilters {
  category?: FinanceCategory;
  purpose?: FinancePurpose;
  amount_yuan?: string;
  duration_days?: string;
  guarantee_mode?: string;
  max_annual_rate_pct?: string;
}

export interface ExtractionResponse {
  llm_available: boolean;
  fields: Partial<FinanceRequirement>;
  assumptions: string[];
  question: string | null;
}

export interface FinanceHandoff {
  source_agent: "qian";
  target_agent: "suan";
  source_match_id: number;
  product_code: string;
  product_name: string;
  amount_yuan: string;
  duration_days: number;
  annual_rate_pct: string | null;
  reference_cost_yuan: string | null;
  fee_note: string;
  pending_conditions: string[];
}
```

- [ ] **Step 2: 实现统一 HTTP 封装和所有 finance API**

```typescript
// web/src/features/qian/api.ts
async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `请求失败（${response.status}）`);
  }
  return response.json();
}

function post<T>(url: string, body?: unknown): Promise<T> {
  return http<T>(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const previewFinanceMatch = (requirement: FinanceRequirement) =>
  post<MatchPreview>("/api/finance/matches/preview", { requirement });
export const saveFinanceMatch = (requirement: FinanceRequirement) =>
  post<MatchRecord>("/api/finance/matches", { requirement });

function query(filters: FinanceProductFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, value);
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

export const fetchFinanceMeta = () => http<FinanceMeta>("/api/finance/meta");
export const fetchFinanceProducts = (filters: FinanceProductFilters = {}) =>
  http<{ items: FinanceProduct[] }>(`/api/finance/products${query(filters)}`);
export const fetchFinanceProduct = (id: number) =>
  http<FinanceProduct>(`/api/finance/products/${id}`);
export const extractFinanceRequirement = (text: string) =>
  post<ExtractionResponse>("/api/finance/requirements/extract", { text });
export const fetchFinanceMatches = () =>
  http<{ items: MatchRecord[] }>("/api/finance/matches");
export const fetchFinanceMatch = (id: number) =>
  http<MatchRecord>(`/api/finance/matches/${id}`);
export const handoffFinanceMatchToSuan = (id: number) =>
  post<FinanceHandoff>(`/api/finance/matches/${id}/handoff/suan`);
```

从 `types.ts` 导入以上全部接口类型。金额保持字符串传输，避免 JavaScript 浮点数成为正式金额来源。

- [ ] **Step 3: 创建三个 Tab 页面壳和跨 Tab 状态**

`QianPage.tsx` 定义：

```typescript
const TABS = ["金融市场", "智能匹配", "我的匹配"] as const;
const [activeTab, setActiveTab] = useState(0);
const [draft, setDraft] = useState<Partial<FinanceRequirement> | null>(null);
const [selectedProduct, setSelectedProduct] = useState<FinanceProduct | null>(null);
const [savedVersion, setSavedVersion] = useState(0);
```

页面头部复用 `AgentSwitcher` 和 `getAgent("qian")`，结构与 `YunPage.tsx` 一致。临时为三个 Tab 分别渲染带中文标题的最小占位区，确认路由已脱离通用占位页。

- [ ] **Step 4: 接入现有 Agent 路由并更新 Tab 名称**

在 `AgentServicePage.tsx`：

```typescript
import QianPage from "../../features/qian/QianPage";

// getAgent 校验之后、通用占位页之前
if (agent.id === "qian") return <QianPage />;
```

在 `agents.ts` 将钱小二 `tabs` 精确替换为：

```typescript
tabs: ["金融市场", "智能匹配", "我的匹配"],
doing: "分析采购资金需求，从金融产品市场筛选主推与备选方案",
```

- [ ] **Step 5: 运行前端构建和人工路由检查**

Run: `cd web && npm run build`
Expected: `tsc` 与 Vite build 成功。
Run: 启动前后端后访问 `/agent/qian`。
Expected: 显示钱小二独立页面与三个 Tab，切换小二仍可用，不再显示“正在建设中”。
Run: `git diff --check`
Expected: 无输出。不要提交。

---

### Task 7: 实现金融市场、筛选和产品详情抽屉

**Files:**
- Create: `web/src/features/qian/FinanceMarketTab.tsx`
- Create: `web/src/features/qian/ProductDrawer.tsx`
- Modify: `web/src/features/qian/QianPage.tsx`

**Interfaces:**
- Consumes: `fetchFinanceMeta()`、`fetchFinanceProducts(filters)`、`fetchFinanceProduct(id)`。
- Produces: `FinanceMarketTab({ onStartMatch })`。
- Produces: `ProductDrawer({ product, onClose, onStartMatch })`。
- Produces: 产品条件带入 `Partial<FinanceRequirement>`。

- [ ] **Step 1: 实现市场数据加载、筛选状态和明确错误态**

`FinanceMarketTab.tsx` 定义筛选状态：

```typescript
interface Filters {
  category: FinanceCategory | "";
  purpose: FinancePurpose | "";
  amount_yuan: string;
  duration_days: string;
  guarantee_mode: string;
  max_annual_rate_pct: string;
}

const EMPTY_FILTERS: Filters = {
  category: "", purpose: "", amount_yuan: "", duration_days: "",
  guarantee_mode: "", max_annual_rate_pct: "",
};
```

首次进入并行加载 meta 与 products。点击“应用筛选”后才重新请求，避免每次输入都触发 API。失败时展示“金融产品加载失败：{error}”和“重新加载”，不保留伪成功卡片。

- [ ] **Step 2: 实现市场优先页面结构**

顶部概览必须展示：

- `{product_count} 款可选产品`。
- `参考年化 {min}%–{max}%`。
- 四类产品数量或类别标签。
- `数据更新于 {data_updated_at}`。
- 暖橙色主按钮“让钱小二帮我匹配”。

桌面布局使用 `lg:grid-cols-[240px_1fr]`。左侧为六项筛选和“应用筛选/重置”；右侧产品卡展示名称、机构、场景、额度区间、期限、参考年化、增信标签、关键准入条件、更新时间以及“查看详情/拿这个产品去匹配”。

金额显示使用：

```typescript
export function formatWan(value: string): string {
  return `${(Number(value) / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}万`;
}
```

`annual_rate_pct === null` 时显示“费用需人工确认”，不得显示 0%。

- [ ] **Step 3: 实现产品详情抽屉**

`ProductDrawer` 使用 fixed 遮罩和右侧 `max-w-[520px]` 面板，展示：

- 适用场景、额度、期限、参考成本、费用说明。
- 增信方式、必要凭证、最低经营年限。
- 完整 `requirements`。
- “适合”与“需注意”文案。
- 数据更新时间。
- 固定提示“产品条件与费用需由金融顾问最终确认”。

底部动作只有“拿这个产品去匹配”和“关闭”。前者将产品支持的第一个 `purpose`、额度下限和期限下限作为可编辑草稿带入智能匹配，不自动执行匹配。

- [ ] **Step 4: 在 QianPage 串联市场与智能匹配**

`onStartMatch(partial)` 的固定行为：

```typescript
setDraft(partial ?? null);
setActiveTab(1);
```

页面不使用全局 Context，不新增状态管理依赖。

- [ ] **Step 5: 构建并人工验证金融市场**

Run: `cd web && npm run build`
Expected: 构建成功。
Manual:

1. 默认进入金融市场并看到 10 款产品概览。
2. 筛选 30 万、45 天、信用增信后只显示符合条件的产品。
3. 打开仓单产品抽屉能看到仓单要求和更新时间。
4. “拿这个产品去匹配”只进入需求页，不直接产生结果。

Run: `git diff --check`
Expected: 无输出。不要提交。

---

### Task 8: 实现单页智能匹配和可解释结果

**Files:**
- Create: `web/src/features/qian/SmartMatchTab.tsx`
- Modify: `web/src/features/qian/QianPage.tsx`

**Interfaces:**
- Consumes: `draft`、`extractFinanceRequirement()`、`previewFinanceMatch()`、`saveFinanceMatch()`。
- Produces: `SmartMatchTab({ prefill, onSaved, onViewProduct })`。
- Produces: 需求文本、确认卡、预览结果和保存状态。

- [ ] **Step 1: 实现“描述需求 → 提取字段”状态机**

组件状态固定为：

```typescript
const [text, setText] = useState("采购200吨玉米，缺30万元，预计45天回款，没有抵押物，有采购合同");
const [requirement, setRequirement] = useState<FinanceRequirement | null>(null);
const [question, setQuestion] = useState<string | null>(null);
const [preview, setPreview] = useState<MatchPreview | null>(null);
const [loading, setLoading] = useState<"extract" | "preview" | "save" | null>(null);
const [error, setError] = useState<string | null>(null);
```

点击“分析需求”调用抽取 API。将返回字段合并为需求草稿，但缺少 `purpose`、`amount_yuan` 或 `duration_days` 时不得创建可提交的 `FinanceRequirement`；页面展示 `question` 和对应字段输入。

- [ ] **Step 2: 实现可编辑需求确认卡**

确认卡只包含：

- 资金用途：采购、库存周转、应收周转。
- 资金缺口：元输入，旁边显示万元换算。
- 使用期限：天。
- 企业经营年限：可空。
- 增信方式：信用、保证、订单、仓单、受控货权、应收账款。
- 凭证：采购合同、采购订单、仓单、货权、应收凭证、交货单、营业执照、银行流水。

若来自 `liang` 或 `suan`，显示“来自粮小二/算小二，仍需你确认”。按钮文字固定为“确认并匹配”。只有三项必填字段合法时按钮可用。

- [ ] **Step 3: 调用预览并在同一页展示结果**

确认后调用 `previewFinanceMatch(requirement)`。结果区域顺序固定：

1. 钱小二判断摘要 `explanation`。
2. 主推卡：暖橙描边，展示理由、覆盖金额、期限、参考年化、参考资金成本和待确认条件。
3. 至多两个备选卡：展示相对主推的成本与条件差异。
4. “为什么其他产品不适合”：默认展示前三个排除结果，可展开全部。

主推不存在时展示：

```text
当前产品池中没有完全符合本次条件的产品
请调整金额、期限或增信方式后重新匹配；也可以查看最接近产品的差距。
```

不得把 rejected 产品渲染成可选择推荐。

- [ ] **Step 4: 实现保存、产品详情和咨询摘要**

结果动作：

- “查看产品详情”：调用 `onViewProduct(primary.product)` 打开 Task 7 抽屉。
- “调整需求”：保留确认卡输入，清空 preview 并滚动到确认卡。
- “保存匹配结果”：调用 `saveFinanceMatch(requirement)`，成功后显示匹配编号，调用 `onSaved()` 让历史 Tab 刷新。
- “咨询金融顾问”：打开本地弹窗，内容包含需求金额、期限、主推产品、参考资金成本和待确认条件；提供“复制咨询摘要”，不提交后台、不显示已申请。

保存按钮在成功后禁用并显示“已保存 {match_code}”，避免重复点击产生多条记录。

- [ ] **Step 5: 增加固定免责声明和异常回退**

智能匹配页底部和结果卡均展示“参考匹配，不代表授信或放款承诺”。抽取失败时保留结构化确认卡，不清空用户原文；预览失败时保留已确认需求，让用户可以重试。

- [ ] **Step 6: 构建并人工验证代表流程**

Run: `cd web && npm run build`
Expected: 构建成功。
Manual:

1. 输入代表场景，确认提取出 30 万、45 天、采购用途、信用与采购合同。
2. 补充经营 2 年后，主推“粮采周转贷”。
3. 页面展示参考资金成本约 1,923.29 元。
4. 仓单产品出现在排除原因中，不能被选择为主推。
5. 保存后出现匹配编号；咨询动作只生成摘要。

Run: `git diff --check`
Expected: 无输出。不要提交。

---

### Task 9: 实现历史匹配、重新匹配和最终集成

**Files:**
- Create: `web/src/features/qian/MatchRecordsTab.tsx`
- Modify: `web/src/features/qian/QianPage.tsx`
- Modify: `web/src/features/qian/SmartMatchTab.tsx`
- Modify: `docs/粮达网Plus产品设计文档-V2.md`

**Interfaces:**
- Consumes: `fetchFinanceMatches()`、`fetchFinanceMatch(id)`、`handoffFinanceMatchToSuan(id)`。
- Produces: `MatchRecordsTab({ refreshKey, onReuse, onOpenProduct })`。
- Produces: 历史需求回填、历史结果详情和轻量算小二成本交接。

- [ ] **Step 1: 实现历史列表、空状态和错误态**

`MatchRecordsTab` 在进入时和 `refreshKey` 变化时加载记录。每条记录展示：

- 匹配编号和时间。
- `金额 + 期限 + 用途` 摘要。
- 主推产品名称；无主推时显示“未找到完全符合产品”。
- 参考资金成本。
- 当时待确认条件数量。
- “查看结果”和“重新匹配”。

无记录显示“还没有保存的匹配结果”和“开始智能匹配”动作。加载失败展示错误和重试，不展示演示占位卡。

- [ ] **Step 2: 实现历史详情和重新匹配**

“查看结果”使用页面内展开或抽屉展示保存时的产品快照、理由、待确认项和免责声明，不重新请求当前产品替换历史结果。

“重新匹配”只执行：

```typescript
onReuse(record.requirement);
```

`QianPage` 收到后设置 `draft` 并切换智能匹配 Tab；`SmartMatchTab` 显示“来自历史匹配 {match_code}”，用户再次确认后基于当前产品池重新预览。

- [ ] **Step 3: 实现轻量算小二交接入口**

仅当历史记录存在主推时展示“交给算小二测成本”。点击后先显示确认卡：使用金额、期限、产品、年化参考成本、参考资金成本、待确认条件。用户确认后调用 `/handoff/suan` 并展示“已生成算小二交接数据”；由于当前算小二页面尚未实现消费者，不伪造协作任务或完成状态。

- [ ] **Step 4: 同步总产品文档**

在 `docs/粮达网Plus产品设计文档-V2.md` 的钱小二章节和 8.7 页面结构中明确替换为：

```text
钱小二首版聚焦金融产品市场与智能匹配，只回答“市场上有什么”和“我适合哪个”。
页内 Tab：金融市场、智能匹配、我的匹配。
首版不承担贷款申请、审批进度、现金流管理和长期融资偏好记忆。
```

保留“参考匹配，不代表授信或放款承诺”和用户最终确认边界。

- [ ] **Step 5: 运行前后端全量验证**

Run: `cd backend && uv run pytest -q`
Expected: 项目后端全量测试通过。
Run: `cd web && npm run build`
Expected: TypeScript 与 Vite 构建通过。
Run: `git diff --check`
Expected: 无输出。

- [ ] **Step 6: 完成桌面 Web 人工验收**

按以下顺序验收：

1. `/agent/qian` 默认打开金融市场，显示 10 款产品和 2026-08-23 更新口径。
2. 市场筛选、产品详情和“拿这个产品去匹配”均可用。
3. 代表场景产生主推、备选、排除原因和确定性参考成本。
4. 无完全匹配场景不会强行推荐。
5. 保存后“我的匹配”出现记录，刷新页面后仍存在。
6. 重新匹配会重新确认并查询当前产品池，不直接复用旧结论。
7. 所有关键页面均显示参考口径和免责声明。
8. 未配置 QWEN Key 时仍可通过规则抽取完成代表演示。
9. `git status --short` 仅出现本计划范围内的文件；已有用户修改保持不变。

完成后停止，不提交 Git；由用户决定审查、继续修改或手动提交。
