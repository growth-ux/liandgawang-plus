# 瞻小二「我的关注」Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/agent/zhan` 的「我的关注」Tab 实现独立关注条件管理：创建/列表/重新检查/暂停/恢复/关闭，用固定 `zhan-v1` 演示行情即时判定。

**Architecture:** 后端新增 `workflow` 模块（表 `watch_conditions` + 纯判定函数 + CRUD 路由），沿用 `market` 模块的 dict 返回风格；前端新增 `WatchesTab.tsx` 接入 ZhanPage 的 Tab index 4，沿用 `VarietyMarketTab` 的深色科技风与 `format.ts` 工具。

**Tech Stack:** Python 3.12、FastAPI、SQLAlchemy 2、Pydantic 2、pytest（SQLite 内存库）；React 18、TypeScript（strict + noUnusedLocals）、Tailwind CSS 4。

**注意：** 本项目 CLAUDE.md 规定「禁止自动提交」。以下所有任务的最后一步都是 `git diff --check`（只读检查），**不执行 `git commit`**。后端测试命令统一在 `backend/` 目录下用 `uv run pytest`；前端构建在 `web/` 目录下用 `npm run build`。

---

## Global Constraints

- 关注数据 `data_kind=user_input`、`mock_dataset_version=zhan-v1`；行情来源全部 `simulated`。
- 判定只做确定性比较（价格 vs 阈值、涨跌绝对值 vs 阈值），不访问外网、不调用 LangChain、不做定时轮询。
- 缺库点或价格序列 → `data_pending`，绝不误报"未触发"。
- 不引入软删除、不引入 `request_token` 幂等、不接「我的办事」/「研判记录」/粮小二交接。
- 前端不新增测试框架，验证方式为 `tsc` 类型检查 + `vite build` 通过。

---

## 文件结构与职责

```text
backend/app/workflow/
├── __init__.py        # 空
├── models.py          # WatchCondition 表
├── rules.py           # 纯函数：evaluate_watch_condition / build_trigger_reason / 文案
├── repository.py      # CRUD + refresh_watch（读行情重算，不 commit）
├── routes.py          # /api/watches/*
└── seed.py            # seed_demo_watches（幂等 2 条示例）

backend/app/main.py    # 注册 workflow 路由 + lifespan 调用 seed_demo_watches
backend/tests/conftest.py  # 注册 app.workflow.models 到 Base.metadata

backend/tests/workflow/
├── __init__.py
├── test_rules.py
├── test_repository.py
└── test_routes.py

web/src/features/zhan/
├── types.ts           # Watch 类型
├── api.ts             # fetchWatches / createWatch / updateWatch / evaluateWatch
├── WatchesTab.tsx     # 页面组件
└── ZhanPage.tsx       # Tab index 4 渲染 WatchesTab
```

---

## Task 1: 关注判定纯函数 `rules.py`

**Files:**
- Create: `backend/app/workflow/__init__.py`
- Create: `backend/app/workflow/rules.py`
- Test: `backend/tests/workflow/__init__.py`
- Test: `backend/tests/workflow/test_rules.py`

- [ ] **Step 1: 写失败测试**

`backend/tests/workflow/__init__.py`（空文件）：

```python

```

`backend/tests/workflow/test_rules.py`：

```python
from decimal import Decimal

import pytest

from app.workflow.rules import (
    build_trigger_reason,
    evaluate_watch_condition,
    format_threshold,
)


def test_price_above():
    assert evaluate_watch_condition("price_above", Decimal("2300"), Decimal("2310")) is True
    assert evaluate_watch_condition("price_above", Decimal("2300"), Decimal("2300")) is True
    assert evaluate_watch_condition("price_above", Decimal("2300"), Decimal("2290")) is False


def test_price_below():
    assert evaluate_watch_condition("price_below", Decimal("2300"), Decimal("2290")) is True
    assert evaluate_watch_condition("price_below", Decimal("2300"), Decimal("2310")) is False


def test_day_change_uses_absolute_value():
    assert evaluate_watch_condition("day_change", Decimal("1.0"), Decimal("-1.5")) is True
    assert evaluate_watch_condition("day_change", Decimal("1.0"), Decimal("0.5")) is False


def test_week_change_uses_absolute_value():
    assert evaluate_watch_condition("week_change", Decimal("2.0"), Decimal("2.5")) is True
    assert evaluate_watch_condition("week_change", Decimal("2.0"), Decimal("-2.5")) is True
    assert evaluate_watch_condition("week_change", Decimal("2.0"), Decimal("1.9")) is False


def test_unknown_type_raises():
    with pytest.raises(ValueError):
        evaluate_watch_condition("spread", Decimal("1"), Decimal("1"))


def test_format_threshold():
    assert format_threshold("price_below", Decimal("2300")) == "2300 元/吨"
    assert format_threshold("day_change", Decimal("2")) == "2%"


def test_build_trigger_reason_contains_state():
    reason = build_trigger_reason("price_below", Decimal("2300"), Decimal("2290"), True)
    assert "已触发" in reason
    assert "2300 元/吨" in reason
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/workflow/test_rules.py -q`
Expected: FAIL（`ModuleNotFoundError: app.workflow.rules`）。

