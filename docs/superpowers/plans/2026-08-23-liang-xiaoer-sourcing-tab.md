# 粮小二「寻源任务」Tab（DAG 编排版）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把寻源流程做成可视化 DAG 工作流——自然语言一句话触发，粮小二按 8 节点 DAG 逐步执行、实时展示进度与中间产物，最终产出主推/备选/淘汰/待核验，并可保存为任务、交接运小二（结构化 mock）。

**Architecture:** 前端确定性执行引擎（复用 `parseNeed` + `compareListings`），用定时器按拓扑批次逐步揭示节点状态；后端新增单表 `sourcing_tasks`（JSON 存 need/plan/handoff）承接保存与交接。供应方 Tab 移除，寻源任务接 `agents.ts` index 2。

**Tech Stack:** FastAPI + SQLAlchemy + MySQL（测试用 SQLite）、React + TypeScript + Tailwind、pytest（后端）。前端无测试框架，用 `npm run build`（tsc）验证类型。

**约定:** 遵循 CLAUDE.md「禁止自动提交」——所有任务完成以测试/构建通过为准，不执行 `git commit`。

---

## 文件结构

**后端：**
- 修改 `backend/app/liang/models.py`：新增 `SourcingTask` 模型。
- 修改 `backend/app/liang/repository.py`：新增 `create_task` / `list_tasks` / `get_task` / `apply_handoff`。
- 修改 `backend/app/liang/routes.py`：新增 4 个任务接口。
- 新建 `backend/tests/liang/test_tasks.py`：任务接口测试。

**前端：**
- 修改 `web/src/features/liang/types.ts`：新增任务相关类型。
- 修改 `web/src/features/liang/api.ts`：新增 4 个任务 API 函数。
- 新建 `web/src/features/liang/workflow.ts`：DAG 节点定义 + 批次 + 方案快照构造。
- 新建 `web/src/features/liang/DagCanvas.tsx`：SVG DAG 画布。
- 新建 `web/src/features/liang/SourcingTab.tsx`：主组件（输入 + 编排 + 产出面板 + 结论 + 历史）。
- 修改 `web/src/features/liang/LiangPage.tsx`：接入 `activeTab === 2`。
- 修改 `web/src/data/agents.ts`：粮小二 tabs 移除「供应方」。

---

## 后端

### Task 1: 定义 `SourcingTask` 模型

**Files:**
- Modify: `backend/app/liang/models.py`

- [ ] **Step 1: 修改 models.py 的 import 行**

将文件顶部的 SQLAlchemy import 增加 `JSON`：

```python
from sqlalchemy import JSON, Date, DateTime, Integer, Numeric, String, func
```

- [ ] **Step 2: 在文件末尾追加 `SourcingTask` 模型**

在 `GrainListing` 类之后追加：

```python
class SourcingTask(Base):
    """寻源任务：自然语言需求 + DAG 执行得到的方案快照 + 可选交接。"""

    __tablename__ = "sourcing_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="completed")  # completed / handed_off
    need: Mapped[dict] = mapped_column(JSON)  # 需求条件快照
    plan: Mapped[dict] = mapped_column(JSON)  # 方案快照（主推/备选/淘汰/待核验）
    handoff: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # 交接快照
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 3: 验证模型可被导入且无语法错误**

Run: `cd backend && python -c "from app.liang.models import SourcingTask; print(SourcingTask.__tablename__)"`
Expected: 输出 `sourcing_tasks`

---

### Task 2: repository 层（任务读写 + 交接）

**Files:**
- Modify: `backend/app/liang/repository.py`
- Test: `backend/tests/liang/test_tasks.py`

- [ ] **Step 1: 写失败测试（repository 行为通过接口间接验证，先建测试文件）**

Create `backend/tests/liang/test_tasks.py`：

```python
"""寻源任务接口测试：创建、列表、详情、交接、交接前置校验。"""

from app.liang.models import SourcingTask  # noqa: F401  注册表到 Base.metadata


def _need():
    return {"variety": "玉米", "quantity_tons": 120, "grade": "二等"}


def _plan():
    return {
        "need_summary": {"variety": "玉米", "quantity_tons": 120, "grade": "二等"},
        "primary": {
            "listing_code": "LIANG-V1-001",
            "variety_name": "玉米",
            "grade": "二等",
            "crop_year": 2025,
            "origin": "黑龙江绥化",
            "supplier_name": "北安粮贸",
            "price": "2380",
            "price_type": "出厂价",
            "available_quantity_tons": 800,
            "latest_ship_at": "2026-08-28",
            "reasons": ["2025 年新粮"],
            "risks": [],
        },
        "backup": None,
        "eliminated": [],
        "verifications": ["确认可锁定库存"],
    }


