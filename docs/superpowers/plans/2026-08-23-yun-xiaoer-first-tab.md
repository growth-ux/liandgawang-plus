# 运小二｜找物流首 tab 与页面整体实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现运小二完整页面：首 tab「找物流」智能受理 + 即时测算，及运输方案、询运对接、运输任务三个后续 tab 的业务闭环。

**Architecture:** 后端新增 `app/logistics/` 模块（SQLAlchemy 模型 + 确定性规则 + FastAPI 路由 + mock seed + LangChain 解释层），前端新增 `web/src/features/yun/` 模块（参照 `features/zhan/` 模式），在 `AgentServicePage` 中挂载。两层计算：即时测算（按方式聚合，轻量）与正式匹配（硬过滤 + 比较选主备选）共用同一份线路段数据。

**Tech Stack:** FastAPI + SQLAlchemy 2.0（Mapped 风格）+ Docker MySQL；测试用 pytest + SQLite 内存库（现有 `tests/conftest.py` 模式）；React 18 + TypeScript + Tailwind 4（暗色科技风）；langchain-openai + Qwen（复用 `app/analysis/llm.py` 模式，无 key 时降级）。

**规格依据:** `docs/superpowers/specs/2026-08-23-yun-xiaoer-first-tab-design.md`

**项目约定:** 禁止自动提交。每个任务末尾是"检查点"（跑测试/构建验证），**不执行 `git commit`**；如需提交，暂停并询问用户。

**后端测试命令统一为:** `cd backend && uv run pytest <路径> -v`
**前端构建验证统一为:** `cd web && npx tsc --noEmit`

---

## 文件结构

**后端新建:**
- `backend/app/logistics/__init__.py` —— 空文件
- `backend/app/logistics/models.py` —— 6 张表：线路段、物流服务、即时测算、运输任务、运输方案、询运单
- `backend/app/logistics/rules.py` —— 即时测算（轻量层）+ 正式匹配（完整层）纯函数
- `backend/app/logistics/repository.py` —— DB 读写封装
- `backend/app/logistics/seed.py` —— 线路段与物流服务的固定 mock 数据
- `backend/app/logistics/routes.py` —— `/api/logistics/*` 接口
- `backend/app/logistics/llm.py` —— 自然语言抽取与解释（Qwen，可降级）
- `backend/tests/logistics/__init__.py`、`test_rules.py`、`test_routes.py`、`test_llm.py`

**后端修改:**
- `backend/app/main.py` —— 注册 logistics 模型与 seed
- `backend/tests/conftest.py` —— 导入 logistics models 注册表

**前端新建:**
- `web/src/features/yun/types.ts`、`api.ts`
- `web/src/features/yun/YunPage.tsx` —— 页面骨架 + tab 切换 + 跨 tab 任务上下文
- `web/src/features/yun/FindLogisticsTab.tsx` —— 首 tab：受理卡 + 测算结果 + 热门线路 + 最近测算
- `web/src/features/yun/PlansTab.tsx` —— 运输方案
- `web/src/features/yun/InquiryTab.tsx` —— 询运对接
- `web/src/features/yun/TasksTab.tsx` —— 运输任务与测算记录

**前端修改:**
- `web/src/pages/agents/AgentServicePage.tsx` —— 挂载 YunPage
- `web/src/data/agents.ts` —— 更新运小二 tabs 为「找物流、运输方案、询运对接、运输任务」

---

### Task 1: 后端模型与 Mock 数据

**Files:**
- Create: `backend/app/logistics/__init__.py`（空文件）
- Create: `backend/app/logistics/models.py`
- Create: `backend/app/logistics/seed.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/logistics/__init__.py`（空）、`backend/tests/logistics/test_routes.py`

- [ ] **Step 1: 写模型文件 `backend/app/logistics/models.py`**

```python
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RouteSegment(Base):
    """物流线路段：起终点间单一运输方式的参考运价与时效区间。"""

    __tablename__ = "logistics_route_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    segment_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    origin: Mapped[str] = mapped_column(String(64), index=True)
    destination: Mapped[str] = mapped_column(String(64), index=True)
    mode: Mapped[str] = mapped_column(String(16))  # road / rail / water
    distance_km: Mapped[int] = mapped_column(Integer)
    price_low: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_high: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    days_low: Mapped[int] = mapped_column(Integer)
    days_high: Mapped[int] = mapped_column(Integer)
    risk_note: Mapped[str] = mapped_column(String(256), default="")
    data_updated_at: Mapped[str] = mapped_column(String(32), default="2026-08-22")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class LogisticsService(Base):
    """物流服务：某线路段上的承运能力（品种适配、吨位、发运窗口）。"""

    __tablename__ = "logistics_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    carrier: Mapped[str] = mapped_column(String(128))
    segment_code: Mapped[str] = mapped_column(String(64), index=True)
    varieties: Mapped[str] = mapped_column(String(128))  # 逗号分隔品种 code
    tonnage_min: Mapped[int] = mapped_column(Integer)
    tonnage_max: Mapped[int] = mapped_column(Integer)
    dispatch_window: Mapped[str] = mapped_column(String(64), default="")
    loading_note: Mapped[str] = mapped_column(String(128), default="")
    performance_note: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class QuickEstimate(Base):
    """即时测算记录：条件快照 + 各方式测算结果（不产生运输任务）。"""

    __tablename__ = "logistics_quick_estimates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    origin: Mapped[str] = mapped_column(String(64))
    destination: Mapped[str] = mapped_column(String(64))
    variety_code: Mapped[str] = mapped_column(String(32))
    variety_name: Mapped[str] = mapped_column(String(32))
    quantity_tons: Mapped[int] = mapped_column(Integer)
    deadline_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    results_json: Mapped[str] = mapped_column(Text)  # JSON 数组
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class TransportTask(Base):
    """运输任务：正式运输需求从创建到询运结束的全过程。"""

    __tablename__ = "logistics_transport_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    origin: Mapped[str] = mapped_column(String(64))
    destination: Mapped[str] = mapped_column(String(64))
    variety_code: Mapped[str] = mapped_column(String(32))
    variety_name: Mapped[str] = mapped_column(String(32))
    quantity_tons: Mapped[int] = mapped_column(Integer)
    deadline_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    allow_split: Mapped[int] = mapped_column(Integer, default=1)  # 1 允许分批
    source_type: Mapped[str] = mapped_column(String(16), default="self")  # self/handover/estimate
    source_ref: Mapped[str] = mapped_column(String(64), default="")
    extra_note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(24), default="working")
    blocked_note: Mapped[str] = mapped_column(String(256), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class TransportPlan(Base):
    """运输方案：主推 / 备选 / 未入选，含路线段组合与推荐或淘汰原因。"""

    __tablename__ = "logistics_transport_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(Integer, index=True)
    plan_type: Mapped[str] = mapped_column(String(16))  # primary / backup / rejected
    title: Mapped[str] = mapped_column(String(128))
    legs_json: Mapped[str] = mapped_column(Text)  # JSON 数组
    price_low: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_high: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    days_low: Mapped[int] = mapped_column(Integer)
    days_high: Mapped[int] = mapped_column(Integer)
    transship_count: Mapped[int] = mapped_column(Integer, default=0)
    risk_note: Mapped[str] = mapped_column(String(256), default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    check_items_json: Mapped[str] = mapped_column(Text, default="[]")  # JSON 数组
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Inquiry(Base):
    """询运单：选定方案生成的标准询运需求与人工反馈。"""

    __tablename__ = "logistics_inquiries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(Integer, index=True)
    plan_id: Mapped[int] = mapped_column(Integer)
    content_json: Mapped[str] = mapped_column(Text)  # JSON 对象，字段可编辑
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft / submitted / feedback
    feedback_json: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 2: 写 seed 文件 `backend/app/logistics/seed.py`**

```python
"""yun-v1 固定物流演示数据集：粮贸主干线路段与承运服务（幂等）。"""

from sqlalchemy.orm import Session

from app.logistics.models import LogisticsService, RouteSegment

MOCK_DATASET_VERSION = "yun-v1"
DATA_UPDATED_AT = "2026-08-22"

# (code, 起点, 终点, 方式, 里程, 价低, 价高, 时效低, 时效高, 风险备注)
SEGMENTS = [
    ("YUN-SEG-HRB-JZ-ROAD", "哈尔滨", "锦州港", "road", 880, 320, 360, 2, 3, "冬季需关注路面结冰"),
    ("YUN-SEG-CC-JZ-ROAD", "长春", "锦州港", "road", 620, 240, 280, 1, 2, ""),
    ("YUN-SEG-BC-JZ-ROAD", "白城", "锦州港", "road", 540, 210, 250, 1, 2, ""),
    ("YUN-SEG-BC-SZ-ROAD", "白城", "深圳港", "road", 3100, 1150, 1280, 3, 4, "整车直发，运价较高"),
    ("YUN-SEG-CC-JZ-RAIL", "长春", "锦州港", "rail", 620, 190, 230, 2, 3, "受车皮计划影响"),
    ("YUN-SEG-BC-SZ-RAIL", "白城", "深圳港", "rail", 3050, 500, 570, 5, 7, "受车皮计划影响"),
    ("YUN-SEG-HRB-SZ-RAIL", "哈尔滨", "深圳港", "rail", 3350, 540, 610, 6, 8, "时效波动较大"),
    ("YUN-SEG-JZ-SZ-WATER", "锦州港", "深圳港", "water", 1450, 95, 120, 6, 9, "受船期与天气影响"),
    ("YUN-SEG-JZ-GZ-WATER", "锦州港", "广州港", "water", 1380, 90, 115, 5, 8, "受船期与天气影响"),
    ("YUN-SEG-BYQ-SZ-WATER", "鲅鱼圈港", "深圳港", "water", 1460, 100, 125, 6, 9, "受船期与天气影响"),
]

# (code, 承运方, 线路段, 品种, 吨位下限, 吨位上限, 发运窗口, 装卸条件, 履约摘要)
SERVICES = [
    ("YUN-SVC-HRB-JZ", "粮达物流东北车队", "YUN-SEG-HRB-JZ-ROAD", "corn,wheat,soybean,rice", 30, 300, "每日发运", "散粮自卸车", "近30天准点率96%"),
    ("YUN-SVC-CC-JZ", "粮达物流辽西车队", "YUN-SEG-CC-JZ-ROAD", "corn,wheat,soybean,rice", 30, 300, "每日发运", "散粮自卸车", "近30天准点率97%"),
    ("YUN-SVC-BC-JZ", "辽吉粮食运输合作社", "YUN-SEG-BC-JZ-ROAD", "corn,wheat", 30, 200, "隔日发运", "散粮自卸车", "近30天准点率94%"),
    ("YUN-SVC-BC-SZ", "粮达物流干线车队", "YUN-SEG-BC-SZ-ROAD", "corn,wheat,soybean,rice", 30, 150, "每周三、五", "散粮/吨包", "近30天准点率98%"),
    ("YUN-SVC-CC-JZ-R", "东北铁路集装箱运输中心", "YUN-SEG-CC-JZ-RAIL", "corn,wheat,soybean,rice", 60, 2000, "每周二、四装车", "集装箱/散粮装车点", "近30天计划兑现率92%"),
    ("YUN-SVC-BC-SZ-R", "东北铁路集装箱运输中心", "YUN-SEG-BC-SZ-RAIL", "corn,wheat", 60, 2000, "每周一、四装车", "集装箱/散粮装车点", "近30天计划兑现率90%"),
    ("YUN-SVC-HRB-SZ-R", "东北铁路集装箱运输中心", "YUN-SEG-HRB-SZ-RAIL", "corn,soybean", 60, 2000, "每周二装车", "集装箱/散粮装车点", "近30天计划兑现率88%"),
    ("YUN-SVC-JZ-SZ-W", "北洋航运内贸线", "YUN-SEG-JZ-SZ-WATER", "corn,wheat,soybean,rice", 500, 30000, "每周一、五班期", "港口散粮装船", "近30天班期准点率91%"),
    ("YUN-SVC-JZ-GZ-W", "北洋航运内贸线", "YUN-SEG-JZ-GZ-WATER", "corn,wheat,soybean,rice", 500, 30000, "每周三、六班期", "港口散粮装船", "近30天班期准点率93%"),
    ("YUN-SVC-BYQ-SZ-W", "北方港航船务", "YUN-SEG-BYQ-SZ-WATER", "corn,wheat", 500, 30000, "每周二、六班期", "港口散粮装船", "近30天班期准点率89%"),
]