- [ ] **Step 3: 实现纯函数**

`backend/app/workflow/__init__.py`（空文件）：

```python

```

`backend/app/workflow/rules.py`：

```python
"""关注条件判定纯函数：只做确定性比较，不访问数据库、不调用 LangChain。"""

from decimal import Decimal

WATCH_TYPES = {"price_above", "price_below", "day_change", "week_change"}

WATCH_TYPE_LABELS = {
    "price_above": "价格高于",
    "price_below": "价格低于",
    "day_change": "日涨跌超过",
    "week_change": "周涨跌超过",
}


def evaluate_watch_condition(watch_type: str, threshold: Decimal, current_value: Decimal) -> bool:
    """确定性判定：是否触发。价格类型做有符号比较，涨跌类型按绝对值比较。"""
    if watch_type == "price_above":
        return current_value >= threshold
    if watch_type == "price_below":
        return current_value <= threshold
    if watch_type in ("day_change", "week_change"):
        return abs(current_value) >= threshold
    raise ValueError(f"未知关注类型：{watch_type}")


def _fmt_num(v: Decimal) -> str:
    """去掉末尾多余的 0：Decimal('2300.00') -> '2300'，Decimal('1.80') -> '1.8'。"""
    s = str(v)
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def format_threshold(watch_type: str, threshold: Decimal) -> str:
    """阈值展示文案。"""
    if watch_type in ("price_above", "price_below"):
        return f"{_fmt_num(threshold)} 元/吨"
    return f"{_fmt_num(threshold)}%"


def build_trigger_reason(
    watch_type: str, threshold: Decimal, current_value: Decimal, triggered: bool
) -> str:
    """触发/未触发说明文案。"""
    label = WATCH_TYPE_LABELS[watch_type]
    thr = format_threshold(watch_type, threshold)
    if watch_type in ("price_above", "price_below"):
        cur = f"{_fmt_num(current_value)} 元/吨"
    else:
        cur = f"{current_value:+.1f}%"
    state = "已触发" if triggered else "暂未触发"
    return f"{label}阈值 {thr}，当前 {cur}，{state}"
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && uv run pytest tests/workflow/test_rules.py -q`
Expected: PASS（8 个测试全绿）。

- [ ] **Step 5: 检查差异**

Run: `cd /Users/tiger/PycharmProjects/liangda/liangdawang-plus && git diff --check`
Expected: 无输出（无空白错误）。

---

## Task 2: 关注表模型 `WatchCondition`

**Files:**
- Create: `backend/app/workflow/models.py`
- Modify: `backend/app/main.py`（注册模型 import）
- Modify: `backend/tests/conftest.py`（注册模型 import）
- Test: `backend/tests/workflow/test_repository.py`

- [ ] **Step 1: 写失败测试**

`backend/tests/workflow/test_repository.py`：

```python
from decimal import Decimal

from app.workflow.models import WatchCondition


def test_watch_condition_persists(db_session):
    w = WatchCondition(
        watch_code="WATCH-TEST-01",
        variety_code="corn",
        variety_name="玉米",
        spot_code="ZHAN-V1-CORN-01",
        region_name="黑龙江·绥化",
        quote_type="收购价",
        watch_type="price_below",
        threshold=Decimal("2300"),
        status="monitoring",
        data_kind="user_input",
        mock_dataset_version="zhan-v1",
    )
    db_session.add(w)
    db_session.commit()
    assert w.id is not None
    assert w.watch_code == "WATCH-TEST-01"
    assert w.data_kind == "user_input"
    assert w.mock_dataset_version == "zhan-v1"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/workflow/test_repository.py -q`
Expected: FAIL（`ModuleNotFoundError: app.workflow.models`，且表未注册）。

- [ ] **Step 3: 实现模型**

`backend/app/workflow/models.py`：

```python
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WatchCondition(Base):
    """行情关注条件：用户针对某库点设置的价格或涨跌阈值关注。"""

    __tablename__ = "watch_conditions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    watch_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    variety_code: Mapped[str] = mapped_column(String(32), index=True)
    variety_name: Mapped[str] = mapped_column(String(32))
    spot_code: Mapped[str] = mapped_column(String(64), index=True)
    region_name: Mapped[str] = mapped_column(String(64))
    quote_type: Mapped[str] = mapped_column(String(16))
    watch_type: Mapped[str] = mapped_column(String(32))
    threshold: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(16), default="monitoring")
    current_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    triggered_reason: Mapped[str] = mapped_column(Text, default="")
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    data_kind: Mapped[str] = mapped_column(String(16), default="user_input")
    mock_dataset_version: Mapped[str] = mapped_column(String(32), default="zhan-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 4: 注册模型到 main 与测试**

`backend/tests/conftest.py`，在 `import app.market.models` 后新增一行：

```python
import app.workflow.models  # noqa: F401  注册表到 Base.metadata
```

（`backend/app/main.py` 的注册在 Task 4 统一完成，本任务先保证测试可建表。）

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && uv run pytest tests/workflow/test_repository.py -q`
Expected: PASS。