def test_create_task(client, db_session):
    resp = client.post("/api/liang/tasks", json={"need": _need(), "plan": _plan()})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "completed"
    assert body["task_code"].startswith("XZ")
    assert body["plan"]["primary"]["listing_code"] == "LIANG-V1-001"


def test_list_tasks(client, db_session):
    client.post("/api/liang/tasks", json={"need": _need(), "plan": _plan()})
    client.post("/api/liang/tasks", json={"need": _need(), "plan": _plan()})
    resp = client.get("/api/liang/tasks")
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 2


def test_task_detail_and_404(client, db_session):
    created = client.post("/api/liang/tasks", json={"need": _need(), "plan": _plan()}).json()
    resp = client.get(f"/api/liang/tasks/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["task_code"] == created["task_code"]
    assert client.get("/api/liang/tasks/99999").status_code == 404


def test_handoff(client, db_session):
    created = client.post("/api/liang/tasks", json={"need": _need(), "plan": _plan()}).json()
    resp = client.post(f"/api/liang/tasks/{created['id']}/handoff", json={"destination": "深圳"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "handed_off"
    assert body["handoff"]["summary"]["destination"] == "深圳"
    assert body["handoff"]["summary"]["primary_listing_code"] == "LIANG-V1-001"
    assert body["handoff"]["handoff_code"].startswith("YJ")


def test_handoff_requires_primary(client, db_session):
    plan_no_primary = {
        "need_summary": None,
        "primary": None,
        "backup": None,
        "eliminated": [],
        "verifications": [],
    }
    created = client.post(
        "/api/liang/tasks", json={"need": _need(), "plan": plan_no_primary}
    ).json()
    resp = client.post(
        f"/api/liang/tasks/{created['id']}/handoff", json={"destination": "深圳"}
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && pytest tests/liang/test_tasks.py -q`
Expected: FAIL（`POST /api/liang/tasks` 返回 404，因路由尚未实现）

- [ ] **Step 3: 实现 repository 函数**

在 `backend/app/liang/repository.py` 顶部 import 增加 `datetime` 与 `SourcingTask`，并追加函数：

```python
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.liang.models import GrainListing, SourcingTask
```

在文件末尾追加：

```python
def _next_task_code(db: Session) -> str:
    """生成任务编号：XZ + 日期 + 当日 3 位序号。"""
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"XZ{today}-"
    count = (
        db.query(SourcingTask)
        .filter(SourcingTask.task_code.like(f"{prefix}%"))
        .count()
    )
    return f"{prefix}{count + 1:03d}"


def create_task(db: Session, need: dict, plan: dict) -> SourcingTask:
    task = SourcingTask(task_code=_next_task_code(db), status="completed", need=need, plan=plan)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def list_tasks(db: Session) -> list[SourcingTask]:
    return db.scalars(select(SourcingTask).order_by(SourcingTask.id.desc())).all()


def get_task(db: Session, task_id: int) -> SourcingTask | None:
    return db.get(SourcingTask, task_id)


def apply_handoff(db: Session, task: SourcingTask, handoff: dict) -> SourcingTask:
    task.handoff = handoff
    task.status = "handed_off"
    db.commit()
    db.refresh(task)
    return task
```

---

### Task 3: routes 层（4 个接口）

**Files:**
- Modify: `backend/app/liang/routes.py`

- [ ] **Step 1: 修改 routes.py 顶部 import**

将：

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.liang import metrics, repository
```

改为：

```python
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.liang import metrics, repository
from app.liang.models import SourcingTask
```

- [ ] **Step 2: 在文件末尾追加请求体、序列化与 4 个路由**

```python
class TaskCreate(BaseModel):
    need: dict
    plan: dict


class HandoffCreate(BaseModel):
    destination: str


def _serialize_task(t: SourcingTask) -> dict:
    return {
        "id": t.id,
        "task_code": t.task_code,
        "status": t.status,
        "need": t.need,
        "plan": t.plan,
        "handoff": t.handoff,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _build_handoff_summary(task: SourcingTask, destination: str) -> dict:
    plan = task.plan or {}
    primary = plan.get("primary") or {}
    need = task.need or {}
    return {
        "variety_name": need.get("variety"),
        "quantity_tons": need.get("quantity_tons"),
        "origin": primary.get("origin"),
        "destination": destination,
        "earliest_ship_at": primary.get("earliest_ship_at"),
        "latest_ship_at": primary.get("latest_ship_at"),
        "primary_listing_code": primary.get("listing_code"),
        "supplier_name": primary.get("supplier_name"),
    }


@router.get("/tasks")
def list_tasks(db: Session = Depends(get_db)):
    """历史运行列表，创建时间倒序。"""
    return {"items": [_serialize_task(t) for t in repository.list_tasks(db)]}


@router.get("/tasks/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = repository.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return _serialize_task(task)


@router.post("/tasks")
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    """保存寻源任务（DAG 执行完成后调用）。"""
    task = repository.create_task(db, body.need, body.plan)
    return _serialize_task(task)


@router.post("/tasks/{task_id}/handoff")
def handoff_task(task_id: int, body: HandoffCreate, db: Session = Depends(get_db)):
    """交接运小二：生成结构化交接摘要，状态转 handed_off。"""
    task = repository.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    if not task.plan or not task.plan.get("primary"):
        raise HTTPException(status_code=422, detail="任务尚未生成主推方案，无法交接")
    handoff = {
        "handoff_code": f"YJ{task.task_code[2:]}",
        "handed_off_at": datetime.now().isoformat(),
        "summary": _build_handoff_summary(task, body.destination),
    }
    task = repository.apply_handoff(db, task, handoff)
    return _serialize_task(task)
```

- [ ] **Step 3: 运行测试确认通过**

Run: `cd backend && pytest tests/liang/ -q`
Expected: 全部 PASS（含既有 `test_routes.py` 的 4 个 + 新增 5 个）

---

## 前端

### Task 4: 类型与 API 函数

**Files:**
- Modify: `web/src/features/liang/types.ts`
- Modify: `web/src/features/liang/api.ts`

- [ ] **Step 1: 在 types.ts 末尾追加任务类型**

```ts
// ── 寻源任务（DAG 编排沉淀）──

export interface TaskNeedSummary {
  variety?: string;
  quantity_tons?: number;
  grade?: string;
  crop_year?: number;
  deadline?: string;
  budget_price?: number;
}

export interface TaskPick {
  listing_code: string;
  variety_name: string;
  grade: string;
  crop_year: number;
  origin: string;
  supplier_name: string;
  price: string;
  price_type: string;
  available_quantity_tons: number;
  latest_ship_at: string | null;
  reasons: string[];
  risks: string[];
}

export interface TaskEliminated {
  listing_code: string;
  variety_name: string;
  grade: string;
  supplier_name: string;
  reason_code: string;
  reason_text: string;
}

export interface TaskPlan {
  need_summary: TaskNeedSummary | null;
  primary: TaskPick | null;
  backup: TaskPick | null;
  eliminated: TaskEliminated[];
  verifications: string[];
}

export interface TaskHandoff {
  handoff_code: string;
  handed_off_at: string;
  summary: {
    variety_name?: string;
    quantity_tons?: number;
    origin?: string;
    destination?: string;
    earliest_ship_at?: string | null;
    latest_ship_at?: string | null;
    primary_listing_code?: string;
    supplier_name?: string;
  };
}

export interface SourcingTask {
  id: number;
  task_code: string;
  status: "completed" | "handed_off";
  need: TaskNeedSummary | null;
  plan: TaskPlan | null;
  handoff: TaskHandoff | null;
  created_at: string | null;
}
```

- [ ] **Step 2: 在 api.ts 追加任务 API 函数**

将 api.ts 顶部 import 改为：

```ts
import type {
  Listing,
  ListingFilters,
  MarketSummaryResponse,
  SourcingTask,
  TaskNeedSummary,
  TaskPlan,
} from "./types";
```

在文件末尾追加：

```ts
export async function fetchTasks(): Promise<SourcingTask[]> {
  const resp = await fetch("/api/liang/tasks");
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  const data = await resp.json();
  return data.items as SourcingTask[];
}

export async function fetchTask(id: number): Promise<SourcingTask> {
  const resp = await fetch(`/api/liang/tasks/${id}`);
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function createTask(payload: {
  need: TaskNeedSummary;
  plan: TaskPlan;
}): Promise<SourcingTask> {
  const resp = await fetch("/api/liang/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function handoffTask(
  id: number,
  destination: string,
): Promise<SourcingTask> {
  const resp = await fetch(`/api/liang/tasks/${id}/handoff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination }),
  });
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}
```

- [ ] **Step 3: 构建验证**

Run: `cd web && npm run build`
Expected: 通过（tsc 无类型错误）

---

### Task 5: DAG 定义与方案快照（workflow.ts）

**Files:**
- Create: `web/src/features/liang/workflow.ts`

- [ ] **Step 1: 写完整 workflow.ts**

```ts
// web/src/features/liang/workflow.ts
import type {
  CompareResult,
  Pick,
  TaskEliminated,
  TaskPick,
  TaskPlan,
} from "./types";

