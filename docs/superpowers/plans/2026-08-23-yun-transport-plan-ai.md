# 运小二运输方案 AI 决策舱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将运小二「运输方案」Tab 改造成一句话需求受理、三种决策偏好、需求确认、规则匹配和可解释主推方案的一体化决策工作台。

**Architecture:** LangChain/Qwen 只抽取结构化需求与组织解释，`backend/app/logistics/rules.py` 负责硬条件过滤和确定性排序。前端在「运输方案」内完成输入、确认、匹配和结果展示；「找物流」只保留市场浏览，并可把线路条件带入运输方案。

**Tech Stack:** FastAPI、Pydantic、SQLAlchemy、MySQL、pytest、LangChain、React 18、TypeScript、Vite、Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-08-23-yun-transport-plan-ai-design.md`

## Global Constraints

- 始终使用简体中文沟通和界面文案。
- 禁止自动提交 Git；每个任务用测试与 `git diff --check` 收尾，不执行 `git commit`。
- 后端保持 FastAPI + SQLAlchemy + 本地 Docker MySQL，前端保持 React，Agent 能力保持 LangChain。
- AI 只负责理解和解释，不能编造线路、运价、承运方或绕过规则排序。
- 不引入综合评分、实时 GPS、动态竞价、自动锁运力或新的状态管理框架。
- Mock 业务数据保持合理，不在页面标记为 Mock。
- 不使用 computer-user。

---

## File Structure

### Backend

- Modify: `backend/app/logistics/rules.py` — 三种偏好排序、硬条件过滤和参照候选选择。
- Modify: `backend/app/logistics/models.py` — 在运输任务上持久化 `decision_preference`。
- Modify: `backend/app/logistics/routes.py` — 任务与匹配接口接收偏好，响应返回偏好。
- Modify: `backend/app/logistics/llm.py` — 从自然语言中抽取偏好。
- Create: `backend/migrations/20260823_add_logistics_decision_preference.sql` — 已存在 MySQL 数据库的一次性兼容 SQL。
- Modify: `backend/tests/logistics/test_rules.py` — 偏好排序、硬条件和参照候选测试。
- Modify: `backend/tests/logistics/test_routes.py` — 偏好持久化、重新匹配和结果接口测试。
- Modify: `backend/tests/logistics/test_llm.py` — 偏好抽取结构测试。

### Frontend

- Modify: `web/src/features/yun/types.ts` — 偏好、预填条件和方案结果类型。
- Modify: `web/src/features/yun/api.ts` — 带偏好的任务创建与重新匹配请求。
- Create: `web/src/features/yun/TransportPlanComposer.tsx` — 一句话输入、偏好选择、AI 抽取和确认卡容器。
- Create: `web/src/features/yun/RequirementConfirmCard.tsx` — 结构化需求确认与缺失字段提示。
- Create: `web/src/features/yun/PlanDecisionCard.tsx` — 整行主推方案卡。
- Create: `web/src/features/yun/PlanReferenceCards.tsx` — 更快与更省参照卡。
- Create: `web/src/features/yun/planReferences.ts` — 从任务方案中确定不重复的更快与更省参照。
- Modify: `web/src/features/yun/PlansTab.tsx` — 组合输入态、匹配态、无解态和结果态。
- Modify: `web/src/features/yun/FindLogisticsTab.tsx` — 删除自然语言受理与即时方案区域，保留市场浏览并增加带入动作。
- Modify: `web/src/features/yun/TasksTab.tsx` — 历史测算恢复入口改为进入运输方案。
- Modify: `web/src/features/yun/YunPage.tsx` — 管理运输方案预填与当前任务上下文。

---

### Task 1: 为规则引擎增加三种确定性偏好排序

**Files:**
- Modify: `backend/app/logistics/rules.py`
- Test: `backend/tests/logistics/test_rules.py`

**Interfaces:**
- Consumes: `match_plans(segments: list, services: list, req: dict) -> dict` 现有接口。
- Produces: `normalize_preference(value: str | None) -> str`；`plan_sort_key(candidate: dict, preference: str) -> tuple`；`match_plans` 读取 `req["decision_preference"]`，返回结构保持 `primary / backup / rejected / suggestions / check_items`。

- [ ] **Step 1: 写偏好排序失败测试**

在 `backend/tests/logistics/test_rules.py` 增加：

```python
def test_decision_preferences_change_primary():
    from app.logistics.rules import match_plans

    base = REQ | {"deadline_date": None}
    cost = match_plans(SEGMENTS, SERVICES, base | {"decision_preference": "cost"})
    on_time = match_plans(
        SEGMENTS, SERVICES, base | {"decision_preference": "on_time"}
    )
    balanced = match_plans(
        SEGMENTS, SERVICES, base | {"decision_preference": "balanced"}
    )

    assert cost["primary"]["mode"] == "combined"
    assert on_time["primary"]["mode"] == "road"
    assert balanced["primary"]["mode"] == "combined"


