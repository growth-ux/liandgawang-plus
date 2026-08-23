# 粮小二第一 Tab「找粮源」实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现粮小二默认入口「找粮源」Tab 的粮源市场页面——概览 + 筛选 + 高密度列表 + 市场发现 + 全局候选篮 + 「我要找粮」输入框，纯浏览不落库。

**Architecture:** 后端新增 `app/liang/` 模块（模型/种子/repository/聚合/routes），暴露三个只读接口；前端新增 `web/src/features/liang/`（types/api/format/parseNeed/CandidateContext/各组件），`LiangPage` 复用瞻小二的三栏布局与 tab 切换模式。候选篮为前端 Context 状态，不落库。

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + pytest（sqlite 内存库）；React 18 + TypeScript + Tailwind v4（无前端测试框架，用 `npm run build` 做类型校验）。

**约定：** 本项目 CLAUDE.md 禁止自动提交。每个 Task 末尾的 commit 步骤在执行时**跳过**，改为由用户手动提交。后端用 TDD（先测试后实现）；前端无测试框架，每个 Task 用 `npm run build` 校验类型后手动 `npm run dev` 目视验收。

---

## File Structure

**后端（新增 `app/liang/` 模块）：**
- `backend/app/liang/__init__.py` — 空包标记
- `backend/app/liang/models.py` — `GrainListing` 表
- `backend/app/liang/mock_seed.py` — 固定 12 条粮源种子（幂等）
- `backend/app/liang/repository.py` — `list_listings` / `get_listing`
- `backend/app/liang/metrics.py` — `build_summary` / `build_discoveries`（确定性聚合）
- `backend/app/liang/routes.py` — 三个只读接口
- `backend/app/main.py` — 注册模型、种子、路由
- `backend/tests/liang/test_seed.py` / `test_repository.py` / `test_routes.py` / `test_metrics.py`

**前端（新增 `features/liang/`）：**
- `web/src/features/liang/types.ts` — `Listing` / `MarketSummary` / `Discovery` / `ListingFilters` / `NeedInput`
- `web/src/features/liang/api.ts` — `fetchListings` / `fetchListing` / `fetchMarketSummary`
- `web/src/features/liang/format.ts` — `fmtInt` / `fmtQuality` / `fmtDate`
- `web/src/features/liang/parseNeed.ts` — `parseNeed`（规则提取采购需求）
- `web/src/features/liang/CandidateContext.tsx` — 候选篮全局状态
- `web/src/features/liang/MarketSummaryBar.tsx` — 概览条
- `web/src/features/liang/MarketDiscovery.tsx` — 市场发现（右栏）
- `web/src/features/liang/FilterPanel.tsx` — 筛选器
- `web/src/features/liang/ListingTable.tsx` — 列表表格
- `web/src/features/liang/ListingDetailDrawer.tsx` — 详情抽屉
- `web/src/features/liang/CandidateBasket.tsx` — 候选篮浮动气泡 + 抽屉
- `web/src/features/liang/NeedInputBar.tsx` — 「我要找粮」输入框
- `web/src/features/liang/LiangPage.tsx` — 页面组装 + tab 切换
- `web/src/pages/agents/AgentServicePage.tsx` — 加 `liang` 分支

---

## Task 1: GrainListing 数据模型

**Files:**
- Create: `backend/app/liang/__init__.py`
- Create: `backend/app/liang/models.py`

- [ ] **Step 1: 写模型**

```python
# backend/app/liang/__init__.py
```

```python
# backend/app/liang/models.py
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GrainListing(Base):
    """粮源挂牌：某供应方在某产地挂牌的一批粮食。"""

    __tablename__ = "grain_listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    listing_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    variety_code: Mapped[str] = mapped_column(String(32), index=True)
    variety_name: Mapped[str] = mapped_column(String(32))
    crop_year: Mapped[int] = mapped_column(Integer)
    origin_province: Mapped[str] = mapped_column(String(64), index=True)
    origin_city: Mapped[str] = mapped_column(String(64))
    grade: Mapped[str] = mapped_column(String(16))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_type: Mapped[str] = mapped_column(String(16))  # 出厂价 / 到库价 / 港口价
    available_quantity_tons: Mapped[int] = mapped_column(Integer)
    delivery_type: Mapped[str] = mapped_column(String(16))  # 散粮 / 集装箱 / 车板
    earliest_ship_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    latest_ship_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    moisture_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    test_weight_g_l: Mapped[Decimal | None] = mapped_column(Numeric(5, 0), nullable=True)
    impurity_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    supplier_name: Mapped[str] = mapped_column(String(64))
    supplier_region: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 2: 验证模型可导入**

Run: `cd backend && python -c "from app.liang.models import GrainListing; print(GrainListing.__tablename__)"`
Expected: 输出 `grain_listings`

- [ ] **Step 3: Commit（跳过，项目禁止自动提交）**

---

## Task 2: 固定粮源种子（12 条，幂等）

**Files:**
- Create: `backend/app/liang/mock_seed.py`
- Test: `backend/tests/liang/__init__.py`（空文件）

- [ ] **Step 1: 写种子文件**

```python
# backend/app/liang/mock_seed.py
"""liang-v1 固定粮源数据集：覆盖主推、备选、低价等级不符、数量不足、字段缺失等场景。"""
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.liang.models import GrainListing

PRICE_DATE = date(2026, 8, 23)