export type DagNodeId =
  | "parse"
  | "load"
  | "filter"
  | "sort"
  | "eliminate"
  | "pick"
  | "verify"
  | "save";

export type NodeStatus = "pending" | "running" | "done" | "skipped";

export interface DagNode {
  id: DagNodeId;
  label: string;
  deps: DagNodeId[];
}

export const DAG_NODES: DagNode[] = [
  { id: "parse", label: "理解需求", deps: [] },
  { id: "load", label: "读取粮源", deps: ["parse"] },
  { id: "filter", label: "硬条件过滤", deps: ["load"] },
  { id: "sort", label: "排序比较", deps: ["filter"] },
  { id: "eliminate", label: "淘汰归因", deps: ["filter"] },
  { id: "pick", label: "主推/备选", deps: ["sort"] },
  { id: "verify", label: "待核验清单", deps: ["pick", "eliminate"] },
  { id: "save", label: "沉淀任务", deps: ["verify"] },
];

// 自动执行批次（save 为手动触发，不含在内）
export const AUTO_BATCHES: DagNodeId[][] = [
  ["parse"],
  ["load"],
  ["filter"],
  ["sort", "eliminate"],
  ["pick"],
  ["verify"],
];

export function initialStatus(): Record<DagNodeId, NodeStatus> {
  const s = {} as Record<DagNodeId, NodeStatus>;
  for (const n of DAG_NODES) s[n.id] = "pending";
  return s;
}