def seed_logistics_mock_data(db: Session) -> None:
    if db.query(RouteSegment).count() > 0:
        return
    for code, origin, dest, mode, km, pl, ph, dl, dh, risk in SEGMENTS:
        db.add(RouteSegment(
            segment_code=code, origin=origin, destination=dest, mode=mode,
            distance_km=km, price_low=pl, price_high=ph, days_low=dl, days_high=dh,
            risk_note=risk, data_updated_at=DATA_UPDATED_AT,
        ))
    for code, carrier, seg, varieties, tmin, tmax, window, loading, perf in SERVICES:
        db.add(LogisticsService(
            service_code=code, carrier=carrier, segment_code=seg, varieties=varieties,
            tonnage_min=tmin, tonnage_max=tmax, dispatch_window=window,
            loading_note=loading, performance_note=perf,
        ))
    db.commit()
```

- [ ] **Step 3: 注册到 `backend/app/main.py`**

在 import 区加：

```python
from app.logistics import models as logistics_models  # noqa: F401  注册表
from app.logistics.seed import seed_logistics_mock_data
```

在 lifespan 的 `with SessionLocal() as db:` 块内、`seed_demo_watches(db)` 之后加：

```python
        seed_logistics_mock_data(db)
```

- [ ] **Step 4: `backend/tests/conftest.py` 注册模型表**

在 `import app.workflow.models` 之后加：

```python
import app.logistics.models  # noqa: F401  注册表到 Base.metadata
```

- [ ] **Step 5: 写第一个失败测试 `backend/tests/logistics/__init__.py`（空）与 `backend/tests/logistics/test_routes.py`**

```python
from app.logistics.seed import seed_logistics_mock_data


def test_seed_loads_segments_and_services(db_session):
    from app.logistics.models import LogisticsService, RouteSegment

    seed_logistics_mock_data(db_session)
    assert db_session.query(RouteSegment).count() == 10
    assert db_session.query(LogisticsService).count() == 10


def test_seed_idempotent(db_session):
    from app.logistics.models import RouteSegment

    seed_logistics_mock_data(db_session)
    seed_logistics_mock_data(db_session)
    assert db_session.query(RouteSegment).count() == 10
```

- [ ] **Step 6: 运行测试验证通过**

Run: `cd backend && uv run pytest tests/logistics/test_routes.py -v`
Expected: 2 passed

- [ ] **Step 7: 检查点** —— 测试通过后暂停，请用户确认是否提交。

---

### Task 2: 即时测算规则（轻量层）

**Files:**
- Create: `backend/app/logistics/rules.py`
- Test: `backend/tests/logistics/test_rules.py`

- [ ] **Step 1: 写失败测试 `backend/tests/logistics/test_rules.py`**

```python
from datetime import date
from types import SimpleNamespace

from app.logistics.rules import MODE_NAMES, quick_estimate_modes


def seg(code, origin, dest, mode, pl, ph, dl, dh):
    return SimpleNamespace(
        segment_code=code, origin=origin, destination=dest, mode=mode,
        price_low=pl, price_high=ph, days_low=dl, days_high=dh, risk_note="",
    )


SEGMENTS = [
    seg("BC-JZ-ROAD", "白城", "锦州港", "road", 210, 250, 1, 2),
    seg("BC-SZ-ROAD", "白城", "深圳港", "road", 1150, 1280, 3, 4),
    seg("BC-SZ-RAIL", "白城", "深圳港", "rail", 500, 570, 5, 7),
    seg("JZ-SZ-WATER", "锦州港", "深圳港", "water", 95, 120, 6, 9),
]


def test_direct_modes_returned():
    results = quick_estimate_modes(SEGMENTS, "白城", "深圳港")
    modes = {r["mode"] for r in results}
    assert modes == {"road", "rail", "combined"}


def test_combined_composes_road_and_water():
    results = quick_estimate_modes(SEGMENTS, "白城", "深圳港")
    combined = next(r for r in results if r["mode"] == "combined")
    assert combined["price_low"] == 305  # 210 + 95
    assert combined["price_high"] == 370  # 250 + 120
    assert combined["days_low"] == 7  # 1 + 6
    assert combined["days_high"] == 11  # 2 + 9
    assert combined["transship_count"] == 1
    assert [l["origin"] for l in combined["legs"]] == ["白城", "锦州港"]


def test_no_route_returns_empty():
    assert quick_estimate_modes(SEGMENTS, "哈尔滨", "深圳港") == []


def test_deadline_flags_overdue():
    today = date(2026, 8, 23)
    deadline = date(2026, 8, 30)  # 7 天
    results = quick_estimate_modes(SEGMENTS, "白城", "深圳港", deadline, today)
    by_mode = {r["mode"]: r for r in results}
    assert by_mode["rail"]["deadline_ok"] is True
    assert by_mode["road"]["deadline_ok"] is True
    assert by_mode["combined"]["deadline_ok"] is False
    assert by_mode["combined"]["over_days"] == 4  # 11 - 7


def test_no_deadline_means_unknown():
    results = quick_estimate_modes(SEGMENTS, "白城", "深圳港")
    assert all(r["deadline_ok"] is None for r in results)


def test_tags_cheapest_and_fastest():
    results = quick_estimate_modes(SEGMENTS, "白城", "深圳港")
    by_mode = {r["mode"]: r for r in results}
    assert "更省钱" in by_mode["combined"]["tags"]
    assert "更快到货" in by_mode["road"]["tags"]


def test_mode_names():
    assert MODE_NAMES["combined"] == "公水联运"
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && uv run pytest tests/logistics/test_rules.py -v`
Expected: FAIL（`ModuleNotFoundError: app.logistics.rules`）

- [ ] **Step 3: 实现 `backend/app/logistics/rules.py`（先写即时测算部分）**

```python
"""物流确定性规则：即时测算（轻量层）与正式匹配（完整层）。

模型只解释这里的结构化结果，不参与排序与数字生成。
"""

from __future__ import annotations

from datetime import date

MODE_NAMES = {"road": "公路", "rail": "铁路", "water": "水运", "combined": "公水联运"}


def _make_result(mode: str, legs: list, transship_count: int) -> dict:
    price_low = sum(l.price_low for l in legs)
    price_high = sum(l.price_high for l in legs)
    days_low = sum(l.days_low for l in legs)
    days_high = sum(l.days_high for l in legs)
    return {
        "mode": mode,
        "mode_name": MODE_NAMES[mode],
        "legs": [
            {
                "origin": l.origin,
                "destination": l.destination,
                "mode": l.mode,
                "mode_name": MODE_NAMES[l.mode],
            }
            for l in legs
        ],
        "price_low": int(price_low),
        "price_high": int(price_high),
        "price_unit": "元/吨",
        "days_low": days_low,
        "days_high": days_high,
        "transship_count": transship_count,
        "risk_note": "；".join(l.risk_note for l in legs if l.risk_note),
        "deadline_ok": None,
        "over_days": 0,
        "tags": [],
    }


def compose_candidates(segments: list, origin: str, destination: str) -> list[dict]:
    """组合候选：直达各方式 + 公水联运（公路段接水运段）。不做任何过滤。"""
    results = []
    for mode in ("road", "rail", "water"):
        direct = [
            s for s in segments
            if s.origin == origin and s.destination == destination and s.mode == mode
        ]
        if direct:
            results.append(_make_result(mode, [direct[0]], 0))
    for road in [s for s in segments if s.origin == origin and s.mode == "road"]:
        for water in [
            s for s in segments
            if s.origin == road.destination and s.destination == destination and s.mode == "water"
        ]:
            results.append(_make_result("combined", [road, water], 1))
    return results


def quick_estimate_modes(
    segments: list,
    origin: str,
    destination: str,
    deadline_date: date | None = None,
    today: date | None = None,
) -> list[dict]:
    """即时测算（轻量层）：按方式聚合给参考区间，不硬过滤、不选主推。"""
    results = compose_candidates(segments, origin, destination)
    if deadline_date is not None and today is not None:
        allowed = (deadline_date - today).days
        for r in results:
            r["deadline_ok"] = r["days_high"] <= allowed
            r["over_days"] = max(0, r["days_high"] - allowed)
    if results:
        cheapest = min(results, key=lambda r: r["price_low"])
        fastest = min(results, key=lambda r: r["days_low"])
        cheapest["tags"].append("更省钱")
        fastest["tags"].append("更快到货")
    return results
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && uv run pytest tests/logistics/test_rules.py -v`
Expected: 7 passed

- [ ] **Step 5: 检查点** —— 暂停，请用户确认是否提交。

---

### Task 3: 正式匹配规则（完整层）

**Files:**
- Modify: `backend/app/logistics/rules.py`
- Test: `backend/tests/logistics/test_rules.py`（追加）

- [ ] **Step 1: 在 `test_rules.py` 末尾追加失败测试**

```python
def svc(code, segment, varieties="corn", tmin=30, tmax=300):
    return SimpleNamespace(
        service_code=code, segment_code=segment, varieties=varieties,
        tonnage_min=tmin, tonnage_max=tmax,
        dispatch_window="每日发运", loading_note="", performance_note="", carrier="测试承运方",
    )


SERVICES = [
    svc("S-BC-JZ", "BC-JZ-ROAD", "corn,wheat", 30, 200),
    svc("S-BC-SZ-R", "BC-SZ-ROAD", "corn,wheat", 30, 150),
    svc("S-BC-SZ-RAIL", "BC-SZ-RAIL", "corn", 60, 2000),
    svc("S-JZ-SZ", "JZ-SZ-WATER", "corn,wheat", 500, 30000),
]

REQ = {
    "origin": "白城", "destination": "深圳港", "variety_code": "corn",
    "quantity_tons": 120, "deadline_date": date(2026, 8, 30),
    "allow_split": True, "today": date(2026, 8, 23),
}


def test_match_primary_backup_rejected():
    from app.logistics.rules import match_plans

    out = match_plans(SEGMENTS, SERVICES, REQ)
    assert out["primary"]["mode"] == "rail"  # 5-7 天满足 7 天且更便宜
    assert out["backup"]["mode"] == "road"
    rejected_modes = {r["mode"] for r in out["rejected"]}
    assert rejected_modes == {"combined"}
    overdue = next(r for r in out["rejected"] if r["mode"] == "combined")
    assert "超期" in overdue["reason"]


def test_overdue_low_price_never_primary():
    from app.logistics.rules import match_plans

    req = {**REQ, "deadline_date": date(2026, 8, 28)}  # 只给 5 天
    out = match_plans(SEGMENTS, SERVICES, REQ | {"deadline_date": date(2026, 8, 28)})
    assert out["primary"]["mode"] == "road"  # 铁路 5-7 天也超期被拒
    assert {r["mode"] for r in out["rejected"]} == {"rail", "combined"}