# (listing_code, variety_code, variety_name, crop_year, origin_province, origin_city,
#  grade, price, price_type, available_quantity_tons, delivery_type,
#  earliest_ship_at, latest_ship_at, moisture_pct, test_weight_g_l, impurity_pct,
#  supplier_name, supplier_region)
LISTINGS = [
    ("LIANG-V1-001", "corn", "玉米", 2025, "黑龙江", "绥化", "二等", "2380", "出厂价",
     800, "散粮", date(2026, 8, 25), date(2026, 8, 28), "14.0", "686", "1.0",
     "北安粮贸", "黑龙江绥化"),
    ("LIANG-V1-002", "corn", "玉米", 2025, "吉林", "榆树", "二等", "2420", "出厂价",
     600, "散粮", date(2026, 8, 26), date(2026, 8, 30), "14.2", "685", "1.0",
     "榆树粮贸", "吉林榆树"),
    ("LIANG-V1-003", "corn", "玉米", 2025, "辽宁", "铁岭", "三等", "2280", "出厂价",
     900, "散粮", date(2026, 8, 24), date(2026, 8, 27), "14.5", "660", "1.5",
     "铁岭粮贸", "辽宁铁岭"),
    ("LIANG-V1-004", "corn", "玉米", 2025, "内蒙古", "通辽", "二等", "2350", "出厂价",
     100, "散粮", date(2026, 8, 25), date(2026, 8, 29), "14.0", "686", "1.0",
     "通辽粮贸", "内蒙古通辽"),
    ("LIANG-V1-005", "corn", "玉米", 2025, "吉林", "松原", "二等", "2390", "出厂价",
     500, "散粮", None, None, "14.1", "685", "1.0",
     "松原农贸", "吉林松原"),
    ("LIANG-V1-006", "corn", "玉米", 2024, "吉林", "四平", "二等", "2320", "出厂价",
     700, "散粮", date(2026, 8, 25), date(2026, 8, 28), "13.8", "688", "0.9",
     "四平粮贸", "吉林四平"),
    ("LIANG-V1-007", "corn", "玉米", 2025, "辽宁", "锦州港", "二等", "2480", "港口价",
     1500, "集装箱", date(2026, 8, 24), date(2026, 8, 26), "14.0", "687", "1.0",
     "锦州港粮贸", "辽宁锦州"),
    ("LIANG-V1-008", "corn", "玉米", 2025, "辽宁", "大连港", "二等", "2500", "港口价",
     1000, "散粮", date(2026, 8, 26), date(2026, 8, 30), "14.0", "686", "1.0",
     "大连港粮贸", "辽宁大连"),
    ("LIANG-V1-009", "wheat", "小麦", 2025, "河南", "新乡", "二等", "2490", "出厂价",
     600, "散粮", date(2026, 8, 27), date(2026, 9, 2), "12.5", "790", "0.8",
     "新乡面业", "河南新乡"),
    ("LIANG-V1-010", "wheat", "小麦", 2025, "山东", "德州", "一等", "2620", "到库价",
     400, "散粮", date(2026, 8, 26), date(2026, 8, 31), "12.8", "795", "0.7",
     "德州粮贸", "山东德州"),
    ("LIANG-V1-011", "soybean", "大豆", 2025, "黑龙江", "哈尔滨", "二等", "3980", "出厂价",
     300, "散粮", date(2026, 8, 28), date(2026, 9, 5), "12.0", None, "1.0",
     "哈尔滨粮贸", "黑龙江哈尔滨"),
    ("LIANG-V1-012", "soybean", "大豆", 2025, "黑龙江", "佳木斯", "三等", "3860", "出厂价",
     500, "散粮", date(2026, 8, 27), date(2026, 9, 3), "12.5", None, "1.2",
     "佳木斯粮贸", "黑龙江佳木斯"),
]


def seed_liang_mock_data(db: Session) -> None:
    """幂等写入 liang-v1 粮源，已存在的 listing_code 跳过。"""
    for row in LISTINGS:
        (
            code, vcode, vname, year, prov, city, grade, price, ptype, qty, dtype,
            early, late, moisture, tw, impurity, supplier, sregion,
        ) = row
        exists = db.query(GrainListing.listing_code).filter_by(listing_code=code).first()
        if exists:
            continue
        db.add(
            GrainListing(
                listing_code=code,
                variety_code=vcode,
                variety_name=vname,
                crop_year=year,
                origin_province=prov,
                origin_city=city,
                grade=grade,
                price=Decimal(price),
                price_type=ptype,
                available_quantity_tons=qty,
                delivery_type=dtype,
                earliest_ship_at=early,
                latest_ship_at=late,
                moisture_pct=Decimal(moisture) if moisture else None,
                test_weight_g_l=Decimal(tw) if tw else None,
                impurity_pct=Decimal(impurity) if impurity else None,
                supplier_name=supplier,
                supplier_region=sregion,
            )
        )
    db.commit()
```

- [ ] **Step 2: 写幂等测试**

```python
# backend/tests/liang/test_seed.py
from app.liang.mock_seed import seed_liang_mock_data
from app.liang.models import GrainListing


def test_seed_is_idempotent(db_session):
    seed_liang_mock_data(db_session)
    seed_liang_mock_data(db_session)
    count = db_session.query(GrainListing).count()
    assert count == 12


def test_seed_covers_demo_scenarios(db_session):
    seed_liang_mock_data(db_session)
    codes = {l.listing_code for l in db_session.query(GrainListing).all()}
    assert "LIANG-V1-001" in codes  # 主推
    assert "LIANG-V1-002" in codes  # 备选
    assert "LIANG-V1-003" in codes  # 低价但等级不符
    assert "LIANG-V1-004" in codes  # 数量不足
    assert "LIANG-V1-005" in codes  # 字段缺失（无发运窗口）
    assert "LIANG-V1-009" in codes  # 小麦
    assert "LIANG-V1-011" in codes  # 大豆
```

- [ ] **Step 3: 跑测试验证通过**

Run: `cd backend && python -m pytest tests/liang/test_seed.py -v`
Expected: 2 passed

- [ ] **Step 4: Commit（跳过）**

---

## Task 3: repository 查询

**Files:**
- Create: `backend/app/liang/repository.py`
- Test: `backend/tests/liang/test_repository.py`

- [ ] **Step 1: 写 repository**

```python
# backend/app/liang/repository.py
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.liang.models import GrainListing


def list_listings(db: Session, filters: dict | None = None) -> list[GrainListing]:
    """按筛选条件返回粮源，保持 seed 顺序（id 升序）。"""
    stmt = select(GrainListing).order_by(GrainListing.id)
    if filters:
        if filters.get("variety_name"):
            stmt = stmt.where(GrainListing.variety_name == filters["variety_name"])
        if filters.get("origin_province"):
            stmt = stmt.where(GrainListing.origin_province == filters["origin_province"])
        if filters.get("grade"):
            stmt = stmt.where(GrainListing.grade == filters["grade"])
        if filters.get("crop_year"):
            stmt = stmt.where(GrainListing.crop_year == filters["crop_year"])
        if filters.get("price_type"):
            stmt = stmt.where(GrainListing.price_type == filters["price_type"])
        if filters.get("delivery_type"):
            stmt = stmt.where(GrainListing.delivery_type == filters["delivery_type"])
        if filters.get("min_price") is not None:
            stmt = stmt.where(GrainListing.price >= filters["min_price"])
        if filters.get("max_price") is not None:
            stmt = stmt.where(GrainListing.price <= filters["max_price"])
        if filters.get("min_quantity") is not None:
            stmt = stmt.where(
                GrainListing.available_quantity_tons >= filters["min_quantity"]
            )
    return db.scalars(stmt).all()