def test_unknown_preference_falls_back_to_balanced():
    from app.logistics.rules import match_plans

    base = REQ | {"deadline_date": None}
    unknown = match_plans(
        SEGMENTS, SERVICES, base | {"decision_preference": "unknown"}
    )
    balanced = match_plans(
        SEGMENTS, SERVICES, base | {"decision_preference": "balanced"}
    )
    assert unknown["primary"]["mode"] == balanced["primary"]["mode"]


def test_deadline_remains_hard_constraint_for_cost_preference():
    from app.logistics.rules import match_plans

    out = match_plans(
        SEGMENTS,
        SERVICES,
        REQ | {"decision_preference": "cost"},
    )
    assert out["primary"]["mode"] == "rail"
    assert any(r["mode"] == "combined" and "超期" in r["reason"] for r in out["rejected"])
```

- [ ] **Step 2: 运行新测试并确认失败**

Run:

```bash
cd backend && pytest tests/logistics/test_rules.py::test_decision_preferences_change_primary tests/logistics/test_rules.py::test_unknown_preference_falls_back_to_balanced tests/logistics/test_rules.py::test_deadline_remains_hard_constraint_for_cost_preference -v
```

Expected: 至少 `test_decision_preferences_change_primary` 失败，因为当前排序不读取 `decision_preference`。

- [ ] **Step 3: 实现最小偏好排序函数**

在 `backend/app/logistics/rules.py` 增加并在 `match_plans` 中使用：

```python
DECISION_PREFERENCES = {"on_time", "cost", "balanced"}


def normalize_preference(value: str | None) -> str:
    return value if value in DECISION_PREFERENCES else "balanced"


def _mid_price(candidate: dict) -> float:
    return (candidate["price_low"] + candidate["price_high"]) / 2


def plan_sort_key(candidate: dict, preference: str) -> tuple:
    preference = normalize_preference(preference)
    if preference == "on_time":
        return candidate["days_high"], _mid_price(candidate), candidate["transship_count"]
    return _mid_price(candidate), candidate["days_high"], candidate["transship_count"]


preference = normalize_preference(req.get("decision_preference"))
feasible.sort(key=lambda candidate: plan_sort_key(candidate, preference))
```

均衡决策的 Pareto 规则保持 YAGNI：在当前候选规模下，先移除“同时更贵且更慢”的候选不会改变最优项，再按费用、时效、换装稳定排序。实现一个小函数并只对 `balanced` 使用：

```python
def remove_dominated(candidates: list[dict]) -> list[dict]:
    return [
        candidate
        for candidate in candidates
        if not any(
            other is not candidate
            and _mid_price(other) <= _mid_price(candidate)
            and other["days_high"] <= candidate["days_high"]
            and (
                _mid_price(other) < _mid_price(candidate)
                or other["days_high"] < candidate["days_high"]
            )
            for other in candidates
        )
]
```

在 `balanced` 分支中使用明确的数据移动：

```python
rankable = remove_dominated(feasible)
dominated = [candidate for candidate in feasible if candidate not in rankable]
feasible = rankable
for candidate in dominated:
    rejected.append(
        {**candidate, "reason": "费用与时效同时弱于其他可行方案，作为比较参照"}
    )