function pickToTaskPick(p: Pick): TaskPick {
  const l = p.listing;
  return {
    listing_code: l.listing_code,
    variety_name: l.variety_name,
    grade: l.grade,
    crop_year: l.crop_year,
    origin: `${l.origin_province}${l.origin_city}`,
    supplier_name: l.supplier_name,
    price: l.price,
    price_type: l.price_type,
    available_quantity_tons: l.available_quantity_tons,
    latest_ship_at: l.latest_ship_at,
    reasons: p.reasons,
    risks: p.risks,
  };
}

/** 把候选对比结果固化为可落库的方案快照。 */
export function buildPlan(compare: CompareResult): TaskPlan {
  return {
    need_summary: compare.need_summary,
    primary: compare.primary ? pickToTaskPick(compare.primary) : null,
    backup: compare.backup ? pickToTaskPick(compare.backup) : null,
    eliminated: compare.eliminated.map(
      (e): TaskEliminated => ({
        listing_code: e.listing.listing_code,
        variety_name: e.listing.variety_name,
        grade: e.listing.grade,
        supplier_name: e.listing.supplier_name,
        reason_code: e.reason_code,
        reason_text: e.reason_text,
      }),
    ),
    verifications: compare.verifications,
  };
}
```

- [ ] **Step 2: 构建验证**

Run: `cd web && npm run build`
Expected: 通过

---

### Task 6: DAG 画布组件（DagCanvas.tsx）

**Files:**
- Create: `web/src/features/liang/DagCanvas.tsx`

- [ ] **Step 1: 写完整 DagCanvas.tsx**

```tsx
// web/src/features/liang/DagCanvas.tsx
import type { DagNodeId, NodeStatus } from "./workflow";

const W = 92;
const H = 44;

const NODE_POS: Record<DagNodeId, { x: number; y: number }> = {
  parse: { x: 14, y: 68 },
  load: { x: 144, y: 68 },
  filter: { x: 274, y: 68 },
  sort: { x: 414, y: 24 },
  eliminate: { x: 414, y: 112 },
  pick: { x: 554, y: 24 },
  verify: { x: 694, y: 68 },
  save: { x: 834, y: 68 },
};

const EDGES: { from: DagNodeId; to: DagNodeId }[] = [
  { from: "parse", to: "load" },
  { from: "load", to: "filter" },
  { from: "filter", to: "sort" },
  { from: "filter", to: "eliminate" },
  { from: "sort", to: "pick" },
  { from: "pick", to: "verify" },
  { from: "eliminate", to: "verify" },
  { from: "verify", to: "save" },
];