def get_listing(db: Session, listing_id: int) -> GrainListing | None:
    return db.get(GrainListing, listing_id)
```

- [ ] **Step 2: 写 repository 测试**

```python
# backend/tests/liang/test_repository.py
from app.liang.mock_seed import seed_liang_mock_data
from app.liang import repository


def test_list_all(db_session):
    seed_liang_mock_data(db_session)
    result = repository.list_listings(db_session)
    assert len(result) == 12


def test_list_by_variety(db_session):
    seed_liang_mock_data(db_session)
    result = repository.list_listings(db_session, {"variety_name": "玉米"})
    assert len(result) == 8
    assert all(l.variety_name == "玉米" for l in result)


def test_list_by_price_range(db_session):
    seed_liang_mock_data(db_session)
    result = repository.list_listings(db_session, {"min_price": 2300, "max_price": 2400})
    assert result
    assert all(2300 <= float(l.price) <= 2400 for l in result)


def test_get_listing_found_and_missing(db_session):
    seed_liang_mock_data(db_session)
    first = repository.list_listings(db_session)[0]
    assert repository.get_listing(db_session, first.id) is not None
    assert repository.get_listing(db_session, 99999) is None
```

- [ ] **Step 3: 跑测试验证通过**

Run: `cd backend && python -m pytest tests/liang/test_repository.py -v`
Expected: 4 passed

- [ ] **Step 4: Commit（跳过）**

---

## Task 4: 市场概览与市场发现（确定性聚合）

**Files:**
- Create: `backend/app/liang/metrics.py`
- Test: `backend/tests/liang/test_metrics.py`

- [ ] **Step 1: 写 metrics**

```python
# backend/app/liang/metrics.py
"""市场概览与市场发现：基于固定数据集的确定性聚合，不做个性化推荐。"""
from collections import Counter

from app.liang.models import GrainListing


def build_summary(listings: list[GrainListing]) -> dict:
    """概览条：在架数、挂牌总量、主要品种、按口径报价区间、覆盖产区。"""
    total_quantity = sum(l.available_quantity_tons for l in listings)
    varieties = list(dict.fromkeys(l.variety_name for l in listings))
    provinces = sorted({l.origin_province for l in listings})

    ranges: dict[str, list[float]] = {}
    for l in listings:
        ranges.setdefault(l.price_type, []).append(float(l.price))
    price_ranges = [
        {"price_type": pt, "low": f"{min(ps):.0f}", "high": f"{max(ps):.0f}"}
        for pt, ps in ranges.items()
    ]

    return {
        "total_listings": len(listings),
        "total_quantity_tons": total_quantity,
        "varieties": varieties,
        "price_ranges": price_ranges,
        "province_count": len(provinces),
    }


def build_discoveries(listings: list[GrainListing]) -> list[dict]:
    """市场发现：确定性摘要，每条带可点击联动筛选的 filter。"""
    discoveries: list[dict] = []

    # 品种供应排行
    variety_counter = Counter(l.variety_name for l in listings)
    top_variety = variety_counter.most_common(1)[0][0]
    discoveries.append(
        {
            "id": "top-variety",
            "title": f"{top_variety}供应最多",
            "detail": f"在架 {variety_counter[top_variety]} 笔{top_variety}，占全部粮源的多数。",
            "filter": {"key": "variety_name", "value": top_variety},
        }
    )

    # 产区集中度
    province_counter = Counter(l.origin_province for l in listings)
    top_province = province_counter.most_common(1)[0][0]
    discoveries.append(
        {
            "id": "top-province",
            "title": f"{top_province}产区最集中",
            "detail": f"{top_province}在架 {province_counter[top_province]} 笔，是当前粮源最集中的产区。",
            "filter": {"key": "origin_province", "value": top_province},
        }
    )

    # 字段缺失
    missing = [
        l for l in listings
        if l.earliest_ship_at is None
        or l.latest_ship_at is None
        or l.test_weight_g_l is None
    ]
    if missing:
        discoveries.append(
            {
                "id": "missing-field",
                "title": f"{len(missing)} 笔缺关键信息",
                "detail": "部分粮源缺少发运窗口或质检指标，下单前需重点核验。",
                "filter": None,
            }
        )

    # 同口径价格区间（取供应最多的口径）
    price_counter = Counter(l.price_type for l in listings)
    top_type = price_counter.most_common(1)[0][0]
    same_type = [float(l.price) for l in listings if l.price_type == top_type]
    discoveries.append(
        {
            "id": "price-range",
            "title": f"{top_type}区间 {min(same_type):.0f}~{max(same_type):.0f} 元/吨",
            "detail": f"同为{top_type}时价格跨度 {max(same_type) - min(same_type):.0f} 元/吨，比较前先对齐口径。",
            "filter": {"key": "price_type", "value": top_type},
        }
    )

    return discoveries
```

- [ ] **Step 2: 写 metrics 测试**

```python
# backend/tests/liang/test_metrics.py
from app.liang.mock_seed import seed_liang_mock_data
from app.liang import metrics, repository


def test_summary_aggregates(db_session):
    seed_liang_mock_data(db_session)
    listings = repository.list_listings(db_session)
    summary = metrics.build_summary(listings)
    assert summary["total_listings"] == 12
    assert summary["total_quantity_tons"] == 7900
    assert "玉米" in summary["varieties"]
    assert summary["province_count"] >= 5
    assert any(r["price_type"] == "出厂价" for r in summary["price_ranges"])


def test_discoveries_are_deterministic(db_session):
    seed_liang_mock_data(db_session)
    listings = repository.list_listings(db_session)
    d1 = metrics.build_discoveries(listings)
    d2 = metrics.build_discoveries(listings)
    assert [x["id"] for x in d1] == [x["id"] for x in d2]
    assert d1[0]["title"] == "玉米供应最多"
    assert d1[0]["filter"] == {"key": "variety_name", "value": "玉米"}