- [ ] **Step 6: 检查差异**

Run: `git diff --check`
Expected: 无输出。

---

## Task 3: 关注仓储 `repository.py`（含行情重算）

**Files:**
- Create: `backend/app/workflow/repository.py`
- Modify: `backend/tests/workflow/test_repository.py`（追加 refresh_watch 测试）

- [ ] **Step 1: 写失败测试**

在 `backend/tests/workflow/test_repository.py` 末尾追加：

```python
from app.market.mock_seed import seed_zhan_mock_data
from app.workflow import repository


def test_refresh_watch_triggers_price_below(db_session):
    seed_zhan_mock_data(db_session)
    w = WatchCondition(
        watch_code="WATCH-TRIG",
        variety_code="corn",
        variety_name="玉米",
        spot_code="ZHAN-V1-CORN-01",
        region_name="黑龙江·绥化",
        quote_type="收购价",
        watch_type="price_below",
        threshold=Decimal("99999"),
        status="monitoring",
        data_kind="user_input",
        mock_dataset_version="zhan-v1",
    )
    db_session.add(w)
    db_session.commit()
    repository.refresh_watch(db_session, w)
    db_session.commit()
    assert w.status == "triggered"
    assert w.current_value is not None
    assert "已触发" in w.triggered_reason


def test_refresh_watch_data_pending_when_spot_missing(db_session):
    seed_zhan_mock_data(db_session)
    w = WatchCondition(
        watch_code="WATCH-MISSING",
        variety_code="corn",
        variety_name="玉米",
        spot_code="NO-SUCH-SPOT",
        region_name="未知",
        quote_type="收购价",
        watch_type="price_below",
        threshold=Decimal("2300"),
        status="monitoring",
        data_kind="user_input",
        mock_dataset_version="zhan-v1",
    )
    db_session.add(w)
    db_session.commit()
    repository.refresh_watch(db_session, w)
    db_session.commit()
    assert w.status == "data_pending"
    assert w.current_value is None


def test_refresh_watch_skips_paused(db_session):
    seed_zhan_mock_data(db_session)
    w = WatchCondition(
        watch_code="WATCH-PAUSED",
        variety_code="corn",
        variety_name="玉米",
        spot_code="ZHAN-V1-CORN-01",
        region_name="黑龙江·绥化",
        quote_type="收购价",
        watch_type="price_below",
        threshold=Decimal("2300"),
        status="paused",
        current_value=Decimal("2310"),
        triggered_reason="暂停前",
        data_kind="user_input",
        mock_dataset_version="zhan-v1",
    )
    db_session.add(w)
    db_session.commit()
    repository.refresh_watch(db_session, w)
    db_session.commit()
    assert w.status == "paused"
    assert w.triggered_reason == "暂停前"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/workflow/test_repository.py -q`
Expected: FAIL（`ModuleNotFoundError: app.workflow.repository`）。

- [ ] **Step 3: 实现仓储**

`backend/app/workflow/repository.py`：

```python
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.market.metrics import pct_change
from app.market.repository import get_price_series, get_spot
from app.workflow.models import WatchCondition
from app.workflow.rules import build_trigger_reason, evaluate_watch_condition


def list_watches(db: Session) -> list[WatchCondition]:
    return db.scalars(select(WatchCondition).order_by(WatchCondition.id)).all()


def get_watch(db: Session, watch_id: int) -> WatchCondition | None:
    return db.get(WatchCondition, watch_id)


def _current_value(db: Session, watch: WatchCondition) -> Decimal | None:
    """读取关注对应库点的当前值（价格或涨跌%）。缺数据返回 None。"""
    if watch.watch_type in ("price_above", "price_below"):
        spot = get_spot(db, watch.variety_code, watch.spot_code)
        return spot.price if spot else None
    if watch.watch_type == "day_change":
        spot = get_spot(db, watch.variety_code, watch.spot_code)
        return spot.change_pct if spot else None
    # week_change：库点序列最近一天 vs 8 天前
    points = get_price_series(db, watch.spot_code)
    if len(points) < 8:
        return None
    return pct_change(points[-1].price, points[-8].price)


def refresh_watch(db: Session, watch: WatchCondition) -> None:
    """用当前演示行情重算关注状态（不 commit，由调用方提交）。暂停/关闭不重算。"""
    if watch.status in ("paused", "closed"):
        return
    value = _current_value(db, watch)
    if value is None:
        watch.status = "data_pending"
        watch.current_value = None
        watch.triggered_reason = "演示数据集中缺少该库点的价格或序列，暂无法判断"
    else:
        triggered = evaluate_watch_condition(watch.watch_type, watch.threshold, value)
        watch.status = "triggered" if triggered else "monitoring"
        watch.current_value = value
        watch.triggered_reason = build_trigger_reason(
            watch.watch_type, watch.threshold, value, triggered
        )
    watch.last_checked_at = datetime.now()
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && uv run pytest tests/workflow/test_repository.py -q`
Expected: PASS。