```

这样被 Pareto 排除的候选仍会持久化并可用于参照，但原因不会写成品种、吨位或期限不满足。

- [ ] **Step 4: 运行物流规则全集**

Run: `cd backend && pytest tests/logistics/test_rules.py -v`

Expected: 全部 PASS；原有超期、品种和吨位测试继续通过。

- [ ] **Step 5: 检查本任务差异**

Run:

```bash
git diff --check -- backend/app/logistics/rules.py backend/tests/logistics/test_rules.py
git diff -- backend/app/logistics/rules.py backend/tests/logistics/test_rules.py
```

Expected: 无空白错误；不执行 Git 提交。

---

### Task 2: 持久化偏好并扩展任务、匹配和抽取接口

**Files:**
- Modify: `backend/app/logistics/models.py`
- Modify: `backend/app/logistics/routes.py`
- Modify: `backend/app/logistics/llm.py`
- Create: `backend/migrations/20260823_add_logistics_decision_preference.sql`
- Test: `backend/tests/logistics/test_routes.py`
- Test: `backend/tests/logistics/test_llm.py`

**Interfaces:**
- Consumes: Task 1 的 `normalize_preference` 与 `match_plans(... req["decision_preference"])`。
- Produces: `TaskBody.decision_preference: Literal["on_time", "cost", "balanced"]`；`MatchBody.decision_preference`；`TransportTask.decision_preference`；`RequirementExtraction.decision_preference`；任务 JSON 与抽取 JSON 中同名字段。

- [ ] **Step 1: 写路由失败测试**

在 `backend/tests/logistics/test_routes.py` 增加：

```python
def test_task_persists_and_rematches_decision_preference(client):
    resp = client.post(
        "/api/logistics/tasks",
        json={
            "origin": "白城",
            "destination": "深圳港",
            "variety_code": "corn",
            "quantity_tons": 120,
            "decision_preference": "cost",
        },
    )
    task = resp.json()
    assert task["decision_preference"] == "cost"

    first = client.post(
        f"/api/logistics/tasks/{task['id']}/match",
        json={"decision_preference": "cost"},
    )
    assert first.status_code == 200
    first_detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert first_detail["task"]["decision_preference"] == "cost"

    second = client.post(
        f"/api/logistics/tasks/{task['id']}/match",
        json={"decision_preference": "on_time"},
    )
    assert second.status_code == 200
    second_detail = client.get(f"/api/logistics/tasks/{task['id']}").json()
    assert second_detail["task"]["decision_preference"] == "on_time"
    assert next(p for p in second_detail["plans"] if p["plan_type"] == "primary")["title"].startswith("公路")