def test_variety_not_supported_rejected():
    from app.logistics.rules import match_plans

    out = match_plans(SEGMENTS, SERVICES, {**REQ, "variety_code": "rice"})
    # 仅公路直发承运水稻：铁路/联运无水稻服务
    assert out["primary"]["mode"] == "road"
    reasons = {r["mode"]: r["reason"] for r in out["rejected"]}
    assert "品种" in reasons["rail"]


def test_tonnage_without_split_rejected():
    from app.logistics.rules import match_plans

    out = match_plans(
        SEGMENTS, SERVICES, {**REQ, "quantity_tons": 500, "allow_split": False}
    )
    reasons = {r["mode"]: r["reason"] for r in out["rejected"]}
    assert "吨位" in reasons["road"]  # 公路直发上限 150
    assert out["primary"]["mode"] == "rail"


def test_no_feasible_plan():
    from app.logistics.rules import match_plans

    out = match_plans(SEGMENTS, SERVICES, {**REQ, "deadline_date": date(2026, 8, 24)})
    assert out["primary"] is None
    assert out["backup"] is None
    assert len(out["rejected"]) == 3
    assert out["suggestions"]  # 有放宽建议


def test_stable_result():
    from app.logistics.rules import match_plans

    a = match_plans(SEGMENTS, SERVICES, REQ)
    b = match_plans(SEGMENTS, SERVICES, REQ)
    assert a["primary"]["mode"] == b["primary"]["mode"]
    assert a["primary"]["price_low"] == b["primary"]["price_low"]
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && uv run pytest tests/logistics/test_rules.py -v`
Expected: 新用例 FAIL（`ImportError: cannot import name 'match_plans'`）

- [ ] **Step 3: 在 `rules.py` 末尾追加正式匹配实现**

```python
def _find_service(services: list, segment_code: str, variety_code: str):
    return next(
        (
            s for s in services
            if s.segment_code == segment_code and variety_code in s.varieties.split(",")
        ),
        None,
    )


def match_plans(segments: list, services: list, req: dict) -> dict:
    """正式匹配（完整层）：硬条件过滤 → 比较 → 主推/备选/未入选。

    req: origin / destination / variety_code / quantity_tons /
         deadline_date / allow_split / today
    """
    candidates = compose_candidates(segments, req["origin"], req["destination"])
    allowed = None
    if req.get("deadline_date") and req.get("today"):
        allowed = (req["deadline_date"] - req["today"]).days

    feasible, rejected = [], []
    for c in candidates:
        # 硬条件 1：每段都有适配品种的承运服务
        leg_services = []
        missing_legs = []
        for leg in c["legs"]:
            seg_code = next(
                s.segment_code for s in segments
                if s.origin == leg["origin"] and s.destination == leg["destination"]
                and s.mode == leg["mode"]
            )
            service = _find_service(services, seg_code, req["variety_code"])
            if service is None:
                missing_legs.append(f"{leg['origin']}—{leg['destination']}")
            else:
                leg_services.append(service)
        if missing_legs:
            rejected.append({**c, "reason": f"无适配该品种的承运服务（{'/'.join(missing_legs)}）"})
            continue
        # 硬条件 2：吨位（不允许分批时按单批校验）
        max_cap = min(s.tonnage_max for s in leg_services)
        if req["quantity_tons"] > max_cap and not req.get("allow_split", True):
            rejected.append({**c, "reason": f"单批吨位超出承运能力上限 {max_cap} 吨，且不允许分批"})
            continue
        # 硬条件 3：最晚到货
        if allowed is not None and c["days_high"] > allowed:
            rejected.append({**c, "reason": f"预计超期 {c['days_high'] - allowed} 天，无法满足最晚到货"})
            continue
        feasible.append(c)

    # 比较：到货已由硬条件保证，此后费用中位 → 时效上限 → 换装复杂度
    feasible.sort(
        key=lambda c: ((c["price_low"] + c["price_high"]) / 2, c["days_high"], c["transship_count"])
    )

    primary = feasible[0] if feasible else None
    backup = feasible[1] if len(feasible) > 1 else None
    for c in feasible[2:]:
        rejected.append({**c, "reason": "存在时效更稳或费用更优的组合，未入选"})

    suggestions = []
    if primary is None and allowed is not None:
        suggestions.append(f"将最晚到货放宽至 {allowed + 3} 天以上，可纳入公水联运等低成本方式")
    if primary is None and not suggestions:
        suggestions.append("放宽到货期限或更换起终节点后重新匹配")

    return {
        "primary": primary,
        "backup": backup,
        "rejected": rejected,
        "suggestions": suggestions,
        "check_items": [
            "参考运价需询运确认实时报价",
            "确认发运窗口与车/船排期",
            "确认收货端卸货能力与作业时间",
        ],
    }
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && uv run pytest tests/logistics/test_rules.py -v`
Expected: 13 passed

- [ ] **Step 5: 检查点** —— 暂停，请用户确认是否提交。

---

### Task 4: Repository 与测算/市场接口

**Files:**
- Create: `backend/app/logistics/repository.py`
- Create: `backend/app/logistics/routes.py`（先写 meta / hot-routes / estimates 部分）
- Modify: `backend/app/main.py`（挂路由）
- Modify: `backend/app/logistics/seed.py`（补 TODAY 常量）
- Modify: `backend/tests/logistics/test_routes.py`（加 autouse seed fixture）

- [ ] **Step 1: 在 `seed.py` 顶部常量区加固定演示日期**（需 `from datetime import date`）

```python
TODAY = date(2026, 8, 23)
```

- [ ] **Step 2: 写 `backend/app/logistics/repository.py`**

```python
import json
from datetime import date

from sqlalchemy.orm import Session

from app.logistics.models import (
    Inquiry,
    LogisticsService,
    QuickEstimate,
    RouteSegment,
    TransportPlan,
    TransportTask,
)


def list_segments(db: Session) -> list[RouteSegment]:
    return db.query(RouteSegment).all()


def list_services(db: Session) -> list[LogisticsService]:
    return db.query(LogisticsService).all()


def list_nodes(db: Session) -> list[str]:
    rows = db.query(RouteSegment.origin, RouteSegment.destination).all()
    names = {n for row in rows for n in row}
    return sorted(names)