- [ ] **Step 5: 检查差异**

Run: `git diff --check`
Expected: 无输出。

---

## Task 4: 预置示例关注 `seed.py`

**Files:**
- Create: `backend/app/workflow/seed.py`
- Modify: `backend/app/main.py`（注册 workflow 模型 import + 路由 + seed）
- Modify: `backend/app/workflow/routes.py`（本任务仅占位，Task 5 实现）→ 见 Step 4 说明

> 说明：`seed_demo_watches` 依赖 `repository.refresh_watch` 判定状态；`main.py` 需要在 lifespan 里先 `seed_zhan_mock_data` 再 `seed_demo_watches`。`routes.py` 在 Task 5 实现，本任务先不创建，避免 main 导入失败——`main.py` 的 `include_router` 也在 Task 5 统一加。

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/workflow/test_routes.py`（本任务先写 seed 相关测试，routes 测试在 Task 5 追加）：

```python
from app.market.mock_seed import seed_zhan_mock_data
from app.workflow.models import WatchCondition
from app.workflow.seed import seed_demo_watches


def test_seed_demo_watches_idempotent(db_session):
    seed_zhan_mock_data(db_session)
    seed_demo_watches(db_session)
    first = db_session.query(WatchCondition).count()
    seed_demo_watches(db_session)
    assert db_session.query(WatchCondition).count() == first == 2


def test_seed_demo_one_triggered_one_monitoring(db_session):
    seed_zhan_mock_data(db_session)
    seed_demo_watches(db_session)
    watches = db_session.query(WatchCondition).all()
    statuses = {w.status for w in watches}
    assert statuses == {"triggered", "monitoring"}
    assert all(w.data_kind == "user_input" for w in watches)
    assert all(w.mock_dataset_version == "zhan-v1" for w in watches)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/workflow/test_routes.py -q`
Expected: FAIL（`ModuleNotFoundError: app.workflow.seed`）。

- [ ] **Step 3: 实现 seed**

`backend/app/workflow/seed.py`：

```python
"""预置 2 条示例关注：1 条已触发 + 1 条监测中（幂等）。"""

from sqlalchemy.orm import Session

from app.market.repository import get_spot
from app.workflow import repository
from app.workflow.models import WatchCondition


def seed_demo_watches(db: Session) -> None:
    """已存在任意关注则跳过，避免覆盖用户数据。"""
    if db.query(WatchCondition).count() > 0:
        return
    suihua = get_spot(db, "corn", "ZHAN-V1-CORN-01")
    dalian = get_spot(db, "corn", "ZHAN-V1-CORN-04")
    if suihua is None or dalian is None:
        return
    watches = [
        # 已触发：价格低于（当前价 + 40），当前价必然 ≤ 阈值
        WatchCondition(
            watch_code="WATCH-CORN-01",
            variety_code=suihua.variety_code,
            variety_name=suihua.variety_name,
            spot_code=suihua.spot_code,
            region_name=suihua.region_name,
            quote_type=suihua.quote_type,
            watch_type="price_below",
            threshold=suihua.price + 40,
            status="monitoring",
            data_kind="user_input",
            mock_dataset_version="zhan-v1",
        ),
        # 监测中：价格高于（当前价 + 80），当前价必然 < 阈值
        WatchCondition(
            watch_code="WATCH-CORN-02",
            variety_code=dalian.variety_code,
            variety_name=dalian.variety_name,
            spot_code=dalian.spot_code,
            region_name=dalian.region_name,
            quote_type=dalian.quote_type,
            watch_type="price_above",
            threshold=dalian.price + 80,
            status="monitoring",
            data_kind="user_input",
            mock_dataset_version="zhan-v1",
        ),
    ]
    for w in watches:
        db.add(w)
    db.commit()
    for w in watches:
        repository.refresh_watch(db, w)
    db.commit()
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && uv run pytest tests/workflow/test_routes.py -q`
Expected: PASS。

- [ ] **Step 5: 检查差异**

Run: `git diff --check`
Expected: 无输出。

---

## Task 5: 关注 API 路由 `routes.py`

**Files:**
- Create: `backend/app/workflow/routes.py`
- Modify: `backend/app/main.py`（注册 workflow 模型 import + 路由 + lifespan seed）
- Modify: `backend/tests/workflow/test_routes.py`（追加 API 测试）

- [ ] **Step 1: 写失败测试**

在 `backend/tests/workflow/test_routes.py` 末尾追加：

```python
from app.workflow.models import WatchCondition