def test_invalid_decision_preference_rejected(client):
    resp = client.post(
        "/api/logistics/tasks",
        json={
            "origin": "白城",
            "destination": "深圳港",
            "quantity_tons": 120,
            "decision_preference": "fastest-at-any-cost",
        },
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: 写抽取结构失败测试**

在 `backend/tests/logistics/test_llm.py` 增加：

```python
def test_requirement_extraction_accepts_decision_preference():
    from app.logistics.llm import RequirementExtraction

    result = RequirementExtraction(decision_preference="cost")
    assert result.decision_preference == "cost"
```

- [ ] **Step 3: 运行测试并确认失败**

Run:

```bash
cd backend && pytest tests/logistics/test_routes.py::test_task_persists_and_rematches_decision_preference tests/logistics/test_routes.py::test_invalid_decision_preference_rejected tests/logistics/test_llm.py::test_requirement_extraction_accepts_decision_preference -v
```

Expected: 因模型、Pydantic 字段和响应字段尚不存在而失败。

- [ ] **Step 4: 增加数据字段和一次性 MySQL 兼容 SQL**

在 `TransportTask` 增加：

```python
decision_preference: Mapped[str] = mapped_column(String(16), default="balanced")
```

创建 `backend/migrations/20260823_add_logistics_decision_preference.sql`：

```sql
ALTER TABLE logistics_transport_tasks
ADD COLUMN decision_preference VARCHAR(16) NOT NULL DEFAULT 'balanced';
```

测试数据库每次由 SQLAlchemy 新建，无需执行该 SQL；已有本地 MySQL 表在启动新代码前执行一次。新数据库由 `Base.metadata.create_all` 直接创建字段。

- [ ] **Step 5: 扩展 Pydantic 请求、任务响应与匹配路由**

在 `backend/app/logistics/routes.py` 使用 `Literal`：

```python
from typing import Literal

DecisionPreference = Literal["on_time", "cost", "balanced"]


class TaskBody(EstimateBody):
    allow_split: bool = True
    source_type: str = "self"
    source_ref: str = ""
    extra_note: str = ""
    decision_preference: DecisionPreference = "balanced"


class MatchBody(BaseModel):
    decision_preference: DecisionPreference | None = None
```

`_task_dict` 返回 `decision_preference`；`post_task` 把字段交给 repository；`post_match` 接收 `body: MatchBody | None = None`。当 body 包含偏好时先更新任务字段并 `db.commit()`，随后把任务偏好传入 `match_plans`：

```python
if body is not None and body.decision_preference is not None:
    task.decision_preference = body.decision_preference
    db.commit()

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
        "decision_preference": task.decision_preference,
    },
)
```

- [ ] **Step 6: 扩展 AI 偏好抽取且保留用户控制权**

在 `RequirementExtraction` 增加：

```python
from typing import Literal

decision_preference: Literal["on_time", "cost", "balanced"] | None = Field(
    None,
    description="用户明确表达的决策偏好：准时 on_time、成本 cost、稳妥或综合 balanced",
)
```

在 `extract_requirements` 返回对象顶层增加：

```python
"decision_preference": result.decision_preference,
```

模型提示补充：“只有用户明确表达偏好时才填写 decision_preference，否则留空。”前端仅在用户尚未手动点击偏好时采用 AI 预选值。

- [ ] **Step 7: 运行后端物流测试全集**

Run: `cd backend && pytest tests/logistics -v`

Expected: 全部 PASS，旧的空请求体 `POST /tasks/{id}/match` 仍兼容。

- [ ] **Step 8: 检查本任务差异**

Run:

```bash
git diff --check -- backend/app/logistics backend/tests/logistics backend/migrations/20260823_add_logistics_decision_preference.sql
git status --short
```

Expected: 无空白错误；新 SQL 文件和预期后端文件出现变更；不执行 Git 提交。

---

### Task 3: 建立前端类型、API 和跨 Tab 预填数据流

**Files:**
- Modify: `web/src/features/yun/types.ts`
- Modify: `web/src/features/yun/api.ts`
- Modify: `web/src/features/yun/YunPage.tsx`
- Modify: `web/src/features/yun/TasksTab.tsx`

**Interfaces:**
- Consumes: Task 2 的任务与匹配 API。
- Produces: `DecisionPreference`、`TransportPlanPrefill`、带偏好的 `TaskRequest`、`matchTask(taskId, preference)`；`YunPage` 把预填条件传给 `PlansTab`。

- [ ] **Step 1: 在类型文件定义稳定接口**

在 `web/src/features/yun/types.ts` 增加：

```typescript
export type DecisionPreference = "on_time" | "cost" | "balanced";

export interface TransportPlanPrefill {
  origin?: string;
  destination?: string;
  variety_code?: string;
  quantity_tons?: number;
  deadline_date?: string | null;
  source_type: "line" | "estimate";
  source_ref?: string;
}
```

给 `TaskRequest`、`TransportTask` 增加 `decision_preference`，给 `ExtractResponse` 增加 `decision_preference?: DecisionPreference | null`。

- [ ] **Step 2: 修改 API 函数签名**

在 `web/src/features/yun/api.ts`：

```typescript
export const matchTask = (taskId: number, decisionPreference?: DecisionPreference) =>
  post<{ matched: number; primary: boolean }>(
    `/api/logistics/tasks/${taskId}/match`,
    decisionPreference ? { decision_preference: decisionPreference } : undefined
  );
```

从 `./types` 导入 `DecisionPreference`。

- [ ] **Step 3: 将预填状态从“测算记录”改成“运输方案条件”**

在 `YunPage.tsx` 用：

```typescript
const [planPrefill, setPlanPrefill] = useState<TransportPlanPrefill | null>(null);
```

`PlansTab` 接收 `prefill`、`onPrefillConsumed`、`onTaskCreated`。`TasksTab.onReuseEstimate` 将测算记录转换为 `TransportPlanPrefill` 并切换到索引 1；不再切回找物流。

在 `PlansTab.tsx` 先把 props 接口精确扩展为：

```typescript
interface Props {
  taskId: number | null;
  prefill: TransportPlanPrefill | null;
  onPrefillConsumed: () => void;
  onTaskCreated: (taskId: number) => void;
  onInquiryCreated: () => void;
}
```

Task 3 只完成类型和跨 Tab 接线，Task 4 使用这三个新 props 实现输入态。

- [ ] **Step 4: 更新任务空状态文案**

将 `TasksTab` 中“去「找物流」发起第一笔”改为“去「运输方案」发起第一笔”。保留历史即时测算列表，按钮文案改为“带入运输方案”。

- [ ] **Step 5: 运行 TypeScript 构建并修正所有调用点**

Run: `cd web && npm run build`

Expected: PASS；`PlansTab` 使用上述精确 props 接口，未使用的 props 在 Task 4 前通过 `void prefill; void onPrefillConsumed; void onTaskCreated;` 显式标记，不使用 `any` 或可选占位类型。

- [ ] **Step 6: 检查本任务差异**

Run:

```bash
git diff --check -- web/src/features/yun/types.ts web/src/features/yun/api.ts web/src/features/yun/YunPage.tsx web/src/features/yun/TasksTab.tsx
git diff -- web/src/features/yun/types.ts web/src/features/yun/api.ts web/src/features/yun/YunPage.tsx web/src/features/yun/TasksTab.tsx
```

Expected: 数据流只指向运输方案 Tab；不执行 Git 提交。

---

### Task 4: 实现一句话输入与需求确认卡

**Files:**
- Create: `web/src/features/yun/TransportPlanComposer.tsx`
- Create: `web/src/features/yun/RequirementConfirmCard.tsx`
- Modify: `web/src/features/yun/PlansTab.tsx`

**Interfaces:**
- Consumes: `fetchLogisticsMeta()`、`extractRequirements(text)`、`createTask(body)`、`matchTask(id, preference)`；Task 3 的 `TransportPlanPrefill`。
- Produces: `TransportPlanComposer.onTaskCreated(taskId: number)`；确认卡返回完整的 `TaskRequest`。

- [ ] **Step 1: 创建确认卡的明确 props 和缺失字段规则**

`RequirementConfirmCard.tsx` 导出：

```typescript
export interface RequirementDraft {
  origin: string;
  destination: string;
  variety_code: string;
  quantity_tons: string;
  deadline_date: string;
}

interface RequirementConfirmCardProps {
  draft: RequirementDraft;
  nodes: string[];
  varieties: { code: string; name: string }[];
  missing: Array<"origin" | "destination" | "quantity_tons">;
  onChange: (next: RequirementDraft) => void;
  onConfirm: () => void;
  busy: boolean;
}
```

发货地、收货地、数量为必填；最晚到货允许为空。缺失项使用 `border-amber-400/70`，确认按钮在 `missing.length > 0` 时禁用。

- [ ] **Step 2: 创建输入容器和偏好选择**

`TransportPlanComposer.tsx` 内部状态：

```typescript
const [text, setText] = useState("");
const [preference, setPreference] = useState<DecisionPreference>("balanced");
const [preferenceTouched, setPreferenceTouched] = useState(false);
const [draft, setDraft] = useState<RequirementDraft>(EMPTY_DRAFT);
const [confirming, setConfirming] = useState(false);
const [assumptions, setAssumptions] = useState<string[]>([]);
const [busy, setBusy] = useState(false);
const [error, setError] = useState<string | null>(null);
```

组件挂载时调用 `fetchLogisticsMeta()` 获取节点、品种和数据更新时间；加载失败时显示“线路基础数据未就绪”，不允许创建任务。确认卡在字段下方展示 `assumptions`，文案前缀固定为“运小二理解：”。

三个按钮固定映射：

```typescript
const PREFERENCES = [
  { value: "on_time" as const, label: "准时优先", hint: "先比时效" },
  { value: "cost" as const, label: "成本优先", hint: "先比费用" },
  { value: "balanced" as const, label: "均衡决策", hint: "费用与时效兼顾" },
];
```

- [ ] **Step 3: 实现抽取和降级**

点击“智能生成方案”时：

```typescript
const result = await extractRequirements(text.trim());
if (result.llm_available && result.fields) {
  setDraft((current) => mergeExtractedFields(current, result.fields));
  setAssumptions(result.assumptions ?? []);
  if (!preferenceTouched && result.decision_preference) {
    setPreference(result.decision_preference);
  }
}
setConfirming(true);
```

AI 不可用或失败时仍 `setConfirming(true)`，保留原始输入并显示：“智能理解暂不可用，请确认下方运输条件后继续。”不清空用户内容。

- [ ] **Step 4: 确认后创建任务并匹配**

确认动作严格按顺序执行：

```typescript
const task = await createTask({
  origin: draft.origin,
  destination: draft.destination,
  variety_code: draft.variety_code,
  quantity_tons: Number(draft.quantity_tons),
  deadline_date: draft.deadline_date || null,
  decision_preference: preference,
  source_type: prefill?.source_type === "estimate" ? "estimate" : "self",
  source_ref: prefill?.source_ref ?? "",
});
await matchTask(task.id, preference);
onTaskCreated(task.id);
```

按钮状态依次使用“理解需求中…”与“匹配方案中…”，异常时保留 `draft` 和 `text`。

- [ ] **Step 5: 在 PlansTab 无任务状态挂载 Composer**

`taskId == null` 时渲染 `TransportPlanComposer`，不再显示“请先在找物流生成正式运输需求”。`prefill` 到达后填入 draft 并调用 `onPrefillConsumed()` 一次。

- [ ] **Step 6: 运行前端构建**

Run: `cd web && npm run build`

Expected: `tsc` 与 Vite 均 PASS，无隐式 `any`、未使用变量或 props 不匹配。

- [ ] **Step 7: 手工验证输入态**

Run: `cd web && npm run dev`

验证：

1. 运输方案初始页显示一句话输入和三种偏好，默认均衡决策。
2. 输入不完整需求后出现确认卡，缺失项高亮且不能提交。
3. AI 不可用时仍可手工填完并匹配。
4. 输入与确认卡在接口失败后仍保留。

- [ ] **Step 8: 检查本任务差异**

Run:

```bash
git diff --check -- web/src/features/yun/TransportPlanComposer.tsx web/src/features/yun/RequirementConfirmCard.tsx web/src/features/yun/PlansTab.tsx
git status --short
```

Expected: 无空白错误；不执行 Git 提交。

---

### Task 5: 实现主推方案、参照方案与偏好重排

**Files:**
- Create: `web/src/features/yun/PlanDecisionCard.tsx`
- Create: `web/src/features/yun/PlanReferenceCards.tsx`
- Create: `web/src/features/yun/planReferences.ts`
- Modify: `web/src/features/yun/PlansTab.tsx`

**Interfaces:**
- Consumes: `TaskDetail.plans`、`TransportTask.decision_preference`、`matchTask`、`createInquiry`。
- Produces: `selectPlanReferences(primary, plans) -> { faster: TransportPlan | null; cheaper: TransportPlan | null }`；主推卡触发 `onAdopt(planId)`；参照卡无采用动作。

- [ ] **Step 1: 实现不重复参照选择纯函数**

`planReferences.ts`：

```typescript
import type { TransportPlan } from "./types";

const midPrice = (plan: TransportPlan) => (plan.price_low + plan.price_high) / 2;

export function selectPlanReferences(
  primary: TransportPlan,
  plans: TransportPlan[]
): { faster: TransportPlan | null; cheaper: TransportPlan | null } {
  const others = plans.filter((plan) => plan.id !== primary.id);
  const faster = [...others]
    .filter((plan) => plan.days_high < primary.days_high)
    .sort((a, b) => a.days_high - b.days_high || midPrice(a) - midPrice(b))[0] ?? null;
  const cheaper = [...others]
    .filter((plan) => plan.id !== faster?.id && midPrice(plan) < midPrice(primary))
    .sort((a, b) => midPrice(a) - midPrice(b) || a.days_high - b.days_high)[0] ?? null;
  return { faster, cheaper };
}
```

若不存在真正更快或更省的候选，对应位置不渲染，不用较慢或较贵方案冒充。

- [ ] **Step 2: 创建整行主推方案卡**

`PlanDecisionCard` 显示路线、元/吨区间、总运费区间、时效、换装、期限判断、风险、推荐理由和采用动作。总运费使用：

```typescript
const totalLow = plan.price_low * quantityTons;
const totalHigh = plan.price_high * quantityTons;
```

格式化为万元时保留两位小数。主卡使用整行布局和绿色强调边框，不显示无口径分数。

- [ ] **Step 3: 创建参照卡并区分未入选状态**

`PlanReferenceCards` 接收 `faster`、`cheaper`、`primary`。差异文案由真实数字计算：

```typescript
const priceDiff = Math.round(midPrice(reference) - midPrice(primary));
const dayDiff = reference.days_high - primary.days_high;
```

当 `reference.plan_type === "rejected"` 时显示“未入选”和 `reference.reason`，不渲染采用按钮。A1 结构只允许主推方案采用，所有参照均为解释信息。

- [ ] **Step 4: 在 PlansTab 组合结果态与无解态**

结果态顺序固定为：需求摘要与偏好切换 → 四步完成状态 → 主推方案 → 参照方案 → 未入选折叠区 → 问运小二。

没有主推时显示 `task.blocked_note` 和“修改运输条件”动作，不渲染空主卡。

`PlansTab` 同时调用 `fetchLogisticsMeta()`，在结果依据区展示 `meta.data_updated_at`，并显示“实际报价与运力以询运反馈为准”。

- [ ] **Step 5: 实现结果生成后的偏好重排**

用户切换偏好后执行：

```typescript
setBusy(true);
await matchTask(task.id, nextPreference);
const refreshed = await fetchTaskDetail(task.id);
setDetail(refreshed);
setBusy(false);
```

该操作沿用已确认条件，不重新显示确认卡。失败时保留旧方案并展示“重新排序失败，请重试”。

- [ ] **Step 6: 保持询运动作安全**

只有 `primary.id` 传给 `createInquiry`。保留后端“rejected 不能生成询运单”的保护测试；前端参照卡不提供 CTA。

- [ ] **Step 7: 运行前端构建与页面验证**

Run: `cd web && npm run build`

Expected: PASS。

手工验证同一白城—深圳港任务：

1. 均衡决策突出一个主推方案。
2. 更快与更省卡片数字差异正确且不重复。
3. 水陆联运超期时标记未入选且无采用动作。
4. 切换准时优先后主推刷新，需求卡不重复出现。
5. 采用主推后进入询运对接。

- [ ] **Step 8: 检查本任务差异**

Run:

```bash
git diff --check -- web/src/features/yun/PlanDecisionCard.tsx web/src/features/yun/PlanReferenceCards.tsx web/src/features/yun/planReferences.ts web/src/features/yun/PlansTab.tsx
git status --short
```

Expected: 无空白错误；不执行 Git 提交。

---

### Task 6: 将找物流收敛为市场浏览并完成端到端验收

**Files:**
- Modify: `web/src/features/yun/FindLogisticsTab.tsx`
- Modify: `web/src/features/yun/YunPage.tsx`
- Modify: `web/src/features/yun/TasksTab.tsx`
- Test: `backend/tests/logistics/test_rules.py`
- Test: `backend/tests/logistics/test_routes.py`
- Test: `backend/tests/logistics/test_llm.py`

**Interfaces:**
- Consumes: `TransportPlanPrefill` 和前五个任务的完整流程。
- Produces: `FindLogisticsTab.onUseLine(prefill)`；可演示的四 Tab 闭环。

- [ ] **Step 1: 删除找物流中的方案受理职责**

从 `FindLogisticsTab.tsx` 删除自然语言输入、五字段表单、即时测算结果和“生成正式运输需求”动作。保留：

- 现有物流线路表格
- 热门线路价格走势
- 数据更新时间
- 数据未就绪错误态

线路行增加“带入运输方案”动作，传递：

```typescript
onUseLine({
  origin: line.origin,
  destination: line.destination,
  source_type: "line",
  source_ref: `${line.origin}-${line.destination}-${line.mode}`,
});
```

- [ ] **Step 2: 完成 YunPage 路由衔接**

收到 `onUseLine` 后设置 `planPrefill` 并切换到 Tab 索引 1。更新页面注释为“找物流市场浏览 + 运输方案智能决策 + 询运对接 + 运输任务”。

- [ ] **Step 3: 运行后端与前端完整验证**

Run:

```bash
cd backend && pytest tests/logistics -v
cd ../web && npm run build
```

Expected: 后端物流测试全部 PASS；前端 TypeScript 与 Vite 构建 PASS。

- [ ] **Step 4: 执行核心演示脚本**

使用规格中的固定案例：

1. 打开「运输方案」。
2. 输入“120 吨东北二等玉米，白城运到深圳港，8 月 30 日前到，稳妥一点”。
3. 确认系统抽取并预选“均衡决策”。
4. 确认需求卡并等待匹配。
5. 核对主推、真正更快参照、真正更省参照和超期说明。
6. 切换“准时优先”并核对主推刷新。
7. 采用主推并生成询运单。
8. 从「运输任务」恢复该任务，核对偏好与方案保持一致。
9. 返回「找物流」，选择一条线路并带入「运输方案」。

Expected: 输入到主推结果不超过“生成方案—确认需求—查看结果”三个操作；页面不出现 Mock 字样。

- [ ] **Step 5: 检查错误与降级状态**

依次验证：

- 缺少数量时确认卡高亮数量且禁用确认。
- 临时清空 `QWEN_API_KEY` 时可手工确认字段并继续匹配。
- 不存在可用线路时展示业务原因和放宽建议，不生成主推。
- 偏好重排请求失败时保留旧方案。
- 未入选参照无采用动作。

- [ ] **Step 6: 最终差异检查**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: 只包含本规格涉及的运小二文件、规格和计划；无自动提交。