```

- [ ] **Step 3: 跑测试验证通过**

Run: `cd backend && python -m pytest tests/liang/test_metrics.py -v`
Expected: 2 passed

- [ ] **Step 4: Commit（跳过）**

---

## Task 5: 路由（三个只读接口）

**Files:**
- Create: `backend/app/liang/routes.py`
- Test: `backend/tests/liang/test_routes.py`

- [ ] **Step 1: 写 routes**

```python
# backend/app/liang/routes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.liang import metrics, repository

router = APIRouter(prefix="/api/liang", tags=["liang"])


def _serialize(l):
    return {
        "id": l.id,
        "listing_code": l.listing_code,
        "variety_code": l.variety_code,
        "variety_name": l.variety_name,
        "crop_year": l.crop_year,
        "origin_province": l.origin_province,
        "origin_city": l.origin_city,
        "grade": l.grade,
        "price": str(l.price),
        "price_type": l.price_type,
        "available_quantity_tons": l.available_quantity_tons,
        "delivery_type": l.delivery_type,
        "earliest_ship_at": l.earliest_ship_at.isoformat() if l.earliest_ship_at else None,
        "latest_ship_at": l.latest_ship_at.isoformat() if l.latest_ship_at else None,
        "moisture_pct": str(l.moisture_pct) if l.moisture_pct is not None else None,
        "test_weight_g_l": str(l.test_weight_g_l) if l.test_weight_g_l is not None else None,
        "impurity_pct": str(l.impurity_pct) if l.impurity_pct is not None else None,
        "supplier_name": l.supplier_name,
        "supplier_region": l.supplier_region,
    }


@router.get("/listings")
def get_listings(
    variety_name: str | None = None,
    origin_province: str | None = None,
    grade: str | None = None,
    crop_year: int | None = None,
    price_type: str | None = None,
    delivery_type: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_quantity: int | None = None,
    db: Session = Depends(get_db),
):
    """粮源列表，支持筛选。"""
    filters = {
        "variety_name": variety_name,
        "origin_province": origin_province,
        "grade": grade,
        "crop_year": crop_year,
        "price_type": price_type,
        "delivery_type": delivery_type,
        "min_price": min_price,
        "max_price": max_price,
        "min_quantity": min_quantity,
    }
    listings = repository.list_listings(db, filters)
    return {"items": [_serialize(l) for l in listings]}


@router.get("/listings/{listing_id}")
def get_listing(listing_id: int, db: Session = Depends(get_db)):
    """粮源详情。"""
    listing = repository.get_listing(db, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="粮源不存在")
    return _serialize(listing)


@router.get("/market/summary")
def get_market_summary(db: Session = Depends(get_db)):
    """概览条 + 市场发现。"""
    listings = repository.list_listings(db)
    return {
        "summary": metrics.build_summary(listings),
        "discoveries": metrics.build_discoveries(listings),
    }
```

- [ ] **Step 2: 写 routes 测试**

```python
# backend/tests/liang/test_routes.py
from app.liang.mock_seed import seed_liang_mock_data


def test_listings_ok(client, db_session):
    seed_liang_mock_data(db_session)
    resp = client.get("/api/liang/listings")
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 12


def test_listings_filter(client, db_session):
    seed_liang_mock_data(db_session)
    resp = client.get("/api/liang/listings?variety_name=玉米")
    assert resp.status_code == 200
    assert all(i["variety_name"] == "玉米" for i in resp.json()["items"])


def test_listing_detail_and_404(client, db_session):
    seed_liang_mock_data(db_session)
    resp = client.get("/api/liang/listings/1")
    assert resp.status_code == 200
    assert resp.json()["listing_code"] == "LIANG-V1-001"
    assert client.get("/api/liang/listings/99999").status_code == 404