def _seed(client, db_session):
    seed_zhan_mock_data(db_session)
    seed_demo_watches(db_session)
    db_session.commit()


def test_list_watches(client, db_session):
    _seed(client, db_session)
    resp = client.get("/api/watches")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    w = body[0]
    assert set(w) == {
        "id",
        "watch_code",
        "variety_code",
        "variety_name",
        "spot_code",
        "region_name",
        "quote_type",
        "watch_type",
        "watch_type_label",
        "threshold",
        "status",
        "current_value",
        "triggered_reason",
        "last_checked_at",
        "data_kind",
        "mock_dataset_version",
    }


def test_create_watch_evaluates_immediately(client, db_session):
    _seed(client, db_session)
    resp = client.post(
        "/api/watches",
        json={
            "variety_code": "corn",
            "spot_code": "ZHAN-V1-CORN-01",
            "watch_type": "price_above",
            "threshold": 99999,
        },
    )
    assert resp.status_code == 200
    w = resp.json()
    assert w["status"] == "monitoring"
    assert w["watch_type_label"] == "价格高于"
    assert w["current_value"] is not None
    assert w["data_kind"] == "user_input"


def test_create_watch_unknown_type_422(client, db_session):
    _seed(client, db_session)
    resp = client.post(
        "/api/watches",
        json={
            "variety_code": "corn",
            "spot_code": "ZHAN-V1-CORN-01",
            "watch_type": "spread",
            "threshold": 1,
        },
    )
    assert resp.status_code == 422


def test_create_watch_unknown_spot_404(client, db_session):
    _seed(client, db_session)
    resp = client.post(
        "/api/watches",
        json={
            "variety_code": "corn",
            "spot_code": "NOPE",
            "watch_type": "price_below",
            "threshold": 2300,
        },
    )
    assert resp.status_code == 404