def create_estimate(
    db: Session,
    origin: str,
    destination: str,
    variety_code: str,
    variety_name: str,
    quantity_tons: int,
    deadline_date: date | None,
    results: list[dict],
) -> QuickEstimate:
    rec = QuickEstimate(
        origin=origin,
        destination=destination,
        variety_code=variety_code,
        variety_name=variety_name,
        quantity_tons=quantity_tons,
        deadline_date=deadline_date,
        results_json=json.dumps(results, ensure_ascii=False),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


def list_estimates(db: Session, limit: int = 10) -> list[QuickEstimate]:
    return db.query(QuickEstimate).order_by(QuickEstimate.id.desc()).limit(limit).all()


def create_task(db: Session, fields: dict) -> TransportTask:
    task = TransportTask(**fields)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def list_tasks(db: Session) -> list[TransportTask]:
    return db.query(TransportTask).order_by(TransportTask.id.desc()).all()


def get_task(db: Session, task_id: int) -> TransportTask | None:
    return db.get(TransportTask, task_id)


def replace_plans(db: Session, task_id: int, plans: list[dict]) -> None:
    db.query(TransportPlan).filter_by(task_id=task_id).delete()
    for p in plans:
        db.add(TransportPlan(task_id=task_id, **p))
    db.commit()


def list_plans(db: Session, task_id: int) -> list[TransportPlan]:
    return (
        db.query(TransportPlan)
        .filter_by(task_id=task_id)
        .order_by(TransportPlan.id)
        .all()
    )


def get_plan(db: Session, plan_id: int) -> TransportPlan | None:
    return db.get(TransportPlan, plan_id)


def create_inquiry(db: Session, task_id: int, plan_id: int, content: dict) -> Inquiry:
    db.query(Inquiry).filter_by(task_id=task_id).delete()
    inq = Inquiry(
        task_id=task_id,
        plan_id=plan_id,
        content_json=json.dumps(content, ensure_ascii=False),
    )
    db.add(inq)
    db.commit()
    db.refresh(inq)
    return inq


def get_inquiry(db: Session, inquiry_id: int) -> Inquiry | None:
    return db.get(Inquiry, inquiry_id)


def get_inquiry_by_task(db: Session, task_id: int) -> Inquiry | None:
    return (
        db.query(Inquiry)
        .filter_by(task_id=task_id)
        .order_by(Inquiry.id.desc())
        .first()
    )


def submit_inquiry(db: Session, inquiry: Inquiry, feedback: dict) -> None:
    inquiry.status = "feedback"
    inquiry.feedback_json = json.dumps(feedback, ensure_ascii=False)
    db.commit()
```

- [ ] **Step 3: 写 `backend/app/logistics/routes.py`（首段：常量与测算接口）**

```python
import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.logistics import repository
from app.logistics.rules import MODE_NAMES, match_plans, quick_estimate_modes
from app.logistics.seed import DATA_UPDATED_AT, TODAY

router = APIRouter(prefix="/api/logistics", tags=["logistics"])

VARIETIES = [
    {"code": "corn", "name": "玉米"},
    {"code": "wheat", "name": "小麦"},
    {"code": "soybean", "name": "大豆"},
    {"code": "rice", "name": "稻谷"},
]
VARIETY_NAMES = {v["code"]: v["name"] for v in VARIETIES}

# 热门线路近期涨跌（百分比，参考口径）
HOT_CHANGES = {
    "YUN-SEG-JZ-SZ-WATER": 1.8,
    "YUN-SEG-BC-SZ-RAIL": -0.9,
    "YUN-SEG-BC-SZ-ROAD": 0.6,
    "YUN-SEG-JZ-GZ-WATER": 1.2,
    "YUN-SEG-CC-JZ-RAIL": -0.4,
    "YUN-SEG-HRB-SZ-RAIL": 2.1,
}


class EstimateBody(BaseModel):
    origin: str
    destination: str
    variety_code: str = "corn"
    quantity_tons: int
    deadline_date: str | None = None


@router.get("/meta")
def get_meta(db: Session = Depends(get_db)):
    return {
        "nodes": repository.list_nodes(db),
        "varieties": VARIETIES,
        "data_updated_at": DATA_UPDATED_AT,
    }


@router.get("/hot-routes")
def get_hot_routes(db: Session = Depends(get_db)):
    items = []
    for s in repository.list_segments(db)[:8]:
        items.append(
            {
                "origin": s.origin,
                "destination": s.destination,
                "mode": s.mode,
                "mode_name": MODE_NAMES[s.mode],
                "price_low": int(s.price_low),
                "price_high": int(s.price_high),
                "days_hint": f"{s.days_low}-{s.days_high} 天",
                "change_pct": HOT_CHANGES.get(s.segment_code, 0.0),
            }
        )
    return items


@router.post("/estimates")
def post_estimate(body: EstimateBody, db: Session = Depends(get_db)):
    deadline = date.fromisoformat(body.deadline_date) if body.deadline_date else None
    results = quick_estimate_modes(
        repository.list_segments(db), body.origin, body.destination, deadline, TODAY
    )
    rec = repository.create_estimate(
        db,
        body.origin,
        body.destination,
        body.variety_code,
        VARIETY_NAMES.get(body.variety_code, body.variety_code),
        body.quantity_tons,
        deadline,
        results,
    )
    return {
        "estimate_id": rec.id,
        "results": results,
        "data_updated_at": DATA_UPDATED_AT,
    }


@router.get("/estimates")
def get_estimates(db: Session = Depends(get_db)):
    return [
        {
            "id": e.id,
            "origin": e.origin,
            "destination": e.destination,
            "variety_code": e.variety_code,
            "variety_name": e.variety_name,
            "quantity_tons": e.quantity_tons,
            "deadline_date": e.deadline_date.isoformat() if e.deadline_date else None,
            "results": json.loads(e.results_json),
            "created_at": e.created_at.isoformat() if e.created_at else "",
        }
        for e in repository.list_estimates(db)
    ]
```

- [ ] **Step 4: 在 `main.py` 挂路由**

import 区加 `from app.logistics.routes import router as logistics_router`，文件末尾加：

```python
app.include_router(logistics_router)
```

- [ ] **Step 5: 给 `test_routes.py` 加 autouse seed fixture 并追加接口测试**

在 `test_routes.py` 顶部 import 区后加：

```python
import pytest


@pytest.fixture(autouse=True)
def _seed_logistics(db_session):
    from app.logistics.seed import seed_logistics_mock_data

    seed_logistics_mock_data(db_session)
```

文件末尾追加：

```python
def test_meta_nodes(client):
    data = client.get("/api/logistics/meta").json()
    assert "白城" in data["nodes"]
    assert "深圳港" in data["nodes"]
    assert len(data["varieties"]) == 4


def test_hot_routes(client):
    items = client.get("/api/logistics/hot-routes").json()
    assert 6 <= len(items) <= 8
    assert all("price_low" in i and "days_hint" in i for i in items)


def test_estimate_with_deadline(client):
    resp = client.post(
        "/api/logistics/estimates",
        json={
            "origin": "白城",
            "destination": "深圳港",
            "variety_code": "corn",
            "quantity_tons": 120,
            "deadline_date": "2026-08-30",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    modes = {r["mode"] for r in data["results"]}
    assert modes == {"road", "rail", "combined"}
    combined = next(r for r in data["results"] if r["mode"] == "combined")
    assert combined["deadline_ok"] is False

    listed = client.get("/api/logistics/estimates").json()
    assert listed[0]["origin"] == "白城"


def test_estimate_no_route(client):
    resp = client.post(
        "/api/logistics/estimates",
        json={"origin": "哈尔滨", "destination": "广州港", "quantity_tons": 100},
    )
    assert resp.json()["results"] == []
```

- [ ] **Step 6: 运行验证**

Run: `cd backend && uv run pytest tests/logistics/ -v`
Expected: 全部通过（23 passed）

- [ ] **Step 7: 检查点** —— 暂停，请用户确认是否提交。

---

### Task 5: 运输任务与正式匹配接口

**Files:**
- Modify: `backend/app/logistics/routes.py`（追加）
- Test: `backend/tests/logistics/test_routes.py`（追加）

- [ ] **Step 1: 写失败测试（追加到 `test_routes.py` 末尾）**

```python
def _create_demo_task(client, deadline="2026-08-30"):
    resp = client.post(
        "/api/logistics/tasks",
        json={
            "origin": "白城",
            "destination": "深圳港",
            "variety_code": "corn",
            "quantity_tons": 120,
            "deadline_date": deadline,
            "source_type": "estimate",
            "source_ref": "1",
        },
    )
    assert resp.status_code == 200
    return resp.json()


def test_create_task_and_match(client):
    task = _create_demo_task(client)
    assert task["status"] == "working"

    resp = client.post(f"/api/logistics/tasks/{task['id']}/match")
    assert resp.json()["primary"] is True

    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["status"] == "plans_ready"
    by_type = {}
    for p in detail["plans"]:
        by_type.setdefault(p["plan_type"], []).append(p)
    assert by_type["primary"][0]["title"].startswith("铁路")
    assert by_type["backup"][0]["title"].startswith("公路")
    assert any("超期" in r["reason"] for r in by_type["rejected"])


def test_match_no_feasible(client):
    task = _create_demo_task(client, deadline="2026-08-24")
    resp = client.post(f"/api/logistics/tasks/{task['id']}/match")
    assert resp.json()["primary"] is False
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["blocked_note"]  # 有放宽建议
    assert all(p["plan_type"] == "rejected" for p in detail["plans"])


def test_task_list(client):
    _create_demo_task(client)
    tasks = client.get("/api/logistics/tasks").json()
    assert tasks[0]["origin"] == "白城"
    assert "status_label" in tasks[0]
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && uv run pytest tests/logistics/test_routes.py -v -k "task"`
Expected: FAIL（404，路由未实现）

- [ ] **Step 3: 在 `routes.py` 追加任务与匹配接口**

在 `EstimateBody` 之后加：

```python
class TaskBody(EstimateBody):
    allow_split: bool = True
    source_type: str = "self"
    source_ref: str = ""
    extra_note: str = ""


STATUS_LABELS = {
    "working": "整理需求中",
    "plans_ready": "有方案",
    "inquiry_draft": "询运草稿",
    "submitted": "已提交",
    "feedback": "已反馈",
}


def _task_dict(t):
    return {
        "id": t.id,
        "origin": t.origin,
        "destination": t.destination,
        "variety_code": t.variety_code,
        "variety_name": t.variety_name,
        "quantity_tons": t.quantity_tons,
        "deadline_date": t.deadline_date.isoformat() if t.deadline_date else None,
        "source_type": t.source_type,
        "status": t.status,
        "status_label": STATUS_LABELS.get(t.status, t.status),
        "blocked_note": t.blocked_note,
        "created_at": t.created_at.isoformat() if t.created_at else "",
    }


def _plan_dict(p):
    return {
        "id": p.id,
        "plan_type": p.plan_type,
        "title": p.title,
        "legs": json.loads(p.legs_json),
        "price_low": int(p.price_low),
        "price_high": int(p.price_high),
        "days_low": p.days_low,
        "days_high": p.days_high,
        "transship_count": p.transship_count,
        "risk_note": p.risk_note,
        "reason": p.reason,
        "check_items": json.loads(p.check_items_json),
    }


def _inquiry_dict(inq):
    return {
        "id": inq.id,
        "task_id": inq.task_id,
        "plan_id": inq.plan_id,
        "status": inq.status,
        "content": json.loads(inq.content_json),
        "feedback": json.loads(inq.feedback_json) if inq.feedback_json else None,
    }


@router.post("/tasks")
def post_task(body: TaskBody, db: Session = Depends(get_db)):
    task = repository.create_task(
        db,
        {
            "origin": body.origin,
            "destination": body.destination,
            "variety_code": body.variety_code,
            "variety_name": VARIETY_NAMES.get(body.variety_code, body.variety_code),
            "quantity_tons": body.quantity_tons,
            "deadline_date": date.fromisoformat(body.deadline_date)
            if body.deadline_date
            else None,
            "allow_split": 1 if body.allow_split else 0,
            "source_type": body.source_type,
            "source_ref": body.source_ref,
            "extra_note": body.extra_note,
        },
    )
    return _task_dict(task)


@router.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
    return [_task_dict(t) for t in repository.list_tasks(db)]


@router.get("/tasks/{task_id}")
def get_task_detail(task_id: int, db: Session = Depends(get_db)):
    task = repository.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    inquiry = repository.get_inquiry_by_task(db, task_id)
    return {
        "task": _task_dict(task),
        "plans": [_plan_dict(p) for p in repository.list_plans(db, task_id)],
        "inquiry": _inquiry_dict(inquiry) if inquiry else None,
    }


@router.post("/tasks/{task_id}/match")
def post_match(task_id: int, db: Session = Depends(get_db)):
    task = repository.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    out = match_plans(
        repository.list_segments(db),
        repository.list_services(db),
        {
            "origin": task.origin,
            "destination": task.destination,
            "variety_code": task.variety_code,
            "quantity_tons": task.quantity_tons,
            "deadline_date": task.deadline_date,
            "allow_split": bool(task.allow_split),
            "today": TODAY,
        },
    )

    def build(plan: dict, ptype: str, reason: str, title: str) -> dict:
        return {
            "plan_type": ptype,
            "title": title,
            "legs_json": json.dumps(plan["legs"], ensure_ascii=False),
            "price_low": plan["price_low"],
            "price_high": plan["price_high"],
            "days_low": plan["days_low"],
            "days_high": plan["days_high"],
            "transship_count": plan["transship_count"],
            "risk_note": plan.get("risk_note", ""),
            "reason": reason,
            "check_items_json": json.dumps(out["check_items"], ensure_ascii=False),
        }

    plans = []
    if out["primary"]:
        plans.append(
            build(
                out["primary"],
                "primary",
                "满足全部硬条件，时效与费用组合最稳",
                f"{out['primary']['mode_name']}方案",
            )
        )
    if out["backup"]:
        b = out["backup"]
        diff = "备选"
        if out["primary"]:
            p = out["primary"]
            d_price = (b["price_low"] + b["price_high"]) // 2 - (
                p["price_low"] + p["price_high"]
            ) // 2
            d_days = b["days_high"] - p["days_high"]
            diff = (
                f"与主推相比：{'省' if d_price < 0 else '贵'}约 {abs(d_price)} 元/吨，"
                f"时效上限{'快' if d_days < 0 else '慢'} {abs(d_days)} 天"
            )
        plans.append(build(b, "backup", diff, f"{b['mode_name']}方案（备选）"))
    for r in out["rejected"]:
        plans.append(build(r, "rejected", r["reason"], f"{r['mode_name']}方案"))
    repository.replace_plans(db, task_id, plans)
    task.status = "plans_ready"
    task.blocked_note = "" if out["primary"] else "；".join(out["suggestions"])
    db.commit()
    return {"matched": len(plans), "primary": bool(out["primary"])}
```

- [ ] **Step 4: 运行验证**

Run: `cd backend && uv run pytest tests/logistics/test_routes.py -v`
Expected: 全部通过（新增 3 个）

- [ ] **Step 5: 检查点** —— 暂停，请用户确认是否提交。

---

### Task 6: 询运单与人工反馈接口

**Files:**
- Modify: `backend/app/logistics/routes.py`（追加）
- Test: `backend/tests/logistics/test_routes.py`（追加）

- [ ] **Step 1: 写失败测试（追加）**

```python
def test_inquiry_flow(client):
    task = _create_demo_task(client)
    client.post(f"/api/logistics/tasks/{task['id']}/match")
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    primary = next(p for p in detail["plans"] if p["plan_type"] == "primary")

    resp = client.post(
        f"/api/logistics/tasks/{task['id']}/inquiry", json={"plan_id": primary["id"]}
    )
    assert resp.status_code == 200
    inquiry = resp.json()
    assert inquiry["status"] == "draft"
    assert "白城" in inquiry["content"]["路线"]
    assert "玉米" in inquiry["content"]["品种与数量"]

    resp = client.post(f"/api/logistics/inquiries/{inquiry['id']}/submit")
    submitted = resp.json()
    assert submitted["status"] == "feedback"
    assert submitted["feedback"]["反馈方"]
    assert "元/吨" in submitted["feedback"]["报价"]

    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert detail["task"]["status"] == "feedback"
    assert detail["inquiry"]["feedback"] is not None


def test_rejected_plan_cannot_inquiry(client):
    task = _create_demo_task(client)
    client.post(f"/api/logistics/tasks/{task['id']}/match")
    detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    rejected = next(p for p in detail["plans"] if p["plan_type"] == "rejected")
    resp = client.post(
        f"/api/logistics/tasks/{task['id']}/inquiry", json={"plan_id": rejected["id"]}
    )
    assert resp.status_code == 400
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && uv run pytest tests/logistics/test_routes.py -v -k "inquiry"`
Expected: FAIL（404/405）

- [ ] **Step 3: 在 `routes.py` 追加询运接口**

```python
class InquiryBody(BaseModel):
    plan_id: int


@router.post("/tasks/{task_id}/inquiry")
def post_inquiry(task_id: int, body: InquiryBody, db: Session = Depends(get_db)):
    task = repository.get_task(db, task_id)
    plan = repository.get_plan(db, body.plan_id)
    if task is None or plan is None or plan.task_id != task_id:
        raise HTTPException(status_code=404, detail="任务或方案不存在")
    if plan.plan_type == "rejected":
        raise HTTPException(status_code=400, detail="未入选方案不能生成询运单")
    legs = json.loads(plan.legs_json)
    route = legs[0]["origin"] + "".join(f" → {l['destination']}" for l in legs)
    content = {
        "品种与数量": f"{task.variety_name} {task.quantity_tons} 吨",
        "发货地": task.origin,
        "收货地": task.destination,
        "最晚到货": task.deadline_date.isoformat() if task.deadline_date else "未指定",
        "选定方案": plan.title,
        "路线": route,
        "期望报价口径": "元/吨，含税含装卸",
        "需承运方确认": "实时运力与报价有效期；收货端卸货安排",
    }
    inq = repository.create_inquiry(db, task_id, plan.id, content)
    task.status = "inquiry_draft"
    db.commit()
    return _inquiry_dict(inq)


@router.post("/inquiries/{inquiry_id}/submit")
def post_submit(inquiry_id: int, db: Session = Depends(get_db)):
    inq = repository.get_inquiry(db, inquiry_id)
    if inq is None:
        raise HTTPException(status_code=404, detail="询运单不存在")
    task = repository.get_task(db, inq.task_id)
    plan = repository.get_plan(db, inq.plan_id)
    quote = (int(plan.price_low) + int(plan.price_high)) // 2
    feedback = {
        "反馈方": "粮达物流线路运营组",
        "反馈时间": TODAY.isoformat(),
        "可承运量": f"{task.quantity_tons} 吨",
        "可发运时间": "确认询运后 3 天内",
        "报价": f"{quote} 元/吨",
        "报价包含": "装车/装船与换装作业费",
        "报价不包含": "保险费与港口杂费",
        "有效期": "3 个自然日",
        "特别条件": "按确认的发运窗口排车/配船",
        "待用户确认": "发运窗口与收货端卸货能力",
    }
    repository.submit_inquiry(db, inq, feedback)
    task.status = "feedback"
    db.commit()
    return _inquiry_dict(inq)
```

- [ ] **Step 4: 运行验证**

Run: `cd backend && uv run pytest tests/logistics/ -v`
Expected: 全部通过（新增 2 个）

- [ ] **Step 5: 检查点** —— 暂停，请用户确认是否提交。

---

### Task 7: LangChain 需求抽取与解释层（可降级）

**Files:**
- Create: `backend/app/logistics/llm.py`
- Create: `backend/tests/logistics/conftest.py`（seed fixture 从 test_routes 移入）
- Modify: `backend/app/logistics/routes.py`（追加 extract / explain）
- Test: `backend/tests/logistics/test_llm.py`

- [ ] **Step 1: 把 autouse seed fixture 移到 `backend/tests/logistics/conftest.py`**

```python
import pytest


@pytest.fixture(autouse=True)
def _seed_logistics(db_session):
    from app.logistics.seed import seed_logistics_mock_data

    seed_logistics_mock_data(db_session)
```

并从 `test_routes.py` 删除该 fixture（含 `import pytest`，若无其他使用）。

- [ ] **Step 2: 写失败测试 `backend/tests/logistics/test_llm.py`**

```python
def _create_and_match(client):
    resp = client.post(
        "/api/logistics/tasks",
        json={
            "origin": "白城",
            "destination": "深圳港",
            "variety_code": "corn",
            "quantity_tons": 120,
            "deadline_date": "2026-08-30",
        },
    )
    task = resp.json()
    client.post(f"/api/logistics/tasks/{task['id']}/match")
    return task


def test_extract_unavailable_without_key(client, monkeypatch):
    from app.logistics import llm

    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    resp = client.post(
        "/api/logistics/extract", json={"text": "120 吨玉米，白城到深圳港，一周内到"}
    )
    assert resp.status_code == 200
    assert resp.json()["llm_available"] is False


def test_explain_fallback_without_key(client, monkeypatch):
    from app.logistics import llm

    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    task = _create_and_match(client)
    resp = client.post(
        "/api/logistics/explain",
        json={"task_id": task["id"], "question": "为什么主推铁路？"},
    )
    assert resp.status_code == 200
    answer = resp.json()["answer"]
    assert "主推" in answer
    assert "未入选" in answer
```

- [ ] **Step 3: 运行确认失败**

Run: `cd backend && uv run pytest tests/logistics/test_llm.py -v`
Expected: FAIL（404，接口未实现）

- [ ] **Step 4: 写 `backend/app/logistics/llm.py`**

```python
"""运小二大模型层：自然语言需求抽取与方案解释。

数字与结论全部来自确定性规则；模型只负责理解与解释。
未配置 QWEN_API_KEY 或调用失败时返回 None / 回退规则版文案。
"""

import logging
import os
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

logger = logging.getLogger("yun.logistics.llm")

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

# 为 None 时每次调用重读 .env；测试可 monkeypatch 该值模拟已/未配置。
QWEN_API_KEY: str | None = None

DEFAULT_MODEL = "qwen-plus"
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

SYSTEM_PROMPT = (
    "你是粮达网 Plus 的物流助手「运小二」。"
    "你的任务是把用户对一批粮食运输的自然语言描述抽取为结构化条件，"
    "或基于已给的结构化方案结论组织解释。"
    "不得编造节点、运价或承运方；起终点必须从给定节点列表中选择；"
    "对模糊表达（如'一周内到'）给出明确解释。"
)


class RequirementExtraction(BaseModel):
    origin: str | None = Field(None, description="发货地，必须来自节点列表，否则留空")
    destination: str | None = Field(None, description="收货地，必须来自节点列表，否则留空")
    variety_code: str | None = Field(
        None, description="品种代码：corn 玉米 / wheat 小麦 / soybean 大豆 / rice 稻谷"
    )
    quantity_tons: int | None = Field(None, description="数量（吨）")
    deadline_days: int | None = Field(None, description="从今天起到最晚到货的天数")
    assumptions: list[str] = Field(default_factory=list, description="对模糊表达的解释")
    question: str | None = Field(None, description="影响匹配的最关键缺失问题，无则留空")


def _config() -> tuple[str, str, str]:
    if QWEN_API_KEY is not None:
        return (
            QWEN_API_KEY,
            os.getenv("QWEN_MODEL", DEFAULT_MODEL),
            os.getenv("QWEN_BASE_URL", DEFAULT_BASE_URL),
        )
    load_dotenv(_ENV_PATH, override=True)
    return (
        os.getenv("QWEN_API_KEY", "").strip(),
        os.getenv("QWEN_MODEL", DEFAULT_MODEL),
        os.getenv("QWEN_BASE_URL", DEFAULT_BASE_URL),
    )


def _build_llm(api_key: str, model: str, base_url: str):
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url=base_url,
        temperature=0.2,
        timeout=120,
        max_retries=1,
    )


def extract_requirements(text: str, nodes: list[str], today: date) -> dict | None:
    """从自然语言抽取结构化运输条件；不可用时返回 None。"""
    api_key, model, base_url = _config()
    if not api_key:
        return None
    try:
        llm = _build_llm(api_key, model, base_url)
        prompt = (
            f"节点列表（起终点只能从中选择）：{'、'.join(nodes)}\n"
            f"今天：{today.isoformat()}\n"
            f"用户描述：{text}\n"
            "请抽取结构化条件；'几天内到'请换算为 deadline_days。"
        )
        result = llm.with_structured_output(RequirementExtraction).invoke(
            [("system", SYSTEM_PROMPT), ("human", prompt)]
        )
        if result is None:
            return None
        deadline_date = None
        if result.deadline_days:
            deadline_date = (today + timedelta(days=result.deadline_days)).isoformat()
        return {
            "fields": {
                "origin": result.origin if result.origin in nodes else None,
                "destination": result.destination if result.destination in nodes else None,
                "variety_code": result.variety_code,
                "quantity_tons": result.quantity_tons,
                "deadline_date": deadline_date,
            },
            "assumptions": result.assumptions,
            "question": result.question,
        }
    except Exception:
        logger.exception("Qwen 需求抽取失败")
        return None


def _fallback_explanation(context: dict) -> str:
    plans = context["plans"]
    parts = []
    primary = next((p for p in plans if p["plan_type"] == "primary"), None)
    if primary:
        parts.append(
            f"主推为{primary['title']}：{primary['price_low']}~{primary['price_high']} 元/吨、"
            f"预计 {primary['days_low']}~{primary['days_high']} 天。理由：{primary['reason']}。"
        )
    backup = next((p for p in plans if p["plan_type"] == "backup"), None)
    if backup:
        parts.append(f"备选为{backup['title']}：{backup['reason']}。")
    rejected = [p for p in plans if p["plan_type"] == "rejected"]
    if rejected:
        parts.append(
            "未入选：" + "；".join(f"{r['title']}——{r['reason']}" for r in rejected) + "。"
        )
    return "".join(parts) or "当前任务还没有生成方案，请先运行匹配。"


def explain_plans(question: str, context: dict) -> str:
    """解释方案取舍；模型不可用或失败时回退结构化模板。"""
    fallback = _fallback_explanation(context)
    api_key, model, base_url = _config()
    if not api_key:
        return fallback
    try:
        llm = _build_llm(api_key, model, base_url)
        task = context["task"]
        prompt = (
            f"【运输任务】{task['origin']} → {task['destination']}，"
            f"{task['variety_name']} {task['quantity_tons']} 吨，"
            f"最晚到货 {task['deadline_date'] or '未指定'}\n"
            f"【方案结论】{fallback}\n"
            f"【用户问题】{question or '为什么这样推荐？'}\n"
            "请基于以上结论回答，不得编造结论之外的数字。"
        )
        message = llm.invoke([("system", SYSTEM_PROMPT), ("human", prompt)])
        text = (message.content or "").strip()
        return text or fallback
    except Exception:
        logger.exception("Qwen 方案解释失败，回退规则版")
        return fallback
```

- [ ] **Step 5: 在 `routes.py` 追加 extract / explain 接口**

顶部 import 区加 `from app.logistics import llm`，文件末尾加：

```python
class ExtractBody(BaseModel):
    text: str


class ExplainBody(BaseModel):
    task_id: int
    question: str = ""


@router.post("/extract")
def post_extract(body: ExtractBody, db: Session = Depends(get_db)):
    result = llm.extract_requirements(body.text, repository.list_nodes(db), TODAY)
    if result is None:
        return {"llm_available": False}
    return {"llm_available": True, **result}


@router.post("/explain")
def post_explain(body: ExplainBody, db: Session = Depends(get_db)):
    task = repository.get_task(db, body.task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    plans = [_plan_dict(p) for p in repository.list_plans(db, body.task_id)]
    answer = llm.explain_plans(body.question, {"task": _task_dict(task), "plans": plans})
    return {"answer": answer}
```

- [ ] **Step 6: 运行验证**

Run: `cd backend && uv run pytest tests/logistics/ -v`
Expected: 全部通过（约 29 passed）

- [ ] **Step 7: 检查点** —— 暂停，请用户确认是否提交。

---

### Task 8: 前端基础（types / api / YunPage 骨架 / 挂载）

**Files:**
- Create: `web/src/features/yun/types.ts`
- Create: `web/src/features/yun/api.ts`
- Create: `web/src/features/yun/YunPage.tsx`（骨架，Tab 组件先占位）
- Modify: `web/src/pages/agents/AgentServicePage.tsx`
- Modify: `web/src/data/agents.ts`

前端项目无测试框架，验证方式：`cd web && npx tsc --noEmit` + 浏览器手动验收。

- [ ] **Step 1: 写 `web/src/features/yun/types.ts`**

```ts
export interface EstimateLeg {
  origin: string;
  destination: string;
  mode: string;
  mode_name: string;
}

export interface EstimateResult {
  mode: string;
  mode_name: string;
  legs: EstimateLeg[];
  price_low: number;
  price_high: number;
  price_unit: string;
  days_low: number;
  days_high: number;
  transship_count: number;
  risk_note: string;
  deadline_ok: boolean | null;
  over_days: number;
  tags: string[];
}

export interface EstimateResponse {
  estimate_id: number;
  results: EstimateResult[];
  data_updated_at: string;
}

export interface QuickEstimateRecord {
  id: number;
  origin: string;
  destination: string;
  variety_code: string;
  variety_name: string;
  quantity_tons: number;
  deadline_date: string | null;
  results: EstimateResult[];
  created_at: string;
}

export interface HotRoute {
  origin: string;
  destination: string;
  mode: string;
  mode_name: string;
  price_low: number;
  price_high: number;
  days_hint: string;
  change_pct: number;
}

export interface LogisticsMeta {
  nodes: string[];
  varieties: { code: string; name: string }[];
  data_updated_at: string;
}

export interface EstimateRequest {
  origin: string;
  destination: string;
  variety_code: string;
  quantity_tons: number;
  deadline_date?: string | null;
}

export interface TaskRequest extends EstimateRequest {
  allow_split?: boolean;
  source_type?: string;
  source_ref?: string;
  extra_note?: string;
}

export interface TransportTask {
  id: number;
  origin: string;
  destination: string;
  variety_code: string;
  variety_name: string;
  quantity_tons: number;
  deadline_date: string | null;
  source_type: string;
  status: string;
  status_label: string;
  blocked_note: string;
  created_at: string;
}

export interface TransportPlan {
  id: number;
  plan_type: "primary" | "backup" | "rejected";
  title: string;
  legs: EstimateLeg[];
  price_low: number;
  price_high: number;
  days_low: number;
  days_high: number;
  transship_count: number;
  risk_note: string;
  reason: string;
  check_items: string[];
}

export interface Inquiry {
  id: number;
  task_id: number;
  plan_id: number;
  status: string;
  content: Record<string, string>;
  feedback: Record<string, string> | null;
}

export interface TaskDetail {
  task: TransportTask;
  plans: TransportPlan[];
  inquiry: Inquiry | null;
}

export interface ExtractResponse {
  llm_available: boolean;
  fields?: Partial<EstimateRequest>;
  assumptions?: string[];
  question?: string | null;
}
```

- [ ] **Step 2: 写 `web/src/features/yun/api.ts`**

```ts
import type {
  EstimateRequest,
  EstimateResponse,
  ExtractResponse,
  HotRoute,
  Inquiry,
  LogisticsMeta,
  QuickEstimateRecord,
  TaskDetail,
  TaskRequest,
  TransportTask,
} from "./types";

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, init);
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

function post<T>(url: string, body?: unknown): Promise<T> {
  return http<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const fetchLogisticsMeta = () => http<LogisticsMeta>("/api/logistics/meta");
export const fetchHotRoutes = () => http<HotRoute[]>("/api/logistics/hot-routes");
export const createEstimate = (body: EstimateRequest) =>
  post<EstimateResponse>("/api/logistics/estimates", body);
export const listEstimates = () => http<QuickEstimateRecord[]>("/api/logistics/estimates");
export const createTask = (body: TaskRequest) =>
  post<TransportTask>("/api/logistics/tasks", body);
export const matchTask = (taskId: number) =>
  post<{ matched: number; primary: boolean }>(`/api/logistics/tasks/${taskId}/match`);
export const listTasks = () => http<TransportTask[]>("/api/logistics/tasks");
export const fetchTaskDetail = (taskId: number) =>
  http<TaskDetail>(`/api/logistics/tasks/${taskId}`);
export const createInquiry = (taskId: number, planId: number) =>
  post<Inquiry>(`/api/logistics/tasks/${taskId}/inquiry`, { plan_id: planId });
export const submitInquiry = (inquiryId: number) =>
  post<Inquiry>(`/api/logistics/inquiries/${inquiryId}/submit`);
export const extractRequirements = (text: string) =>
  post<ExtractResponse>("/api/logistics/extract", { text });
export const explainPlans = (taskId: number, question: string) =>
  post<{ answer: string }>("/api/logistics/explain", { task_id: taskId, question });
```

- [ ] **Step 3: 写 `web/src/features/yun/YunPage.tsx`（骨架，头部与 tab 条参照 ZhanPage）**

```tsx
import { useState } from "react";
import AgentSwitcher from "../../components/AgentSwitcher";
import { getAgent } from "../../data/agents";
import FindLogisticsTab from "./FindLogisticsTab";
import PlansTab from "./PlansTab";
import InquiryTab from "./InquiryTab";
import TasksTab from "./TasksTab";
import type { QuickEstimateRecord } from "./types";

const agent = getAgent("yun")!;

export default function YunPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [reuse, setReuse] = useState<QuickEstimateRecord | null>(null);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            <img
              src={agent.image}
              alt={agent.name}
              className="h-12 w-auto drop-shadow-[0_0_10px_rgba(63,157,110,0.35)]"
            />
            <h1 className="text-lg font-semibold">
              {agent.name}｜{agent.action}
              <span className="ml-2.5 rounded-full bg-brand-faint px-2.5 py-0.5 text-xs font-normal text-brand-deep">
                {agent.role}
              </span>
            </h1>
          </div>
          <AgentSwitcher currentId={agent.id} />
        </div>
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

      <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6">
        {activeTab === 0 && (
          <FindLogisticsTab
            prefill={reuse}
            onPrefillConsumed={() => setReuse(null)}
            onTaskCreated={(id) => {
              setTaskId(id);
              setActiveTab(1);
            }}
          />
        )}
        {activeTab === 1 && (
          <PlansTab taskId={taskId} onInquiryCreated={() => setActiveTab(2)} />
        )}
        {activeTab === 2 && <InquiryTab taskId={taskId} />}
        {activeTab === 3 && (
          <TasksTab
            onOpenTask={(id) => {
              setTaskId(id);
              setActiveTab(1);
            }}
            onReuseEstimate={(rec) => {
              setReuse(rec);
              setActiveTab(0);
            }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 先写四个 tab 组件的最小占位，保证 tsc 通过**

分别创建 `FindLogisticsTab.tsx` / `PlansTab.tsx` / `InquiryTab.tsx` / `TasksTab.tsx`，内容为带正确 props 签名的占位（后续任务逐个替换）：

```tsx
// FindLogisticsTab.tsx
import type { QuickEstimateRecord } from "./types";

interface Props {
  prefill: QuickEstimateRecord | null;
  onPrefillConsumed: () => void;
  onTaskCreated: (taskId: number) => void;
}

export default function FindLogisticsTab(_props: Props) {
  return <div className="text-sm text-ink-soft">找物流建设中…</div>;
}
```

```tsx
// PlansTab.tsx
interface Props {
  taskId: number | null;
  onInquiryCreated: () => void;
}

export default function PlansTab(_props: Props) {
  return <div className="text-sm text-ink-soft">运输方案建设中…</div>;
}
```

```tsx
// InquiryTab.tsx
interface Props {
  taskId: number | null;
}

export default function InquiryTab(_props: Props) {
  return <div className="text-sm text-ink-soft">询运对接建设中…</div>;
}
```

```tsx
// TasksTab.tsx
import type { QuickEstimateRecord } from "./types";

interface Props {
  onOpenTask: (taskId: number) => void;
  onReuseEstimate: (record: QuickEstimateRecord) => void;
}

export default function TasksTab(_props: Props) {
  return <div className="text-sm text-ink-soft">运输任务建设中…</div>;
}
```

- [ ] **Step 5: 挂载到 `AgentServicePage.tsx`**

import 区加：

```tsx
import YunPage from "../../features/yun/YunPage";
```

在 `if (agent.id === "zhan") return <ZhanPage />;` 之后加：

```tsx
if (agent.id === "yun") return <YunPage />;
```

- [ ] **Step 6: 更新 `agents.ts` 中运小二的 tabs**

把：

```ts
tabs: ["找物流", "路线方案", "方案对比", "运输任务", "历史记录"],
```

改为：

```ts
tabs: ["找物流", "运输方案", "询运对接", "运输任务"],
```

- [ ] **Step 7: 验证类型**

Run: `cd web && npx tsc --noEmit`
Expected: 无输出（通过）

- [ ] **Step 8: 检查点** —— 暂停，请用户确认是否提交。

---

### Task 9: 首 tab「找物流」组件（受理卡 + 即时测算 + 热门线路 + 最近测算）

**Files:**
- Modify: `web/src/features/yun/FindLogisticsTab.tsx`（替换占位）

- [ ] **Step 1: 用完整实现替换 `FindLogisticsTab.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import {
  createEstimate,
  createTask,
  extractRequirements,
  fetchHotRoutes,
  fetchLogisticsMeta,
  listEstimates,
  matchTask,
} from "./api";
import type {
  EstimateResult,
  HotRoute,
  LogisticsMeta,
  QuickEstimateRecord,
} from "./types";

interface Props {
  prefill: QuickEstimateRecord | null;
  onPrefillConsumed: () => void;
  onTaskCreated: (taskId: number) => void;
}

const EMPTY_FORM = {
  origin: "",
  destination: "",
  variety_code: "corn",
  quantity_tons: "",
  deadline_date: "",
};

export default function FindLogisticsTab({ prefill, onPrefillConsumed, onTaskCreated }: Props) {
  const [meta, setMeta] = useState<LogisticsMeta | null>(null);
  const [hotRoutes, setHotRoutes] = useState<HotRoute[]>([]);
  const [recent, setRecent] = useState<QuickEstimateRecord[]>([]);
  const [nlText, setNlText] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [results, setResults] = useState<EstimateResult[]>([]);
  const [estimateId, setEstimateId] = useState<number | null>(null);
  const [dataDate, setDataDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecent = useCallback(() => {
    listEstimates().then(setRecent).catch(() => {});
  }, []);

  useEffect(() => {
    fetchLogisticsMeta()
      .then(setMeta)
      .catch(() => setError("数据未就绪，请确认后端服务已启动"));
    fetchHotRoutes().then(setHotRoutes).catch(() => {});
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    if (!prefill) return;
    setForm({
      origin: prefill.origin,
      destination: prefill.destination,
      variety_code: prefill.variety_code,
      quantity_tons: String(prefill.quantity_tons),
      deadline_date: prefill.deadline_date ?? "",
    });
    setResults(prefill.results);
    onPrefillConsumed();
  }, [prefill, onPrefillConsumed]);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const runEstimate = async () => {
    setBusy(true);
    setError(null);
    setAssumptions([]);
    try {
      let f = { ...form };
      let aiQuestion: string | null = null;
      if (nlText.trim()) {
        const ex = await extractRequirements(nlText);
        if (ex.llm_available && ex.fields) {
          f = {
            ...f,
            origin: ex.fields.origin || f.origin,
            destination: ex.fields.destination || f.destination,
            variety_code: ex.fields.variety_code || f.variety_code,
            quantity_tons: ex.fields.quantity_tons
              ? String(ex.fields.quantity_tons)
              : f.quantity_tons,
            deadline_date: ex.fields.deadline_date || f.deadline_date,
          };
          setForm(f);
          setAssumptions(ex.assumptions ?? []);
          aiQuestion = ex.question ?? null;
        }
      }
      if (!f.origin || !f.destination || !f.quantity_tons) {
        setError(
          `请至少提供发货地、收货地和数量${aiQuestion ? `。运小二想确认：${aiQuestion}` : ""}`
        );
        return;
      }
      const resp = await createEstimate({
        origin: f.origin,
        destination: f.destination,
        variety_code: f.variety_code,
        quantity_tons: Number(f.quantity_tons),
        deadline_date: f.deadline_date || null,
      });
      setResults(resp.results);
      setEstimateId(resp.estimate_id);
      setDataDate(resp.data_updated_at);
      loadRecent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "测算失败");
    } finally {
      setBusy(false);
    }
  };

  const createRequirement = async () => {
    setBusy(true);
    setError(null);
    try {
      const task = await createTask({
        origin: form.origin,
        destination: form.destination,
        variety_code: form.variety_code,
        quantity_tons: Number(form.quantity_tons),
        deadline_date: form.deadline_date || null,
        source_type: estimateId ? "estimate" : "self",
        source_ref: estimateId ? String(estimateId) : "",
      });
      await matchTask(task.id);
      onTaskCreated(task.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建需求失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 受理卡 */}
      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="text-base font-semibold">告诉我你要运的粮</h2>
        <p className="mt-1 text-xs text-ink-soft">
          一句话描述，或直接用下方表单；运小二立刻给出各运输方式的参考运费与时效。
        </p>
        <div className="mt-4 flex gap-3">
          <input
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            placeholder="例如：120 吨东北二等玉米，白城到深圳港，8 月 30 日前要到"
            className="h-11 flex-1 rounded-full border border-line bg-rice px-5 text-sm text-ink placeholder:text-ink-soft/70"
          />
          <button
            type="button"
            onClick={runEstimate}
            disabled={busy}
            className="h-11 rounded-full bg-brand px-7 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "测算中…" : "即时测算"}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <select
            value={form.origin}
            onChange={(e) => setField("origin", e.target.value)}
            className="h-10 rounded-xl border border-line bg-rice px-3 text-sm text-ink"
          >
            <option value="">发货地</option>
            {meta?.nodes.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            value={form.destination}
            onChange={(e) => setField("destination", e.target.value)}
            className="h-10 rounded-xl border border-line bg-rice px-3 text-sm text-ink"
          >
            <option value="">收货地</option>
            {meta?.nodes.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            value={form.variety_code}
            onChange={(e) => setField("variety_code", e.target.value)}
            className="h-10 rounded-xl border border-line bg-rice px-3 text-sm text-ink"
          >
            {meta?.varieties.map((v) => (
              <option key={v.code} value={v.code}>{v.name}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={form.quantity_tons}
            onChange={(e) => setField("quantity_tons", e.target.value)}
            placeholder="数量（吨）"
            className="h-10 rounded-xl border border-line bg-rice px-3 text-sm text-ink placeholder:text-ink-soft/70"
          />
          <input
            type="date"
            value={form.deadline_date}
            onChange={(e) => setField("deadline_date", e.target.value)}
            className="h-10 rounded-xl border border-line bg-rice px-3 text-sm text-ink"
          />
        </div>
        {assumptions.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-ink-soft">
            {assumptions.map((a) => (
              <li key={a}>运小二理解：{a}</li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      {/* 测算结果 */}
      {results.length > 0 && (
        <section className="rounded-3xl border border-line bg-panel p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">测算结果（参考价，非最终报价）</h3>
            <span className="text-xs text-ink-soft">数据更新 {dataDate}</span>
          </div>
          {results.length === 0 ? null : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {results.map((r) => (
                <div
                  key={r.mode}
                  className={`rounded-2xl border p-4 ${
                    r.deadline_ok === false
                      ? "border-red-500/40"
                      : r.deadline_ok
                        ? "border-emerald-500/40"
                        : "border-line"
                  } bg-panel/60`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{r.mode_name}</span>
                    <span className="flex gap-1">
                      {r.tags.map((t) => (
                        <span key={t} className="rounded-full bg-brand-faint px-2 py-0.5 text-[11px] text-brand-deep">
                          {t}
                        </span>
                      ))}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold">
                    ¥{r.price_low}~{r.price_high}
                    <span className="ml-1 text-xs font-normal text-ink-soft">{r.price_unit}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    时效 {r.days_low}~{r.days_high} 天 · 换装 {r.transship_count} 次
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {r.legs.map((l) => `${l.origin}—${l.destination}（${l.mode_name}）`).join(" + ")}
                  </p>
                  {r.deadline_ok === false && (
                    <p className="mt-2 text-xs text-red-400">⚠ 预计超期 {r.over_days} 天，不满足到货期限</p>
                  )}
                  {r.deadline_ok === true && (
                    <p className="mt-2 text-xs text-emerald-400">✓ 满足到货期限</p>
                  )}
                  {r.risk_note && <p className="mt-1 text-[11px] text-ink-soft">{r.risk_note}</p>}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={createRequirement}
              disabled={busy || !form.quantity_tons}
              className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              生成正式运输需求
            </button>
            <button
              type="button"
              onClick={() => {
                setResults([]);
                setEstimateId(null);
              }}
              className="rounded-full border border-line px-6 py-2.5 text-sm text-ink-soft hover:text-ink"
            >
              换个条件再算
            </button>
          </div>
        </section>
      )}

      {/* 底部双栏：热门线路 + 最近测算 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-panel p-6">
          <h3 className="text-sm font-semibold">热门线路参考价</h3>
          <ul className="mt-3 divide-y divide-line/60">
            {hotRoutes.map((h) => (
              <li key={`${h.origin}-${h.destination}-${h.mode}`}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:text-brand-deep"
                  onClick={() => {
                    setField("origin", h.origin);
                    setField("destination", h.destination);
                  }}
                >
                  <span>
                    {h.origin} → {h.destination}
                    <span className="ml-2 text-xs text-ink-soft">{h.mode_name} {h.days_hint}</span>
                  </span>
                  <span className="shrink-0">
                    ¥{h.price_low}~{h.price_high}
                    <span
                      className={`ml-2 text-xs ${
                        h.change_pct > 0 ? "text-red-400" : h.change_pct < 0 ? "text-emerald-400" : "text-ink-soft"
                      }`}
                    >
                      {h.change_pct > 0 ? "+" : ""}{h.change_pct}%
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border border-line bg-panel p-6">
          <h3 className="text-sm font-semibold">最近测算</h3>
          {recent.length === 0 ? (
            <p className="mt-3 text-xs text-ink-soft">还没有测算记录，先在上方算一笔试试。</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recent.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-line/60 px-3 py-2 text-left text-xs hover:border-brand"
                    onClick={() => {
                      setForm({
                        origin: r.origin,
                        destination: r.destination,
                        variety_code: r.variety_code,
                        quantity_tons: String(r.quantity_tons),
                        deadline_date: r.deadline_date ?? "",
                      });
                      setResults(r.results);
                    }}
                  >
                    {r.origin} → {r.destination} · {r.variety_name} {r.quantity_tons} 吨
                    <span className="float-right text-ink-soft">点击恢复</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证类型**

Run: `cd web && npx tsc --noEmit`
Expected: 无输出（通过）

- [ ] **Step 3: 浏览器手动验收（首 tab）**

启动：`cd backend && uv run uvicorn app.main:app --reload --port 8000`（需 Docker MySQL 已启动），另开终端 `cd web && npm run dev`，打开 `/agent/yun`：
- 输入"120 吨玉米，白城到深圳港，8 月 30 日前要到"点即时测算：秒出公路/铁路/公水联运三张卡，联运卡标红超期 ⚠
- 不填任何内容点测算：提示缺关键条件，不产生伪结果
- 点热门线路：受理卡发货地/收货地被预填
- 点最近测算记录：表单与结果恢复

- [ ] **Step 4: 检查点** —— 暂停，请用户确认是否提交。

---

### Task 10: 运输方案与询运对接组件

**Files:**
- Modify: `web/src/features/yun/PlansTab.tsx`（替换占位）
- Modify: `web/src/features/yun/InquiryTab.tsx`（替换占位）

- [ ] **Step 1: 用完整实现替换 `PlansTab.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { createInquiry, explainPlans, fetchTaskDetail } from "./api";
import type { TaskDetail, TransportPlan } from "./types";

interface Props {
  taskId: number | null;
  onInquiryCreated: () => void;
}

export default function PlansTab({ taskId, onInquiryCreated }: Props) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (taskId == null) return;
    setError(null);
    fetchTaskDetail(taskId).then(setDetail).catch((e) => setError(e.message));
  }, [taskId]);

  useEffect(load, [load]);

  if (taskId == null) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
        请先在「找物流」生成正式运输需求，或从「运输任务」打开一个任务。
      </div>
    );
  }
  if (error) {
    return <div className="rounded-3xl border border-line bg-panel/60 p-6 text-sm text-red-400">{error}</div>;
  }
  if (!detail) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
        运小二正在匹配方案…
      </div>
    );
  }

  const { task, plans } = detail;
  const primary = plans.find((p) => p.plan_type === "primary");
  const backup = plans.find((p) => p.plan_type === "backup");
  const rejected = plans.filter((p) => p.plan_type === "rejected");
  const checkItems = primary?.check_items ?? backup?.check_items ?? [];

  const makeInquiry = async (planId: number) => {
    await createInquiry(taskId, planId);
    onInquiryCreated();
  };

  const ask = async () => {
    setBusy(true);
    try {
      const resp = await explainPlans(taskId, question);
      setAnswer(resp.answer);
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "解释失败");
    } finally {
      setBusy(false);
    }
  };

  const routeText = (p: TransportPlan) =>
    p.legs[0].origin + p.legs.map((l) => ` → ${l.destination}（${l.mode_name}）`).join("");

  const PlanCard = ({ plan, tone }: { plan: TransportPlan; tone: "primary" | "backup" }) => (
    <div
      className={`rounded-2xl border p-5 ${
        tone === "primary" ? "border-emerald-500/50" : "border-line"
      } bg-panel/60`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {tone === "primary" ? "主推 · " : "备选 · "}{plan.title}
        </span>
        <span className="text-sm font-semibold">
          ¥{plan.price_low}~{plan.price_high} 元/吨 · {plan.days_low}~{plan.days_high} 天
        </span>
      </div>
      <p className="mt-2 text-xs text-ink-soft">{routeText(plan)}</p>
      <p className="mt-1 text-xs text-ink-soft">
        换装 {plan.transship_count} 次{plan.risk_note ? ` · ${plan.risk_note}` : ""}
      </p>
      <p className="mt-2 text-xs">{plan.reason}</p>
      {tone === "primary" && checkItems.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-ink-soft">
          {checkItems.map((c) => (
            <li key={c}>☐ 待核验：{c}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => makeInquiry(plan.id)}
        className="mt-3 rounded-full bg-brand px-5 py-2 text-xs font-medium text-white"
      >
        选定此方案，生成询运单
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 需求摘要条 */}
      <section className="rounded-3xl border border-line bg-panel px-6 py-4 text-sm">
        {task.origin} → {task.destination} · {task.variety_name} {task.quantity_tons} 吨 ·
        最晚到货 {task.deadline_date ?? "未指定"} ·
        来源：{task.source_type === "handover" ? "粮小二交接" : task.source_type === "estimate" ? "测算转入" : "独立创建"} ·
        <span className="ml-1 text-brand-deep">{task.status_label}</span>
        {task.blocked_note && <span className="ml-2 text-amber-300">{task.blocked_note}</span>}
      </section>

      {primary && <PlanCard plan={primary} tone="primary" />}
      {backup && <PlanCard plan={backup} tone="backup" />}

      {!primary && !backup && (
        <div className="rounded-3xl border border-line bg-panel/60 p-6 text-sm text-ink-soft">
          当前条件下没有可行方案，请参考上方放宽建议调整条件后重新匹配。
        </div>
      )}

      {rejected.length > 0 && (
        <details className="rounded-3xl border border-line bg-panel/60 p-5 text-sm">
          <summary className="cursor-pointer text-sm font-semibold">未入选方案（{rejected.length}）</summary>
          <ul className="mt-3 space-y-2">
            {rejected.map((r) => (
              <li key={r.id} className="text-xs text-ink-soft">
                {r.title}：¥{r.price_low}~{r.price_high} 元/吨 · {r.days_low}~{r.days_high} 天
                <span className="ml-2 text-red-400">{r.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 问运小二 */}
      <section className="rounded-3xl border border-line bg-panel p-5">
        <h3 className="text-sm font-semibold">问运小二</h3>
        <div className="mt-3 flex gap-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例如：为什么主推铁路？到货期限放宽 3 天会怎样？"
            className="h-10 flex-1 rounded-full border border-line bg-rice px-4 text-sm text-ink placeholder:text-ink-soft/70"
          />
          <button
            type="button"
            onClick={ask}
            disabled={busy}
            className="h-10 rounded-full bg-brand px-6 text-sm text-white disabled:opacity-50"
          >
            {busy ? "思考中…" : "提问"}
          </button>
        </div>
        {answer && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{answer}</p>}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 用完整实现替换 `InquiryTab.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { fetchTaskDetail, submitInquiry } from "./api";
import type { TaskDetail } from "./types";

interface Props {
  taskId: number | null;
}

export default function InquiryTab({ taskId }: Props) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (taskId == null) return;
    fetchTaskDetail(taskId).then((d) => {
      setDetail(d);
      if (d.inquiry) setContent(d.inquiry.content);
    });
  }, [taskId]);

  useEffect(load, [load]);

  if (taskId == null || !detail) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
        请先在「运输方案」选定方案并生成询运单。
      </div>
    );
  }
  const inquiry = detail.inquiry;
  if (!inquiry) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
        还没有询运单。请在「运输方案」选定方案后生成。
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      await submitInquiry(inquiry.id);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border border-line bg-panel p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">标准询运单</h2>
          <span className="text-xs text-ink-soft">
            状态：{inquiry.status === "draft" ? "待用户确认" : inquiry.status === "feedback" ? "已反馈" : "已提交"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.entries(content).map(([k, v]) => (
            <label key={k} className="block text-xs">
              <span className="text-ink-soft">{k}</span>
              <input
                value={v}
                disabled={inquiry.status !== "draft"}
                onChange={(e) => setContent((c) => ({ ...c, [k]: e.target.value }))}
                className="mt-1 h-10 w-full rounded-xl border border-line bg-rice px-3 text-sm text-ink disabled:opacity-60"
              />
            </label>
          ))}
        </div>
        {inquiry.status === "draft" && (
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-5 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            确认并提交人工对接
          </button>
        )}
        <p className="mt-2 text-[11px] text-ink-soft">
          提交后进入人工对接流程，不代表承运方已接单或运力已锁定。
        </p>
      </section>

      {inquiry.feedback && (
        <section className="rounded-3xl border border-emerald-500/40 bg-panel p-6">
          <h3 className="text-sm font-semibold">人工反馈</h3>
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            {Object.entries(inquiry.feedback).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-ink-soft">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 验证类型**

Run: `cd web && npx tsc --noEmit`
Expected: 无输出（通过）

- [ ] **Step 4: 浏览器手动验收**
- 从首 tab 生成正式需求 → 自动跳到运输方案：主推铁路卡、备选公路卡、未入选公水联运（超期原因）
- 点"问运小二"提问：无 QWEN_API_KEY 时返回规则版解释（含主推/未入选），不报错
- 选定主推 → 跳询运对接：8 个字段可编辑，提交后反馈面板出现报价与待确认事项，字段变只读
- 未入选方案无"生成询运单"按钮（后端也会 400 拦截）

- [ ] **Step 5: 检查点** —— 暂停，请用户确认是否提交。

---

### Task 11: 运输任务组件与端到端验收

**Files:**
- Modify: `web/src/features/yun/TasksTab.tsx`（替换占位）

- [ ] **Step 1: 用完整实现替换 `TasksTab.tsx`**

```tsx
import { useEffect, useState } from "react";
import { listEstimates, listTasks } from "./api";
import type { EstimateRequest, QuickEstimateRecord, TransportTask } from "./types";

interface Props {
  onOpenTask: (taskId: number) => void;
  onReuseEstimate: (record: QuickEstimateRecord) => void;
}

export default function TasksTab({ onOpenTask, onReuseEstimate }: Props) {
  const [tasks, setTasks] = useState<TransportTask[]>([]);
  const [estimates, setEstimates] = useState<QuickEstimateRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listTasks(), listEstimates()])
      .then(([t, e]) => {
        setTasks(t);
        setEstimates(e);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const restoreEstimate = (r: QuickEstimateRecord): EstimateRequest => ({
    origin: r.origin,
    destination: r.destination,
    variety_code: r.variety_code,
    quantity_tons: r.quantity_tons,
    deadline_date: r.deadline_date,
  });

  if (error) {
    return <div className="rounded-3xl border border-line bg-panel/60 p-6 text-sm text-red-400">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="text-base font-semibold">运输任务</h2>
        {tasks.length === 0 ? (
          <p className="mt-3 text-xs text-ink-soft">还没有运输任务。去「找物流」发起第一笔。</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/60">
            {tasks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onOpenTask(t.id)}
                  className="flex w-full items-center justify-between py-3 text-left text-sm hover:text-brand-deep"
                >
                  <span>
                    {t.origin} → {t.destination} · {t.variety_name} {t.quantity_tons} 吨
                    {t.deadline_date ? ` · 最晚 ${t.deadline_date}` : ""}
                  </span>
                  <span className="shrink-0">
                    <span className="rounded-full bg-brand-faint px-2.5 py-0.5 text-xs text-brand-deep">
                      {t.status_label}
                    </span>
                    {t.blocked_note && (
                      <span className="ml-2 text-xs text-amber-300">{t.blocked_note}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="text-base font-semibold">测算记录（未建任务）</h2>
        {estimates.length === 0 ? (
          <p className="mt-3 text-xs text-ink-soft">还没有测算记录。</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/60">
            {estimates.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  {r.origin} → {r.destination} · {r.variety_name} {r.quantity_tons} 吨
                </span>
                <button
                  type="button"
                  onClick={() => onReuseEstimate({ ...r, ...restoreEstimate(r) })}
                  className="shrink-0 rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft hover:text-ink"
                >
                  恢复重算 / 转正式需求
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 验证类型与全量测试**

Run: `cd web && npx tsc --noEmit`
Expected: 无输出

Run: `cd backend && uv run pytest -v`
Expected: 全部通过（含既有 market/analysis/workflow 用例）

- [ ] **Step 3: 代表场景端到端验收（规格第 10 节）**

启动后端与前端（见 Task 9 Step 3），依次验证：
1. 输入"120 吨东北二等玉米，白城到深圳港，8 月 30 日前要到" → 测算卡：公路 1150~1280（3-4 天）、铁路 500~570（5-7 天✓）、公水联运 305~370（⚠超期 4 天）
2. 生成正式运输需求 → 运输方案：主推铁路、备选公路（含与主推的差异文案）、未入选公水联运（超期原因）、待核验清单 3 项，每个方案可展开参考依据文案（路线/承运服务字段）
3. 问运小二"为什么没选最便宜的？"→ 回答含超期淘汰原因（无 key 时为规则版）
4. 选定主推 → 询运单草稿 8 字段可编辑 → 提交 → 反馈面板（报价/有效期/待确认）
5. 运输任务：任务行状态"已反馈"；测算记录行可恢复回首 tab；刷新页面后任务仍可从列表打开（数据在库）
6. 无匹配路径：把最晚到货改为 2026-08-24 重新建任务 → 方案页无主推，摘要条显示放宽建议，不伪造方案
7. 页面不出现"模拟数据"字样，只有"参考价 / 数据更新"口径；无"已锁定""订舱成功"类表达
8. 粮小二交接路径（首版以模拟入口验证）：调用 `POST /api/logistics/tasks` 时 `source_type=handover` + `source_ref=粮源任务号`，页面摘要条来源显示"粮小二交接"
9. LLM 降级：`backend/.env` 无 QWEN_API_KEY 时，自然语言输入仍可经表单完成全流程，不报错不阻塞（规格 14.5 对应）
10. 刷新后任务上下文：从运输任务列表点开任务 → 运输方案/询运对接内容完整恢复（规格跨 tab 流转规则）

- [ ] **Step 4: 检查点** —— 暂停，请用户确认是否提交。

---

## 自审记录（写计划时已核对）

1. **规格覆盖**：首 tab 三区结构（受理卡/测算结果/双栏）→ Task 9；三种场景路径 → Task 9（只测算/建需求/热门线路）；粮小二交接 → Task 11 验收第 8 步；主推/备选/未入选/待核验/参考依据 → Task 5 + 10；询运单与反馈版本化 → Task 6 + 10；任务列表含测算记录 → Task 11；确认边界（写动作全部由页面按钮触发，模型不调写接口）→ Task 5/6 接口设计与 Task 7 职责限定；异常降级 → 规则层无匹配分支 + llm 降级 + 前端数据未就绪提示；验收场景 7 条 → Task 11 Step 3。
2. **类型一致性**：前后端字段名一致（deadline_ok/over_days/tags/legs/status_label/content/feedback）；`_task_dict`/`_plan_dict`/`_inquiry_dict` 在 Task 5 定义，Task 6/7 复用；`match_plans` 入参 req 字段与 rules 实现一致。
3. **依赖顺序**：Task 5 的 routes 代码已包含 `_inquiry_dict` 定义（避免 Task 6 前 NameError）；autouse seed fixture 在 Task 4 加入、Task 7 移入 conftest 供 test_llm 共用。
4. **已知小修**：执行 Task 3 时，`test_overdue_low_price_never_primary` 内若出现多余的 `req = {...}` 局部变量行，删除即可（直接用 `REQ | {...}` 传参）。
5. **排序口径说明**：到货满足由硬条件保证后，可行方案内按"费用中位 → 时效上限 → 换装次数"排序（规格比较原则同步更新）：代表场景中铁路 5-7 天满足 7 天期限且费用仅为公路一半，应为主推；若按"时效优先"排序会主推贵一倍的公路，不符合采购者真实决策逻辑。