def test_market_summary(client, db_session):
    seed_liang_mock_data(db_session)
    resp = client.get("/api/liang/market/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["summary"]["total_listings"] == 12
    assert len(body["discoveries"]) >= 3
```

- [ ] **Step 3: 跑测试验证通过**

Run: `cd backend && python -m pytest tests/liang/test_routes.py -v`
Expected: 4 passed

- [ ] **Step 4: Commit（跳过）**

---

## Task 6: 注册到应用并整体验证

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: 修改 main.py**

在 `backend/app/main.py` 顶部 import 区加入：

```python
from app.liang import models  # noqa: F401  注册表
from app.liang.mock_seed import seed_liang_mock_data
from app.liang.routes import router as liang_router
```

在 `lifespan` 的 `try` 块内，`seed_zhan_mock_data(db)` 之后加：

```python
            seed_liang_mock_data(db)
```

在文件末尾路由注册区加入：

```python
app.include_router(liang_router)
```

- [ ] **Step 2: 跑全部 liang 测试**

Run: `cd backend && python -m pytest tests/liang -v`
Expected: 全部通过（4 个测试文件，12 条用例）

- [ ] **Step 3: 跑全量后端测试确认无回归**

Run: `cd backend && python -m pytest -q`
Expected: 全部通过，无失败

- [ ] **Step 4: Commit（跳过）**

---

## Task 7: 前端类型与 API 封装

**Files:**
- Create: `web/src/features/liang/types.ts`
- Create: `web/src/features/liang/api.ts`

- [ ] **Step 1: 写 types.ts**

```typescript
// web/src/features/liang/types.ts
export interface Listing {
  id: number;
  listing_code: string;
  variety_code: string;
  variety_name: string;
  crop_year: number;
  origin_province: string;
  origin_city: string;
  grade: string;
  price: string;
  price_type: string;
  available_quantity_tons: number;
  delivery_type: string;
  earliest_ship_at: string | null;
  latest_ship_at: string | null;
  moisture_pct: string | null;
  test_weight_g_l: string | null;
  impurity_pct: string | null;
  supplier_name: string;
  supplier_region: string;
}

export interface PriceRange {
  price_type: string;
  low: string;
  high: string;
}

export interface MarketSummary {
  total_listings: number;
  total_quantity_tons: number;
  varieties: string[];
  price_ranges: PriceRange[];
  province_count: number;
}

export interface Discovery {
  id: string;
  title: string;
  detail: string;
  filter: { key: string; value: string } | null;
}

export interface MarketSummaryResponse {
  summary: MarketSummary;
  discoveries: Discovery[];
}

export interface ListingFilters {
  variety_name?: string;
  origin_province?: string;
  grade?: string;
  crop_year?: number;
  price_type?: string;
  delivery_type?: string;
  min_price?: number;
  max_price?: number;
  min_quantity?: number;
}

export interface NeedInput {
  variety?: string;
  quantity_tons?: number;
  grade?: string;
  deadline_days?: number;
  budget_price?: number;
}
```

- [ ] **Step 2: 写 api.ts**

```typescript
// web/src/features/liang/api.ts
import type { Listing, ListingFilters, MarketSummaryResponse } from "./types";

export async function fetchListings(
  filters: ListingFilters = {},
): Promise<Listing[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  const resp = await fetch(`/api/liang/listings${qs ? `?${qs}` : ""}`);
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  const data = await resp.json();
  return data.items as Listing[];
}

export async function fetchListing(id: number): Promise<Listing> {
  const resp = await fetch(`/api/liang/listings/${id}`);
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function fetchMarketSummary(): Promise<MarketSummaryResponse> {
  const resp = await fetch("/api/liang/market/summary");
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}
```

- [ ] **Step 3: 类型检查**

Run: `cd web && npm run build`
Expected: 无类型错误（此时这些文件尚未被引用，`tsc` 仍会编译 `src` 下全部文件）

- [ ] **Step 4: Commit（跳过）**

---

## Task 8: 格式化与需求解析工具

**Files:**
- Create: `web/src/features/liang/format.ts`
- Create: `web/src/features/liang/parseNeed.ts`

- [ ] **Step 1: 写 format.ts**

```typescript
// web/src/features/liang/format.ts
export function fmtInt(v: string | number): string {
  return Number(v).toLocaleString("zh-CN");
}

/** 质检/日期等可空字段：空则显示 -- */
export function fmtQuality(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "--";
  return v;
}

/** ISO 日期 → MM-DD */
export function fmtDate(v: string | null | undefined): string {
  if (!v) return "--";
  return v.slice(5);
}
```

- [ ] **Step 2: 写 parseNeed.ts**

```typescript
// web/src/features/liang/parseNeed.ts
import type { NeedInput } from "./types";

const VARIETY_KEYWORDS: [string, string][] = [
  ["玉米", "玉米"],
  ["小麦", "小麦"],
  ["大豆", "大豆"],
  ["稻谷", "稻谷"],
];

/** 从自然语言中确定性提取采购需求字段，可复现、不接 LLM。 */
export function parseNeed(text: string): NeedInput {
  const need: NeedInput = {};
  const qty = text.match(/(\d+(?:\.\d+)?)\s*(?:吨|t|T)/);
  if (qty) need.quantity_tons = Number(qty[1]);
  const grade = text.match(/(一等|二等|三等|四等)/);
  if (grade) need.grade = grade[1];
  for (const [kw, name] of VARIETY_KEYWORDS) {
    if (text.includes(kw)) {
      need.variety = name;
      break;
    }
  }
  const days = text.match(/(\d+)\s*天/);
  if (days) need.deadline_days = Number(days[1]);
  const price = text.match(/(\d+(?:\.\d+)?)\s*元/);
  if (price) need.budget_price = Number(price[1]);
  return need;
}
```

- [ ] **Step 3: 类型检查**

Run: `cd web && npm run build`
Expected: 无类型错误

- [ ] **Step 4: Commit（跳过）**

---

## Task 9: 候选篮全局状态（Context）

**Files:**
- Create: `web/src/features/liang/CandidateContext.tsx`

- [ ] **Step 1: 写 CandidateContext**

```tsx
// web/src/features/liang/CandidateContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Listing } from "./types";

interface CandidateState {
  candidates: Listing[];
  add: (listing: Listing) => void;
  remove: (id: number) => void;
  has: (id: number) => boolean;
  clear: () => void;
}

const CandidateContext = createContext<CandidateState | null>(null);

export function CandidateProvider({ children }: { children: ReactNode }) {
  const [candidates, setCandidates] = useState<Listing[]>([]);

  const add = useCallback((listing: Listing) => {
    setCandidates((prev) =>
      prev.some((c) => c.id === listing.id) ? prev : [...prev, listing],
    );
  }, []);

  const remove = useCallback((id: number) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const has = useCallback(
    (id: number) => candidates.some((c) => c.id === id),
    [candidates],
  );

  const clear = useCallback(() => setCandidates([]), []);

  const value = useMemo(
    () => ({ candidates, add, remove, has, clear }),
    [candidates, add, remove, has, clear],
  );

  return (
    <CandidateContext.Provider value={value}>{children}</CandidateContext.Provider>
  );
}

export function useCandidates(): CandidateState {
  const ctx = useContext(CandidateContext);
  if (!ctx) throw new Error("useCandidates 必须在 CandidateProvider 内使用");
  return ctx;
}
```

- [ ] **Step 2: 类型检查**

Run: `cd web && npm run build`
Expected: 无类型错误

- [ ] **Step 3: Commit（跳过）**

---

## Task 10: 概览条 + 市场发现（右栏）

**Files:**
- Create: `web/src/features/liang/MarketSummaryBar.tsx`
- Create: `web/src/features/liang/MarketDiscovery.tsx`

- [ ] **Step 1: 写 MarketSummaryBar**

```tsx
// web/src/features/liang/MarketSummaryBar.tsx
import type { MarketSummary } from "./types";
import { fmtInt } from "./format";

export default function MarketSummaryBar({ summary }: { summary: MarketSummary }) {
  const cells = [
    { label: "在架粮源", value: fmtInt(summary.total_listings), unit: "笔" },
    {
      label: "挂牌总量",
      value: fmtInt(summary.total_quantity_tons),
      unit: "吨",
    },
    { label: "主要品种", value: summary.varieties.join(" · "), unit: "" },
    {
      label: "报价区间",
      value: summary.price_ranges
        .map((r) => `${r.price_type} ${fmtInt(r.low)}~${fmtInt(r.high)}`)
        .join("  "),
      unit: "元/吨",
    },
    { label: "覆盖产区", value: fmtInt(summary.province_count), unit: "个省区" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {cells.map((c) => (
        <div key={c.label} className="rounded-xl border border-line bg-panel px-4 py-3">
          <div className="text-[11px] text-ink-soft">{c.label}</div>
          <div className="mt-1 truncate text-base font-semibold tabular-nums text-ink">
            {c.value}
            {c.unit && (
              <span className="ml-1 text-[11px] font-normal text-ink-soft">{c.unit}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 写 MarketDiscovery**

```tsx
// web/src/features/liang/MarketDiscovery.tsx
import type { Discovery } from "./types";

export default function MarketDiscovery({
  discoveries,
  onApply,
}: {
  discoveries: Discovery[];
  onApply: (key: string, value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold">粮小二市场发现</span>
      </div>
      <ul className="space-y-2.5">
        {discoveries.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              disabled={!d.filter}
              onClick={() => d.filter && onApply(d.filter.key, d.filter.value)}
              className={`w-full rounded-xl border border-line bg-rice px-3.5 py-2.5 text-left transition-colors ${
                d.filter ? "hover:border-tech" : "cursor-default"
              }`}
            >
              <div className="text-sm font-medium text-ink">{d.title}</div>
              <div className="mt-0.5 text-xs leading-5 text-ink-soft">{d.detail}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: 类型检查**

Run: `cd web && npm run build`
Expected: 无类型错误

- [ ] **Step 4: Commit（跳过）**

---

## Task 11: 筛选器 + 列表表格 + 详情抽屉

**Files:**
- Create: `web/src/features/liang/FilterPanel.tsx`
- Create: `web/src/features/liang/ListingTable.tsx`
- Create: `web/src/features/liang/ListingDetailDrawer.tsx`

- [ ] **Step 1: 写 FilterPanel**

```tsx
// web/src/features/liang/FilterPanel.tsx
import type { ListingFilters } from "./types";

const VARIETIES = ["玉米", "小麦", "大豆", "稻谷"];
const GRADES = ["一等", "二等", "三等"];
const PRICE_TYPES = ["出厂价", "到库价", "港口价"];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-ink-soft">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-rice px-2.5 py-2 text-sm text-ink"
      >
        <option value="">全部</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function FilterPanel({
  filters,
  onChange,
  onReset,
}: {
  filters: ListingFilters;
  onChange: (f: ListingFilters) => void;
  onReset: () => void;
}) {
  const set = (patch: Partial<ListingFilters>) => onChange({ ...filters, ...patch });
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">筛选</span>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-ink-soft hover:text-ink"
        >
          清空
        </button>
      </div>
      <div className="space-y-3">
        <Select label="品种" value={filters.variety_name ?? ""} options={VARIETIES}
          onChange={(v) => set({ variety_name: v || undefined })} />
        <Select label="等级" value={filters.grade ?? ""} options={GRADES}
          onChange={(v) => set({ grade: v || undefined })} />
        <Select label="价格口径" value={filters.price_type ?? ""} options={PRICE_TYPES}
          onChange={(v) => set({ price_type: v || undefined })} />
        <label className="block">
          <span className="text-[11px] text-ink-soft">价格上限（元/吨）</span>
          <input
            type="number"
            value={filters.max_price ?? ""}
            onChange={(e) =>
              set({ max_price: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="不设上限"
            className="mt-1 w-full rounded-lg border border-line bg-rice px-2.5 py-2 text-sm text-ink"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-ink-soft">最低可用量（吨）</span>
          <input
            type="number"
            value={filters.min_quantity ?? ""}
            onChange={(e) =>
              set({ min_quantity: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="不限"
            className="mt-1 w-full rounded-lg border border-line bg-rice px-2.5 py-2 text-sm text-ink"
          />
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 写 ListingTable**

```tsx
// web/src/features/liang/ListingTable.tsx
import type { Listing } from "./types";
import { fmtInt, fmtQuality, fmtDate } from "./format";
import { useCandidates } from "./CandidateContext";

function QualityCell({ listing }: { listing: Listing }) {
  const parts = [
    listing.moisture_pct ? `水分${fmtQuality(listing.moisture_pct)}%` : null,
    listing.test_weight_g_l ? `容重${fmtQuality(listing.test_weight_g_l)}` : null,
  ].filter(Boolean);
  return <span className="text-xs text-ink-soft">{parts.length ? parts.join(" · ") : "--"}</span>;
}

export default function ListingTable({
  listings,
  onDetail,
  onAnalyze,
}: {
  listings: Listing[];
  onDetail: (l: Listing) => void;
  onAnalyze: (l: Listing) => void;
}) {
  const { add, remove, has } = useCandidates();
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-soft">
            <th className="px-4 py-3 font-normal">品种·等级·年份</th>
            <th className="px-4 py-3 font-normal">产地</th>
            <th className="px-4 py-3 font-normal">供应方</th>
            <th className="px-4 py-3 font-normal">报价（口径）</th>
            <th className="px-4 py-3 font-normal">可用量</th>
            <th className="px-4 py-3 font-normal">交收</th>
            <th className="px-4 py-3 font-normal">最晚可发</th>
            <th className="px-4 py-3 font-normal">质检</th>
            <th className="px-4 py-3 font-normal">操作</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => {
            const added = has(l.id);
            return (
              <tr key={l.id} className="border-b border-line/60 last:border-0 hover:bg-rice-deep/40">
                <td className="px-4 py-3 font-medium text-ink">
                  {l.variety_name}·{l.grade}·{l.crop_year}
                </td>
                <td className="px-4 py-3 text-ink">
                  {l.origin_province} {l.origin_city}
                </td>
                <td className="px-4 py-3 text-ink">{l.supplier_name}</td>
                <td className="px-4 py-3 tabular-nums text-ink">
                  {fmtInt(l.price)}
                  <span className="ml-1 text-xs text-ink-soft">{l.price_type}</span>
                </td>
                <td className="px-4 py-3 tabular-nums text-ink">
                  {fmtInt(l.available_quantity_tons)}吨
                </td>
                <td className="px-4 py-3 text-ink">{l.delivery_type}</td>
                <td className="px-4 py-3 text-ink">{fmtDate(l.latest_ship_at)}</td>
                <td className="px-4 py-3">
                  <QualityCell listing={l} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => (added ? remove(l.id) : add(l))}
                      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                        added
                          ? "bg-tech font-medium text-rice"
                          : "border border-line text-ink-soft hover:border-tech hover:text-ink"
                      }`}
                    >
                      {added ? "已加入" : "+ 候选"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAnalyze(l)}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft hover:border-tech hover:text-ink"
                    >
                      分析
                    </button>
                    <button
                      type="button"
                      onClick={() => onDetail(l)}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft hover:border-tech hover:text-ink"
                    >
                      详情
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: 写 ListingDetailDrawer**

```tsx
// web/src/features/liang/ListingDetailDrawer.tsx
import type { Listing } from "./types";
import { fmtInt, fmtQuality, fmtDate } from "./format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

export default function ListingDetailDrawer({
  listing,
  onClose,
}: {
  listing: Listing;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {listing.variety_name} · {listing.grade} · {listing.crop_year}
          </h3>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink">
            ✕
          </button>
        </div>
        <div className="rounded-xl border border-line bg-rice p-4">
          <div className="text-[11px] text-ink-soft">报价</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-tech">
            {fmtInt(listing.price)}
            <span className="ml-1 text-xs font-normal text-ink-soft">
              元/吨 · {listing.price_type}
            </span>
          </div>
        </div>
        <div className="mt-4 divide-y divide-line/60 rounded-xl border border-line px-4">
          <Row label="标的号" value={listing.listing_code} />
          <Row label="供应方" value={listing.supplier_name} />
          <Row label="供应方地区" value={listing.supplier_region} />
          <Row label="产地" value={`${listing.origin_province} ${listing.origin_city}`} />
          <Row label="可用量" value={`${fmtInt(listing.available_quantity_tons)} 吨`} />
          <Row label="交收方式" value={listing.delivery_type} />
          <Row label="发运窗口" value={`${fmtDate(listing.earliest_ship_at)} ~ ${fmtDate(listing.latest_ship_at)}`} />
          <Row label="水分" value={`${fmtQuality(listing.moisture_pct)}%`} />
          <Row label="容重" value={`${fmtQuality(listing.test_weight_g_l)} g/L`} />
          <Row label="杂质" value={`${fmtQuality(listing.impurity_pct)}%`} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 类型检查**

Run: `cd web && npm run build`
Expected: 无类型错误

- [ ] **Step 5: Commit（跳过）**

---

## Task 12: 候选篮气泡 + 「我要找粮」输入框

**Files:**
- Create: `web/src/features/liang/CandidateBasket.tsx`
- Create: `web/src/features/liang/NeedInputBar.tsx`

- [ ] **Step 1: 写 CandidateBasket**

```tsx
// web/src/features/liang/CandidateBasket.tsx
import { useState } from "react";
import { useCandidates } from "./CandidateContext";
import { fmtInt } from "./format";

export default function CandidateBasket({ onGoCompare }: { onGoCompare: () => void }) {
  const { candidates, remove, clear } = useCandidates();
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="flex h-full w-full max-w-sm flex-col bg-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-base font-semibold">候选篮（{candidates.length}）</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {candidates.length === 0 ? (
                <p className="mt-8 text-center text-sm text-ink-soft">
                  还没有候选，去列表点「+ 候选」收藏粮源
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {candidates.map((c) => (
                    <li key={c.id} className="flex items-center justify-between rounded-xl border border-line bg-rice px-3.5 py-2.5">
                      <div>
                        <div className="text-sm font-medium text-ink">
                          {c.variety_name}·{c.grade} {c.origin_province}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-soft">
                          {c.supplier_name} · {fmtInt(c.price)}元/{c.price_type}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        className="text-xs text-ink-soft hover:text-red-400"
                      >
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2 border-t border-line px-5 py-4">
              <button
                type="button"
                onClick={clear}
                disabled={candidates.length === 0}
                className="h-11 rounded-full border border-line px-5 text-sm text-ink-soft disabled:opacity-40"
              >
                清空
              </button>
              <button
                type="button"
                onClick={onGoCompare}
                disabled={candidates.length === 0}
                className="h-11 flex-1 rounded-full bg-brand text-sm font-medium text-white disabled:opacity-40"
              >
                去对比生成方案
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      >
        🛒 候选篮
        {candidates.length > 0 && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs tabular-nums">
            {candidates.length}
          </span>
        )}
      </button>
    </>
  );
}
```

- [ ] **Step 2: 写 NeedInputBar**

```tsx
// web/src/features/liang/NeedInputBar.tsx
import { useState } from "react";
import { parseNeed } from "./parseNeed";
import type { NeedInput } from "./types";

export default function NeedInputBar({ onSubmit }: { onSubmit: (need: NeedInput, raw: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSubmit(parseNeed(text), text);
        setText("");
      }}
      className="flex items-center gap-3"
    >
      <span className="shrink-0 text-sm font-medium text-ink">我要找粮</span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="描述你的采购需求，如：120吨二等玉米，7天内可发"
        className="h-11 flex-1 rounded-full border border-line bg-rice px-5 text-sm text-ink placeholder:text-ink-soft/70"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="h-11 rounded-full bg-brand px-7 text-sm font-medium text-white disabled:opacity-50"
      >
        发送
      </button>
    </form>
  );
}
```

- [ ] **Step 3: 类型检查**

Run: `cd web && npm run build`
Expected: 无类型错误

- [ ] **Step 4: Commit（跳过）**

---

## Task 13: LiangPage 组装 + 路由注册 + 整体验收

**Files:**
- Create: `web/src/features/liang/LiangPage.tsx`
- Modify: `web/src/pages/agents/AgentServicePage.tsx`

- [ ] **Step 1: 写 LiangPage**

```tsx
// web/src/features/liang/LiangPage.tsx
import { useEffect, useState } from "react";
import AgentSwitcher from "../../components/AgentSwitcher";
import { getAgent } from "../../data/agents";
import { fetchListings, fetchMarketSummary } from "./api";
import { CandidateProvider } from "./CandidateContext";
import MarketSummaryBar from "./MarketSummaryBar";
import MarketDiscovery from "./MarketDiscovery";
import FilterPanel from "./FilterPanel";
import ListingTable from "./ListingTable";
import ListingDetailDrawer from "./ListingDetailDrawer";
import CandidateBasket from "./CandidateBasket";
import NeedInputBar from "./NeedInputBar";
import type {
  Discovery,
  Listing,
  ListingFilters,
  MarketSummary,
  NeedInput,
} from "./types";

const agent = getAgent("liang")!;

export default function LiangPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [filters, setFilters] = useState<ListingFilters>({});
  const [listings, setListings] = useState<Listing[]>([]);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [detail, setDetail] = useState<Listing | null>(null);
  const [pendingNeed, setPendingNeed] = useState<{ need: NeedInput; raw: string } | null>(null);
  const [pendingAnalyze, setPendingAnalyze] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchListings(filters)
      .then((d) => {
        if (!cancelled) setListings(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    fetchMarketSummary()
      .then((d) => {
        if (!cancelled) {
          setSummary(d.summary);
          setDiscoveries(d.discoveries);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const applyDiscovery = (key: string, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const goCompare = () => setActiveTab(1);

  return (
    <CandidateProvider>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col">
        {/* 头部 */}
        <div className="border-b border-line bg-panel">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3.5">
              <img
                src={agent.image}
                alt={agent.name}
                className="h-12 w-auto drop-shadow-[0_0_10px_rgba(201,144,42,0.35)]"
              />
              <div>
                <h1 className="text-lg font-semibold">
                  {agent.name}｜{agent.action}
                  <span className="ml-2.5 rounded-full bg-brand-faint px-2.5 py-0.5 text-xs font-normal text-brand-deep">
                    {agent.role}
                  </span>
                </h1>
              </div>
            </div>
            <AgentSwitcher currentId={agent.id} />
          </div>
          {/* Tab 条 */}
          <div className="mx-auto max-w-[1280px] px-6">
            <div className="flex gap-6">
              {agent.tabs.map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={`relative pb-3 pt-1 text-sm transition-colors ${
                    i === activeTab ? "font-semibold text-brand-deep" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {tab}
                  {i === activeTab && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6">
          {activeTab !== 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
              <img src={agent.image} alt={agent.name} className="h-20 w-auto drop-shadow-[0_0_16px_rgba(201,144,42,0.4)]" />
              <h2 className="mt-4 text-lg font-semibold">
                {pendingAnalyze && activeTab === 1
                  ? `正在分析 ${pendingAnalyze.supplier_name} 的 ${pendingAnalyze.variety_name}`
                  : pendingNeed && activeTab === 1
                    ? `已收到需求：${pendingNeed.raw}`
                    : `「${agent.tabs[activeTab]}」正在建设中`}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
                {activeTab === 1
                  ? "候选对比将在这里展示主推、备选、淘汰原因与待核验清单。"
                  : "本页将提供粮小二的专业服务，功能按设计逐步落地。"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* 我要找粮 */}
              <NeedInputBar
                onSubmit={(need, raw) => {
                  setPendingNeed({ need, raw });
                  setActiveTab(1);
                }}
              />

              {/* 概览条 */}
              {summary && <MarketSummaryBar summary={summary} />}

              {/* 三栏：筛选 | 列表 | 市场发现 */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_260px]">
                <FilterPanel
                  filters={filters}
                  onChange={setFilters}
                  onReset={() => setFilters({})}
                />
                {error ? (
                  <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
                    <p className="text-sm text-red-400">粮源加载失败：{error}</p>
                    <p className="mt-2 text-xs text-ink-soft">请确认后端服务已启动、本地数据库已初始化。</p>
                  </div>
                ) : (
                  <ListingTable
                    listings={listings}
                    onDetail={setDetail}
                    onAnalyze={(l) => {
                      setPendingAnalyze(l);
                      setActiveTab(1);
                    }}
                  />
                )}
                <MarketDiscovery discoveries={discoveries} onApply={applyDiscovery} />
              </div>
            </div>
          )}
        </div>

        {/* 候选篮浮动气泡 */}
        <CandidateBasket onGoCompare={goCompare} />

        {/* 详情抽屉 */}
        {detail && <ListingDetailDrawer listing={detail} onClose={() => setDetail(null)} />}
      </div>
    </CandidateProvider>
  );
}
```

- [ ] **Step 2: 修改 AgentServicePage 注册 liang 分支**

在 `web/src/pages/agents/AgentServicePage.tsx` 顶部 import 区加入：

```tsx
import LiangPage from "../../features/liang/LiangPage";
```

在 `if (agent.id === "zhan") return <ZhanPage />;` 之后加一行：

```tsx
  if (agent.id === "liang") return <LiangPage />;
```

- [ ] **Step 3: 类型检查 + 构建**

Run: `cd web && npm run build`
Expected: `tsc` 无错误，`vite build` 成功

- [ ] **Step 4: 手动验收（启动后端 + 前端）**

Run（后端，需本地 MySQL 已启动）: `cd backend && uvicorn app.main:app --reload --port 8000`
Run（前端，另开终端）: `cd web && npm run dev`

打开 `http://localhost:5173/agent/liang`，逐项核对：

1. 默认展示三栏粮源市场，12 条粮源，无个性化推荐。
2. 概览条数字正确（在架 12、挂牌 7900 吨）。
3. 价格口径清晰（出厂价/港口价/到库价分开标注）。
4. 筛选品种=玉米 → 列表剩 8 条；清空恢复 12 条。
5. 市场发现点击「玉米供应最多」→ 列表联动筛为玉米。
6. 「+ 候选」→ 气泡计数 +1，点开抽屉可移除、清空，「去对比生成方案」跳到候选对比占位。
7. 输入「120吨二等玉米 7天内可发」→ 跳转候选对比，占位显示「已收到需求：…」。
8. 点击「详情」打开抽屉，字段完整、缺字段显示 `--`。
9. 页面任何位置不出现「演示数据」「mock」等字样。

- [ ] **Step 5: Commit（跳过，由用户手动提交）**

---

## Self-Review 记录

- **Spec 覆盖**：第 5 节概览条 → Task 10；第 6 节筛选器 → Task 11；第 7 节列表 + 详情 → Task 11；第 8 节市场发现 → Task 4/10；第 9 节候选篮 → Task 9/12；第 10 节输入框 → Task 8/12；第 11 节数据模型 → Task 1；第 12 节 API → Task 5/7；第 13 节 mock 真实感 → Task 2；第 14 节空状态 → Task 11/13。全部覆盖。
- **类型一致性**：前端 `Listing`/`MarketSummary`/`Discovery`/`ListingFilters`/`NeedInput` 在 Task 7 定义，Task 10–13 引用一致；`useCandidates` 的 `add/remove/has/clear` 在 Task 9 定义，Task 11/12 调用一致；后端 `_serialize` 字段与 `GrainListing` 模型（Task 1）一致。
- **无占位符**：所有步骤均含完整代码与命令。