def test_patch_status_and_threshold(client, db_session):
    _seed(client, db_session)
    wid = client.get("/api/watches").json()[0]["id"]
    resp = client.patch(f"/api/watches/{wid}", json={"status": "paused"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "paused"
    # 暂停后的关注，重新检查不改状态
    resp2 = client.post(f"/api/watches/{wid}/evaluate")
    assert resp2.json()["status"] == "paused"


def test_evaluate_unknown_404(client, db_session):
    _seed(client, db_session)
    assert client.post("/api/watches/9999/evaluate").status_code == 404
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/workflow/test_routes.py -q`
Expected: FAIL（`/api/watches` 返回 404，因路由未注册）。

- [ ] **Step 3: 实现路由**

`backend/app/workflow/routes.py`：

```python
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.market.repository import get_spot
from app.workflow import repository
from app.workflow.models import WatchCondition
from app.workflow.rules import WATCH_TYPE_LABELS, WATCH_TYPES

router = APIRouter(prefix="/api/watches", tags=["watches"])


class WatchCreate(BaseModel):
    variety_code: str
    spot_code: str
    watch_type: str
    threshold: float = Field(gt=0)


class WatchUpdate(BaseModel):
    status: str | None = None
    threshold: float | None = Field(default=None, gt=0)


def _serialize(watch: WatchCondition) -> dict:
    return {
        "id": watch.id,
        "watch_code": watch.watch_code,
        "variety_code": watch.variety_code,
        "variety_name": watch.variety_name,
        "spot_code": watch.spot_code,
        "region_name": watch.region_name,
        "quote_type": watch.quote_type,
        "watch_type": watch.watch_type,
        "watch_type_label": WATCH_TYPE_LABELS.get(watch.watch_type, watch.watch_type),
        "threshold": str(watch.threshold),
        "status": watch.status,
        "current_value": str(watch.current_value) if watch.current_value is not None else None,
        "triggered_reason": watch.triggered_reason,
        "last_checked_at": watch.last_checked_at.isoformat() if watch.last_checked_at else None,
        "data_kind": watch.data_kind,
        "mock_dataset_version": watch.mock_dataset_version,
    }


@router.get("")
def list_watches(db: Session = Depends(get_db)):
    """打开页面时用当前演示行情重算每条关注状态。"""
    watches = repository.list_watches(db)
    for w in watches:
        repository.refresh_watch(db, w)
    db.commit()
    return [_serialize(w) for w in watches]


@router.post("")
def create_watch(body: WatchCreate, db: Session = Depends(get_db)):
    if body.watch_type not in WATCH_TYPES:
        raise HTTPException(status_code=422, detail="未知关注类型")
    spot = get_spot(db, body.variety_code, body.spot_code)
    if spot is None:
        raise HTTPException(status_code=404, detail="库点不存在")
    watch = WatchCondition(
        watch_code=f"WATCH-{uuid.uuid4().hex[:8].upper()}",
        variety_code=spot.variety_code,
        variety_name=spot.variety_name,
        spot_code=spot.spot_code,
        region_name=spot.region_name,
        quote_type=spot.quote_type,
        watch_type=body.watch_type,
        threshold=Decimal(str(round(body.threshold, 2))),
        status="monitoring",
        data_kind="user_input",
        mock_dataset_version="zhan-v1",
    )
    db.add(watch)
    db.flush()
    repository.refresh_watch(db, watch)
    db.commit()
    db.refresh(watch)
    return _serialize(watch)


@router.patch("/{watch_id}")
def update_watch(watch_id: int, body: WatchUpdate, db: Session = Depends(get_db)):
    watch = repository.get_watch(db, watch_id)
    if watch is None:
        raise HTTPException(status_code=404, detail="关注不存在")
    if body.status is not None:
        if body.status not in ("monitoring", "paused", "closed"):
            raise HTTPException(status_code=422, detail="未知状态")
        watch.status = body.status
    if body.threshold is not None:
        watch.threshold = Decimal(str(round(body.threshold, 2)))
    repository.refresh_watch(db, watch)
    db.commit()
    db.refresh(watch)
    return _serialize(watch)


@router.post("/{watch_id}/evaluate")
def evaluate_watch(watch_id: int, db: Session = Depends(get_db)):
    watch = repository.get_watch(db, watch_id)
    if watch is None:
        raise HTTPException(status_code=404, detail="关注不存在")
    repository.refresh_watch(db, watch)
    db.commit()
    db.refresh(watch)
    return _serialize(watch)
```

- [ ] **Step 4: 注册路由与 seed 到 main**

修改 `backend/app/main.py`：

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, SessionLocal, engine
from app.market import models  # noqa: F401  注册表
from app.market.mock_seed import seed_zhan_mock_data
from app.market.routes import router as market_router
from app.workflow import models as workflow_models  # noqa: F401  注册表
from app.workflow.routes import router as workflow_router
from app.workflow.seed import seed_demo_watches


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    try:
        with SessionLocal() as db:
            seed_zhan_mock_data(db)
            seed_demo_watches(db)
    except Exception:
        # 初始化失败不阻止启动（无 MySQL 的测试环境跳过），页面自行提示数据未就绪。
        pass
    yield


app = FastAPI(title="粮达网 Plus", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market_router)
app.include_router(workflow_router)
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && uv run pytest tests/workflow/test_routes.py -q`
Expected: PASS。

- [ ] **Step 6: 检查差异**

Run: `git diff --check`
Expected: 无输出。

---

## Task 6: 前端类型与 API Client

**Files:**
- Modify: `web/src/features/zhan/types.ts`
- Modify: `web/src/features/zhan/api.ts`

- [ ] **Step 1: 追加 Watch 类型**

在 `web/src/features/zhan/types.ts` 末尾追加：

```ts
export type WatchType = "price_above" | "price_below" | "day_change" | "week_change";
export type WatchStatus = "monitoring" | "triggered" | "paused" | "closed" | "data_pending";

export interface Watch {
  id: number;
  watch_code: string;
  variety_code: string;
  variety_name: string;
  spot_code: string;
  region_name: string;
  quote_type: string;
  watch_type: WatchType;
  watch_type_label: string;
  threshold: string;
  status: WatchStatus;
  current_value: string | null;
  triggered_reason: string;
  last_checked_at: string | null;
  data_kind: "user_input";
  mock_dataset_version: string;
}
```

- [ ] **Step 2: 追加 API 函数**

在 `web/src/features/zhan/api.ts` 末尾追加：

```ts
import type { Watch } from "./types";

export async function fetchWatches(): Promise<Watch[]> {
  const resp = await fetch("/api/watches");
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function createWatch(input: {
  variety_code: string;
  spot_code: string;
  watch_type: string;
  threshold: number;
}): Promise<Watch> {
  const resp = await fetch("/api/watches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function updateWatch(
  id: number,
  input: { status?: string; threshold?: number },
): Promise<Watch> {
  const resp = await fetch(`/api/watches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function evaluateWatch(id: number): Promise<Watch> {
  const resp = await fetch(`/api/watches/${id}/evaluate`, { method: "POST" });
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}
```

注意：`api.ts` 顶部已 `import type { MarketOverview, PriceSeriesResponse } from "./types";`，把 `Watch` 并入该 import 而不是新开 import 行。完整顶部应为：

```ts
import type { MarketOverview, PriceSeriesResponse, Watch } from "./types";
```

- [ ] **Step 3: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 4: 检查差异**

Run: `git diff --check`
Expected: 无输出。

---

## Task 7: 前端页面组件 `WatchesTab.tsx` 与接入

**Files:**
- Create: `web/src/features/zhan/WatchesTab.tsx`
- Modify: `web/src/features/zhan/ZhanPage.tsx`

- [ ] **Step 1: 实现组件**

`web/src/features/zhan/WatchesTab.tsx`：

```tsx
import { useEffect, useState } from "react";
import {
  createWatch,
  evaluateWatch,
  fetchMarketOverview,
  fetchWatches,
  updateWatch,
} from "./api";
import { VARIETIES, type SpotPrice, type Watch, type WatchType } from "./types";

const WATCH_TYPE_OPTIONS: { value: WatchType; label: string; unit: string }[] = [
  { value: "price_above", label: "价格高于", unit: "元/吨" },
  { value: "price_below", label: "价格低于", unit: "元/吨" },
  { value: "day_change", label: "日涨跌超过", unit: "%" },
  { value: "week_change", label: "周涨跌超过", unit: "%" },
];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  monitoring: { label: "监测中", tone: "bg-sky-400/15 text-sky-300" },
  triggered: { label: "已触发", tone: "bg-amber-400/15 text-amber-300" },
  paused: { label: "已暂停", tone: "bg-rice-deep text-ink-soft" },
  closed: { label: "已关闭", tone: "bg-rice-deep text-ink-soft" },
  data_pending: { label: "数据待补充", tone: "bg-amber-400/10 text-amber-300/80" },
};

function stripZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

function isPriceType(t: WatchType): boolean {
  return t === "price_above" || t === "price_below";
}

function fmtThreshold(w: Watch): string {
  const v = stripZeros(w.threshold);
  return isPriceType(w.watch_type) ? `${v} 元/吨` : `${v}%`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

export default function WatchesTab() {
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [variety, setVariety] = useState("corn");
  const [spots, setSpots] = useState<SpotPrice[]>([]);
  const [spotCode, setSpotCode] = useState("");
  const [watchType, setWatchType] = useState<WatchType>("price_below");
  const [threshold, setThreshold] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    try {
      setWatches(await fetchWatches());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }

  useEffect(() => {
    load();
  }, []);

  // 品种变化 → 拉取该品种库点，默认选第一个
  useEffect(() => {
    let cancelled = false;
    setSpots([]);
    setSpotCode("");
    fetchMarketOverview(variety)
      .then((d) => {
        if (cancelled) return;
        setSpots(d.spots);
        setSpotCode(d.spots[0]?.spot_code ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [variety]);

  async function handleCreate() {
    const t = Number(threshold);
    if (!spotCode || !threshold || Number.isNaN(t) || t <= 0) {
      setFormError("请选择库点并填写大于 0 的阈值");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createWatch({
        variety_code: variety,
        spot_code: spotCode,
        watch_type: watchType,
        threshold: t,
      });
      setThreshold("");
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatus(id: number, status: string) {
    await updateWatch(id, { status });
    await load();
  }

  async function handleEvaluate(id: number) {
    await evaluateWatch(id);
    await load();
  }

  const activeUnit = WATCH_TYPE_OPTIONS.find((o) => o.value === watchType)?.unit ?? "";

  return (
    <div className="flex flex-col gap-4">
      {/* 说明条 */}
      <div className="rounded-xl border border-dashed border-line bg-panel/40 px-4 py-3 text-xs leading-6 text-ink-soft">
        当前检查基于固定 zhan-v1 演示行情，不会获取或生成新行情。
      </div>

      {/* 新建关注 */}
      <div className="rounded-2xl border border-line bg-panel p-5">
        {!formOpen ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="rounded-full bg-tech px-6 py-2.5 text-sm font-semibold text-rice transition-colors hover:brightness-110"
          >
            ＋ 新建关注
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-sm font-semibold">新建关注</div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-soft">品种</span>
              {VARIETIES.map((v) => (
                <button
                  key={v.code}
                  type="button"
                  onClick={() => setVariety(v.code)}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    variety === v.code
                      ? "bg-tech font-semibold text-rice"
                      : "border border-line bg-rice text-ink-soft hover:text-ink"
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-ink-soft">库点</span>
              <select
                value={spotCode}
                onChange={(e) => setSpotCode(e.target.value)}
                className="rounded-xl border border-line bg-rice px-3.5 py-2 text-sm text-ink"
              >
                {spots.map((s) => (
                  <option key={s.spot_code} value={s.spot_code}>
                    {s.region_name} · {s.quote_type}（当前 {stripZeros(s.price)} 元/吨）
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-ink-soft">条件类型</span>
              <select
                value={watchType}
                onChange={(e) => setWatchType(e.target.value as WatchType)}
                className="rounded-xl border border-line bg-rice px-3.5 py-2 text-sm text-ink"
              >
                {WATCH_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-ink-soft">阈值（{activeUnit}）</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="例如 2300"
                className="rounded-xl border border-line bg-rice px-3.5 py-2 text-sm text-ink placeholder:text-ink-soft/60"
              />
            </label>

            {formError && <p className="text-xs text-red-400">{formError}</p>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
              >
                {submitting ? "提交中…" : "创建并检查"}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-full border border-line px-6 py-2.5 text-sm text-ink-soft hover:text-ink"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 列表 / 加载 / 错误 / 空态 */}
      {error ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <p className="text-sm text-red-400">关注加载失败：{error}</p>
          <p className="mt-2 text-xs text-ink-soft">请确认后端服务已启动、本地数据库已初始化。</p>
        </div>
      ) : !watches ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-sm text-ink-soft">
          正在读取关注…
        </div>
      ) : watches.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <p className="text-sm text-ink-soft">还没有关注，点击上方「新建关注」开始</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {watches.map((w) => {
            const meta = STATUS_META[w.status] ?? STATUS_META.monitoring;
            const active = w.status === "monitoring" || w.status === "triggered";
            return (
              <div key={w.id} className="rounded-2xl border border-line bg-panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {w.variety_name} · {w.region_name}
                      </span>
                      <span className="rounded-full bg-rice-deep px-2 py-0.5 text-xs text-ink-soft">
                        {w.quote_type}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.tone}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink">
                      {w.watch_type_label}{" "}
                      <span className="font-semibold text-tech">{fmtThreshold(w)}</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">{w.triggered_reason}</p>
                    <p className="mt-1 text-xs text-ink-soft">最近检查 {fmtTime(w.last_checked_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {active && (
                      <button
                        type="button"
                        onClick={() => handleEvaluate(w.id)}
                        className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:text-ink"
                      >
                        重新检查
                      </button>
                    )}
                    {w.status !== "closed" && (
                      <button
                        type="button"
                        onClick={() => handleStatus(w.id, w.status === "paused" ? "monitoring" : "paused")}
                        className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:text-ink"
                      >
                        {w.status === "paused" ? "恢复" : "暂停"}
                      </button>
                    )}
                    {w.status !== "closed" && (
                      <button
                        type="button"
                        onClick={() => handleStatus(w.id, "closed")}
                        className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:text-red-400"
                      >
                        关闭
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 接入 ZhanPage**

修改 `web/src/features/zhan/ZhanPage.tsx`：

1. 顶部 import 区新增：

```tsx
import WatchesTab from "./WatchesTab";
```

2. 内容渲染分支，把原来的：

```tsx
        {activeTab === 1 ? (
          <VarietyMarketTab
            varietyCode={varietyCode}
            onVarietyChange={setVarietyCode}
          />
        ) : activeTab !== 0 ? (
```

改为：

```tsx
        {activeTab === 1 ? (
          <VarietyMarketTab
            varietyCode={varietyCode}
            onVarietyChange={setVarietyCode}
          />
        ) : activeTab === 4 ? (
          <WatchesTab />
        ) : activeTab !== 0 ? (
```

（`activeTab === 4` 对应 tabs 数组 `["市场全景","品种行情","区域价差","影响因素","我的关注","研判记录"]` 中的「我的关注」。）

- [ ] **Step 3: 构建与类型检查**

Run: `cd web && npm run build`
Expected: `tsc` 与 `vite build` 均成功，无报错。

- [ ] **Step 4: 检查差异**

Run: `git diff --check`
Expected: 无输出。

---

## Task 8: 全量验证

**Files:** 无新增（只跑验证命令）。

- [ ] **Step 1: 后端全量测试**

Run: `cd backend && uv run pytest -q`
Expected: 全部 PASS（含既有 market 测试与新 workflow 测试）。

- [ ] **Step 2: 前端构建**

Run: `cd web && npm run build`
Expected: 成功。

- [ ] **Step 3: 误导文案审计**

Run: `rg -n "实时|官方价格|公开事实|刚刚同步|数据已刷新" web/src/features/zhan backend/app/workflow`
Expected: 无匹配。

- [ ] **Step 4: 差异检查**

Run: `git diff --check && git status --short`
Expected: `git diff --check` 无输出；`git status --short` 列出本次改动文件（不自动提交）。

---

## 执行顺序与依赖

```text
Task 1 rules 纯函数
  └─ Task 2 WatchCondition 模型
       └─ Task 3 repository（依赖 market 数据）
            └─ Task 4 seed（依赖 repository）
                 └─ Task 5 routes + main 注册（依赖 seed/repository）
                      └─ Task 6 前端 types/api
                           └─ Task 7 WatchesTab + 接入
                                └─ Task 8 全量验证
```

## 完成定义

- `/agent/zhan` 切到「我的关注」能看到 2 条预置示例（1 触发 + 1 监测）。
- 新建关注后立即显示 `monitoring` 或 `triggered`。
- 「重新检查」只重算，不出现任何"实时/刷新/同步"文案。
- 暂停/恢复/关闭交互正常，暂停/关闭的关注不被重算覆盖状态。
- 缺数据关注进入 `data_pending`，不误报"未触发"。
- 后端 `uv run pytest` 全绿，前端 `npm run build` 通过。
- 不自动 Git commit。