const NODE_LABEL: Record<DagNodeId, string> = {
  parse: "理解需求",
  load: "读取粮源",
  filter: "硬条件过滤",
  sort: "排序比较",
  eliminate: "淘汰归因",
  pick: "主推/备选",
  verify: "待核验清单",
  save: "沉淀任务",
};

function edgePath(from: DagNodeId, to: DagNodeId): string {
  const a = NODE_POS[from];
  const b = NODE_POS[to];
  const x1 = a.x + W;
  const y1 = a.y + H / 2;
  const x2 = b.x;
  const y2 = b.y + H / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function nodeClass(st: NodeStatus): string {
  switch (st) {
    case "running":
      return "border-brand bg-brand-faint text-brand-deep animate-pulse";
    case "done":
      return "border-brand bg-brand text-white";
    case "skipped":
      return "border-line/50 bg-panel/40 text-ink-soft/60";
    default:
      return "border-line bg-panel text-ink-soft";
  }
}

export default function DagCanvas({
  status,
}: {
  status: Record<DagNodeId, NodeStatus>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel/60 px-2 py-4">
      <div className="relative mx-auto h-[180px] w-[940px]">
        <svg
          className="absolute inset-0"
          viewBox="0 0 940 180"
          width={940}
          height={180}
        >
          <defs>
            <marker
              id="dag-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#c9902a" />
            </marker>
          </defs>
          {EDGES.map((e) => (
            <path
              key={`${e.from}-${e.to}`}
              d={edgePath(e.from, e.to)}
              fill="none"
              stroke="#2a3346"
              strokeWidth={1.5}
              markerEnd="url(#dag-arrow)"
            />
          ))}
        </svg>

        {Object.entries(NODE_POS).map(([id, pos]) => {
          const st = status[id as DagNodeId];
          return (
            <div
              key={id}
              className={`absolute flex flex-col items-center justify-center rounded-xl border text-xs ${nodeClass(st)}`}
              style={{ left: pos.x, top: pos.y, width: W, height: H }}
            >
              <span className="font-medium">{NODE_LABEL[id as DagNodeId]}</span>
              {st === "done" && <span className="text-[10px] leading-none">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `cd web && npm run build`
Expected: 通过

---

### Task 7: 寻源任务主组件（SourcingTab.tsx）

**Files:**
- Create: `web/src/features/liang/SourcingTab.tsx`

- [ ] **Step 1: 写完整 SourcingTab.tsx**

```tsx
// web/src/features/liang/SourcingTab.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { createTask, fetchListings, fetchTasks, handoffTask } from "./api";
import { compareListings } from "./compare";
import DagCanvas from "./DagCanvas";
import { fmtDate, fmtInt } from "./format";
import { parseNeed } from "./parseNeed";
import { AUTO_BATCHES, buildPlan, initialStatus } from "./workflow";
import type { DagNodeId, NodeStatus } from "./workflow";
import type { CompareResult, Listing, NeedInput, SourcingTask, TaskPick } from "./types";

const STEP_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function needText(need: NeedInput | null): string {
  if (!need) return "未指定条件";
  const parts: string[] = [];
  if (need.variety) parts.push(need.variety);
  if (need.grade) parts.push(need.grade);
  if (need.crop_year != null) parts.push(`${need.crop_year} 年`);
  if (need.quantity_tons != null) parts.push(`${need.quantity_tons} 吨`);
  if (need.deadline_days != null) parts.push(`${need.deadline_days} 天内可发`);
  if (need.budget_price != null) parts.push(`预算 ≤ ${need.budget_price} 元/吨`);
  return parts.length ? parts.join(" · ") : "未指定条件";
}

function PickCard({ pick, label }: { pick: TaskPick; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-brand-deep">{label}</span>
        <span className="text-xs text-ink-soft">{pick.listing_code}</span>
      </div>
      <div className="mt-2 text-lg font-semibold text-ink">
        {pick.variety_name} · {pick.grade} · {pick.crop_year}
        <span className="ml-2 text-sm font-normal text-ink-soft">{pick.origin}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-tech">
        {fmtInt(pick.price)}
        <span className="ml-1 text-xs font-normal text-ink-soft">
          元/吨 · {pick.price_type}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm text-ink">
        <div>供应方：{pick.supplier_name}</div>
        <div>可用量：{fmtInt(pick.available_quantity_tons)} 吨</div>
        <div>最晚可发：{fmtDate(pick.latest_ship_at)}</div>
      </div>
      <div className="mt-3 rounded-xl bg-rice px-4 py-2.5">
        <div className="text-xs text-ink-soft">入选理由</div>
        <div className="mt-1 text-sm text-ink">{pick.reasons.join("；")}</div>
      </div>
      {pick.risks.length > 0 && (
        <div className="mt-2 text-xs text-amber-300">风险：{pick.risks.join("；")}</div>
      )}
    </div>
  );
}

function HistoryRow({ task }: { task: SourcingTask }) {
  const [open, setOpen] = useState(false);
  const plan = task.plan;
  const primary = plan?.primary ?? null;
  return (
    <div className="rounded-2xl border border-line bg-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-ink">{task.task_code}</span>
        <span className="flex items-center gap-4 text-xs text-ink-soft">
          <span>{task.need?.variety ?? "—"}</span>
          <span>{task.need?.quantity_tons != null ? `${task.need.quantity_tons} 吨` : "—"}</span>
          <span>{primary ? primary.supplier_name : "—"}</span>
          <span
            className={`rounded-full px-2 py-0.5 ${
              task.status === "handed_off"
                ? "bg-tech/15 text-tech"
                : "bg-brand-faint text-brand-deep"
            }`}
          >
            {task.status === "handed_off" ? "已交接" : "已出方案"}
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-5 py-4 text-sm text-ink">
          <div className="text-ink-soft">
            需求：
            {[
              task.need?.variety,
              task.need?.grade,
              task.need?.quantity_tons != null ? `${task.need.quantity_tons} 吨` : null,
              task.need?.deadline ? `最晚 ${task.need.deadline} 发运` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
          {primary && (
            <div className="mt-2">
              主推：{primary.variety_name} · {primary.supplier_name} · {fmtInt(primary.price)} 元/吨
            </div>
          )}
          {plan?.backup && (
            <div className="mt-1">
              备选：{plan.backup.variety_name} · {plan.backup.supplier_name} · {fmtInt(plan.backup.price)} 元/吨
            </div>
          )}
          <div className="mt-1">淘汰 {plan?.eliminated.length ?? 0} 笔 · 待核验 {plan?.verifications.length ?? 0} 项</div>
          {task.handoff && (
            <div className="mt-2 rounded-xl bg-rice px-4 py-2 text-xs">
              交接单 {task.handoff.handoff_code} · 目的地 {task.handoff.summary.destination ?? "—"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SourcingTab() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Record<DagNodeId, NodeStatus>>(initialStatus);
  const [need, setNeed] = useState<NeedInput | null>(null);
  const [listingCount, setListingCount] = useState(0);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [running, setRunning] = useState(false);
  const [tasks, setTasks] = useState<SourcingTask[]>([]);
  const [saved, setSaved] = useState<SourcingTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const runId = useRef(0);

  const refreshTasks = useCallback(() => {
    fetchTasks().then(setTasks).catch(() => {});
  }, []);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  async function startRun() {
    const raw = text.trim();
    if (!raw || running) return;
    const id = ++runId.current;
    setRunning(true);
    setSaved(null);
    setError(null);
    setCompare(null);
    setListingCount(0);
    setHandoffOpen(false);
    setStatus(initialStatus());

    // ① 理解需求
    setStatus((s) => ({ ...s, parse: "running" }));
    await sleep(STEP_MS);
    const parsed = parseNeed(raw);
    setNeed(parsed);
    if (runId.current !== id) return;
    setStatus((s) => ({ ...s, parse: "done" }));

    // ② 读取粮源
    setStatus((s) => ({ ...s, load: "running" }));
    let listings: Listing[];
    try {
      listings = await fetchListings();
    } catch (e) {
      if (runId.current !== id) return;
      setError(e instanceof Error ? e.message : "粮源加载失败");
      setRunning(false);
      return;
    }
    await sleep(STEP_MS);
    if (runId.current !== id) return;
    setListingCount(listings.length);
    setStatus((s) => ({ ...s, load: "done" }));

    // 计算 + 逐步揭示 ③~⑦
    const result = compareListings(listings, [], parsed);
    setCompare(result);

    if (!result.has_need) {
      setStatus((s) => ({
        ...s,
        filter: "skipped",
        sort: "skipped",
        eliminate: "skipped",
        pick: "skipped",
        verify: "skipped",
      }));
      setRunning(false);
      return;
    }

    for (const batch of AUTO_BATCHES.slice(2)) {
      setStatus((s) => {
        const next = { ...s };
        for (const nid of batch) next[nid] = "running";
        return next;
      });
      await sleep(STEP_MS);
      if (runId.current !== id) return;
      setStatus((s) => {
        const next = { ...s };
        for (const nid of batch) next[nid] = "done";
        return next;
      });
    }
    setRunning(false);
  }

  async function onSave() {
    if (!compare || !compare.primary) return;
    try {
      const t = await createTask({
        need: compare.need_summary ?? {},
        plan: buildPlan(compare),
      });
      setSaved(t);
      setStatus((s) => ({ ...s, save: "done" }));
      refreshTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  async function onHandoff() {
    if (!saved || !destination.trim()) return;
    try {
      const t = await handoffTask(saved.id, destination.trim());
      setSaved(t);
      setHandoffOpen(false);
      setDestination("");
      refreshTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "交接失败");
    }
  }

  const plan = compare ? buildPlan(compare) : null;
  const primary = plan?.primary ?? null;
  const backup = plan?.backup ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* 输入 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startRun();
        }}
        className="flex items-center gap-3"
      >
        <span className="shrink-0 text-sm font-medium text-ink">描述寻源需求</span>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="如：120吨二等玉米，7天内可发，预算2400"
          className="h-11 flex-1 rounded-full border border-line bg-rice px-5 text-sm text-ink placeholder:text-ink-soft/70"
        />
        <button
          type="submit"
          disabled={running || !text.trim()}
          className="h-11 rounded-full bg-brand px-7 text-sm font-medium text-white disabled:opacity-50"
        >
          {running ? "寻源中…" : "开始寻源"}
        </button>
      </form>

      {/* DAG 画布 */}
      <DagCanvas status={status} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* 产出面板 */}
      {need && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-panel px-5 py-4">
            <span className="text-xs text-ink-soft">
              {status.parse === "done" ? "已识别需求" : ""} · 已加载 {listingCount} 笔粮源
            </span>
            <div className="mt-1 text-sm font-medium text-ink">{needText(need)}</div>
          </div>

          {compare && compare.has_need && primary && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <PickCard pick={primary} label="主推粮源" />
                {backup ? (
                  <PickCard pick={backup} label="备选粮源" />
                ) : (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-line bg-panel/40 text-sm text-ink-soft">
                    暂无满足硬条件的备选
                  </div>
                )}
              </div>

              {compare.eliminated.length > 0 && (
                <div className="rounded-2xl border border-line bg-panel p-5">
                  <div className="mb-3 text-sm font-semibold">未入选原因</div>
                  <ul className="space-y-2">
                    {compare.eliminated.map((e) => (
                      <li key={e.listing.id} className="flex items-start justify-between gap-4 text-sm">
                        <span className="shrink-0 text-ink">
                          {e.listing.variety_name}·{e.listing.grade} · {e.listing.supplier_name}
                        </span>
                        <span className="text-right text-ink-soft">{e.reason_text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-2xl border border-line bg-panel p-5">
                <div className="mb-3 text-sm font-semibold">交易前待核验清单</div>
                <ol className="space-y-1.5">
                  {compare.verifications.map((v, i) => (
                    <li key={v} className="text-sm text-ink">
                      <span className="mr-2 text-ink-soft">{i + 1}.</span>
                      {v}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}

          {compare && compare.has_need && !primary && (
            <div className="rounded-2xl border border-dashed border-line bg-panel/40 p-5 text-sm text-ink-soft">
              无粮源通过硬条件，请放宽品种、数量、等级或发运时间后重试。
            </div>
          )}
        </div>
      )}

      {/* 结论区：保存 / 交接 */}
      {compare && primary && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
          {!saved ? (
            <button
              type="button"
              onClick={onSave}
              className="h-11 rounded-full bg-brand px-7 text-sm font-medium text-white"
            >
              保存为任务
            </button>
          ) : saved.status === "handed_off" ? (
            <div className="text-sm text-ink">
              已交接 · {saved.handoff?.handoff_code} · 目的地{" "}
              {saved.handoff?.summary.destination ?? "—"}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-ink">已保存 · {saved.task_code}</span>
              {!handoffOpen ? (
                <button
                  type="button"
                  onClick={() => setHandoffOpen(true)}
                  className="h-9 rounded-full bg-tech px-5 text-sm font-medium text-rice"
                >
                  交接运小二
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="目的到达地区，如：深圳"
                    className="h-9 rounded-full border border-line bg-rice px-4 text-sm text-ink placeholder:text-ink-soft/70"
                  />
                  <button
                    type="button"
                    disabled={!destination.trim()}
                    onClick={onHandoff}
                    className="h-9 rounded-full bg-tech px-5 text-sm font-medium text-rice disabled:opacity-50"
                  >
                    确认交接
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 历史运行 */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">历史运行</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-ink-soft">暂无已保存的寻源任务</p>
        ) : (
          tasks.map((t) => <HistoryRow key={t.id} task={t} />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `cd web && npm run build`
Expected: 通过

---

### Task 8: 接入 LiangPage 与 agents.ts

**Files:**
- Modify: `web/src/features/liang/LiangPage.tsx`
- Modify: `web/src/data/agents.ts`

- [ ] **Step 1: LiangPage.tsx 引入 SourcingTab 并接入 index 2**

在 import 区（`import CompareTab from "./CompareTab";` 之后）加：

```ts
import SourcingTab from "./SourcingTab";
```

将渲染条件：

```tsx
{activeTab === 1 ? (
  <CompareTab need={need} onNeedChange={(n) => setNeed(n)} />
) : activeTab !== 0 ? (
```

改为：

```tsx
{activeTab === 1 ? (
  <CompareTab need={need} onNeedChange={(n) => setNeed(n)} />
) : activeTab === 2 ? (
  <SourcingTab />
) : activeTab !== 0 ? (
```

- [ ] **Step 2: agents.ts 移除「供应方」**

将：

```ts
tabs: ["找粮源", "候选对比", "供应方", "寻源任务", "历史记录"],
```

改为：

```ts
tabs: ["找粮源", "候选对比", "寻源任务", "历史记录"],
```

- [ ] **Step 3: 构建验证**

Run: `cd web && npm run build`
Expected: 通过

---

## 端到端验收

### Task 9: 手动验收

- [ ] **Step 1: 启动后端**

Run: `cd backend && uvicorn app.main:app --reload --port 8000`
Expected: 服务启动，日志显示种子数据初始化（无 MySQL 环境会跳过种子但服务可用）

- [ ] **Step 2: 启动前端**

Run: `cd web && npm run dev`
Expected: Vite 启动，访问 `http://localhost:5173/agent/liang`

- [ ] **Step 3: 验收寻源任务 Tab**

1. 进入粮小二 → 顶部 Tab 为 `找粮源 / 候选对比 / 寻源任务 / 历史记录`（供应方已消失）。
2. 点击「寻源任务」→ 看到 DAG 画布（8 节点）与输入框。
3. 输入 `120吨二等玉米，7天内可发，预算2400` → 点「开始寻源」。
4. 观察 8 节点按批次逐步点亮（理解需求 → 读取粮源 → 硬条件过滤 → 排序比较/淘汰归因 → 主推/备选 → 待核验清单），约 3 秒完成。
5. 产出面板出现：需求摘要、主推「北安粮贸」、备选「榆树粮贸」、淘汰「铁岭粮贸（等级不符）」「通辽粮贸（数量不足）」、待核验 5 项。
6. 点「保存为任务」→ 显示「已保存 · XZ…」，历史运行列表新增一条。
7. 点「交接运小二」→ 填目的地「深圳」→ 确认 → 显示「已交接 · YJ… · 目的地 深圳」，历史列表该条状态变「已交接」。
8. 刷新页面 → 历史运行仍存在（后端落库）。
9. 输入空或无关文字（如「你好」）→ 「理解需求」产出「未指定条件」，后续节点 skipped。
10. 页面全程不出现「演示数据 / mock」字样。

- [ ] **Step 4: 回归验证后端测试**

Run: `cd backend && pytest tests/liang/ -q`
Expected: 全部 PASS

---

## Self-Review 结论

- **Spec 覆盖**：8 节点 DAG（§4）→ Task 5/6/7；确定性执行引擎 + 定时器批次（§5）→ Task 7 `startRun`；布局（§6）→ Task 6/7；数据模型 `sourcing_tasks`（§7）→ Task 1/2；API（§8）→ Task 3/4；保存/交接收口（§9）→ Task 7 `onSave`/`onHandoff`；供应方移除（§2.5）→ Task 8；测试验收（§11）→ Task 9。
- **占位符**：无 TBD/TODO；所有代码步骤含完整实现。
- **类型一致性**：`DagNodeId`/`NodeStatus`/`TaskPick`/`TaskPlan`/`SourcingTask` 在 Task 4/5/6/7 中命名一致；`buildPlan`、`initialStatus`、`DAG_NODES`、`AUTO_BATCHES` 定义于 Task 5 并在 Task 6/7 使用；后端 `create_task`/`list_tasks`/`get_task`/`apply_handoff` 定义于 Task 2 并在 Task 3 使用。
