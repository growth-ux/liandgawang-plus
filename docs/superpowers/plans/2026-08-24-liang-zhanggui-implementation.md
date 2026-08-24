# 粮掌柜复杂采购多 Agent 协作指挥舱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一条可完整演示的复杂玉米补库任务链路：自然语言目标理解、按需组队、专业小二并行办理、冲突会商、Human-in-the-loop 决策、行动任务与共享经验沉淀。

**Architecture:** 后端新增 `app.zhanggui` 领域模块，用 MySQL 保存任务、Agent 运行、人工决策和行动任务；LangGraph 负责专业节点编排，确定性规则负责组队、冲突和动作门禁，现有专业模块通过适配器接入。前端新增独立 `features/zhanggui` 页面，用 React 状态驱动 CSS 2.5D 舞台和 SVG 数据流，不引入 WebGL。

**Tech Stack:** Python 3.12、FastAPI、SQLAlchemy 2、MySQL、Pydantic 2、LangGraph 1.x、LangChain、mem0 可选、React 18、TypeScript 5.6、Tailwind CSS 4、SVG、pytest。

**Spec:** `docs/superpowers/specs/2026-08-24-liang-zhanggui-design.md`

## Global Constraints

- 始终使用简体中文沟通；页面业务文案使用简体中文。
- 后端继续使用 FastAPI，本地存储继续使用 Docker MySQL，前端继续使用 React。
- Agent 编排使用 LangGraph/LangChain，企业共享记忆使用 mem0 并保留 MySQL 降级。
- 只实现竞赛所需闭环，不建设消息队列、软删除、分布式调度、通用 Agent 平台或复杂权限。
- 2.5D 只使用 CSS、SVG 和 React 状态，不引入 Three.js、WebGL 或三维模型。
- 页面不出现“Mock 数据”字样；来源文案使用“平台粮源信息”“企业采购资料”“用户输入”“业务测算结果”。
- 高影响动作必须经过 Human-in-the-loop，不能自动放宽质量、预算、交期或风险底线。
- 禁止自动执行 `git commit`；每个任务末尾只检查差异，由用户决定是否提交。
- 实现时先阅读本计划与设计规格，保留工作区内与本功能无关的用户改动。

---

## File Structure

### Backend files to create

- `backend/app/zhanggui/__init__.py`：模块入口。
- `backend/app/zhanggui/models.py`：任务、Agent 运行、人工决策、行动任务模型。
- `backend/app/zhanggui/schemas.py`：目标、团队、Agent 结果、冲突、方案和 API 请求响应类型。
- `backend/app/zhanggui/repository.py`：粮掌柜领域的唯一持久化入口。
- `backend/app/zhanggui/goal_parser.py`：自然语言目标提取、规则降级和企业记忆引用。
- `backend/app/zhanggui/team_rules.py`：按目标选择专业小二。
- `backend/app/zhanggui/conflict_rules.py`：五类跨专业冲突检测。
- `backend/app/zhanggui/synthesizer.py`：主推、备选和条件化建议生成。
- `backend/app/zhanggui/graph.py`：LangGraph 状态与执行节点。
- `backend/app/zhanggui/service.py`：API 用例层，管理状态转换与人工闸门。
- `backend/app/zhanggui/routes.py`：HTTP 与 NDJSON 接口。
- `backend/app/zhanggui/adapters/base.py`：专业小二统一协议。
- `backend/app/zhanggui/adapters/zhan.py`：行情研判适配器。
- `backend/app/zhanggui/adapters/liang.py`：粮源寻采适配器。
- `backend/app/zhanggui/adapters/yun.py`：运输方案适配器。
- `backend/app/zhanggui/adapters/suan.py`：综合成本适配器。
- `backend/app/zhanggui/adapters/qian.py`：资金服务适配器。
- `backend/app/zhanggui/adapters/an.py`：合作方风险审核适配器。
- `backend/app/zhanggui/demo_data.py`：稳定、合理的主演示候选数据和风险证据。
- `backend/migrations/20260824_add_zhanggui_tables.sql`：MySQL 增量表结构与共享经验来源字段。

### Backend files to modify

- `backend/app/main.py`：注册粮掌柜模型和路由。
- `backend/app/knowledge/models.py`：共享经验增加 `source_type`。
- `backend/app/knowledge/repository.py`：按来源类型去重经验。
- `backend/tests/conftest.py`：注册粮掌柜模型。

### Backend tests to create

- `backend/tests/zhanggui/conftest.py`：主演示目标和 Agent 结果工厂。
- `backend/tests/zhanggui/test_models_repository.py`
- `backend/tests/zhanggui/test_goal_team.py`
- `backend/tests/zhanggui/test_adapters.py`
- `backend/tests/zhanggui/test_conflicts_synthesis.py`
- `backend/tests/zhanggui/test_graph_service.py`
- `backend/tests/zhanggui/test_routes.py`

### Frontend files to create

- `web/src/features/zhanggui/types.ts`：API 与 UI 状态类型。
- `web/src/features/zhanggui/api.ts`：粮掌柜 API 和 NDJSON 消费器。
- `web/src/features/zhanggui/ZhangguiPage.tsx`：页面状态路由。
- `web/src/features/zhanggui/MissionStart.tsx`：目标输入和最近任务。
- `web/src/features/zhanggui/GoalConfirmation.tsx`：目标确认。
- `web/src/features/zhanggui/TeamConfirmation.tsx`：团队确认。
- `web/src/features/zhanggui/MissionCockpit.tsx`：指挥舱组合组件。
- `web/src/features/zhanggui/MissionRail.tsx`：任务阶段轨。
- `web/src/features/zhanggui/SpatialAgentStage.tsx`：2.5D 协作舞台。
- `web/src/features/zhanggui/AgentPod.tsx`：单个小二节点。
- `web/src/features/zhanggui/AgentFlowSvg.tsx`：正常、冲突和待命连线。
- `web/src/features/zhanggui/DecisionGate.tsx`：人工决策闸门。
- `web/src/features/zhanggui/AgentResultDrawer.tsx`：专业结果抽屉。
- `web/src/features/zhanggui/PlanComparison.tsx`：主推与备选对比。
- `web/src/features/zhanggui/DecisionTrace.tsx`：决策轨迹。
- `web/src/features/zhanggui/ActionTaskList.tsx`：行动任务。
- `web/src/features/zhanggui/HistoryView.tsx`：历史任务与恢复入口。
- `web/src/features/zhanggui/zhanggui.css`：2.5D 视觉和降级样式。

### Frontend files to modify

- `web/src/pages/agents/AgentServicePage.tsx`：`da` 路由到 `ZhangguiPage`。
- `web/src/data/agents.ts`：粮掌柜页内入口收敛为新任务与历史任务。
- `web/src/pages/MyTasks.tsx`：展示粮掌柜生成的行动任务。

---

### Task 1: 建立任务持久化与共享经验来源

**Files:**
- Create: `backend/app/zhanggui/__init__.py`
- Create: `backend/app/zhanggui/models.py`
- Create: `backend/app/zhanggui/repository.py`
- Create: `backend/migrations/20260824_add_zhanggui_tables.sql`
- Modify: `backend/app/knowledge/models.py`
- Modify: `backend/app/knowledge/repository.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/zhanggui/test_models_repository.py`
- Test: `backend/tests/knowledge/test_experiences.py`

**Interfaces:**
- Produces: `create_mission(db, raw_request, goal) -> ProcurementMission`
- Produces: `get_mission_snapshot(db, mission_id) -> dict | None`
- Produces: `set_mission_state(db, mission, *, phase, status, **snapshots) -> ProcurementMission`
- Produces: `upsert_agent_run(db, mission_id, agent_id, **fields) -> MissionAgentRun`
- Produces: `create_decision(db, mission_id, gate_type, prompt, options, recommendation) -> MissionDecision`
- Produces: `create_action_tasks(db, mission_id, actions) -> list[MissionActionTask]`
- Changes: `knowledge.repository.create_experience(..., source_type="costing")`

- [ ] **Step 1: 写失败的持久化测试**

```python
from app.zhanggui import repository


def test_mission_snapshot_contains_runs_decisions_and_actions(db_session):
    mission = repository.create_mission(
        db_session,
        raw_request="未来15天采购200吨玉米",
        goal={"variety_name": "玉米", "quantity_tons": "200"},
    )
    repository.upsert_agent_run(
        db_session, mission.id, "liang",
        participation_reason="需要寻找粮源",
        status="completed",
        input_snapshot={"quantity_tons": "200"},
        output_snapshot={"summary": "找到3个候选"},
    )
    decision = repository.create_decision(
        db_session, mission.id, "goal", "请确认目标",
        [{"action": "confirm", "label": "确认"}], "建议确认",
    )
    repository.confirm_decision(db_session, decision, "confirm", "")
    repository.create_action_tasks(db_session, mission.id, [{
        "action_code": "ACT-VERIFY-A", "agent_id": "an", "title": "核验A履约担保",
        "payload": {"supplier_code": "SUP-A"}, "status": "ready",
    }])

    snapshot = repository.get_mission_snapshot(db_session, mission.id)
    assert snapshot["status"] == "awaiting_goal_confirmation"
    assert snapshot["agent_runs"][0]["agent_id"] == "liang"
    assert snapshot["decisions"][0]["selected_action"] == "confirm"
    assert snapshot["action_tasks"][0]["status"] == "ready"
```

- [ ] **Step 2: 运行测试确认因模块不存在而失败**

Run: `cd backend && pytest tests/zhanggui/test_models_repository.py -v`

Expected: FAIL，提示 `app.zhanggui.models` 或 repository 接口不存在。

- [ ] **Step 3: 实现四个最小模型**

```python
class ProcurementMission(Base):
    __tablename__ = "procurement_missions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mission_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(128), default="复杂采购任务")
    raw_request: Mapped[str] = mapped_column(Text)
    goal_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    memory_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    team_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    conflict_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    recommendation_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    phase: Mapped[str] = mapped_column(String(32), default="goal_confirmation")
    status: Mapped[str] = mapped_column(String(32), default="awaiting_goal_confirmation")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
```

同文件实现 `MissionAgentRun`、`MissionDecision`、`MissionActionTask`。JSON 字段保存快照；`MissionActionTask.prerequisite_action_id` 允许为空；`MissionAgentRun` 对 `(mission_id, agent_id)` 设置唯一约束。

- [ ] **Step 4: 扩展共享经验来源，不破坏算小二调用**

```python
class SharedExperience(Base):
    __tablename__ = "shared_experiences"
    __table_args__ = (UniqueConstraint("source_type", "source_record_id", name="uq_experience_source"),)
    # existing fields...
    source_type: Mapped[str] = mapped_column(String(32), default="costing", index=True)
```

`create_experience` 增加关键字参数 `source_type: str = "costing"`，查询条件同时匹配来源类型和记录 ID；返回字典增加 `source_type`。迁移 SQL 先新增 `source_type` 默认 `costing`，再将旧单列唯一索引替换为组合唯一索引，并创建四张粮掌柜表。

- [ ] **Step 5: 实现 repository 序列化和状态更新**

repository 统一提交事务，`get_mission_snapshot` 返回：

```python
{
    "id": mission.id,
    "mission_code": mission.mission_code,
    "title": mission.title,
    "raw_request": mission.raw_request,
    "goal": mission.goal_snapshot or {},
    "memory_references": mission.memory_snapshot or [],
    "team": mission.team_snapshot or [],
    "conflicts": mission.conflict_snapshot or [],
    "recommendation": mission.recommendation_snapshot,
    "phase": mission.phase,
    "status": mission.status,
    "agent_runs": [...],
    "decisions": [...],
    "action_tasks": [...],
}
```

- [ ] **Step 6: 运行持久化和知识库回归测试**

Run: `cd backend && pytest tests/zhanggui/test_models_repository.py tests/knowledge/test_experiences.py -v`

Expected: PASS。

- [ ] **Step 7: 检查差异，不提交**

Run: `git diff --check && git status --short`

Expected: 无空白错误；保留未提交改动。

---

### Task 2: 实现目标理解、记忆引用与按需组队

**Files:**
- Create: `backend/app/zhanggui/schemas.py`
- Create: `backend/app/zhanggui/goal_parser.py`
- Create: `backend/app/zhanggui/team_rules.py`
- Test: `backend/tests/zhanggui/conftest.py`
- Test: `backend/tests/zhanggui/test_goal_team.py`

**Interfaces:**
- Produces: `parse_goal(text: str, *, today: date, memories: list[str]) -> GoalPreview`
- Produces: `recommend_team(goal: MissionGoal) -> list[TeamMember]`
- Produces Pydantic types: `MissionGoal`, `GoalField`, `GoalPreview`, `TeamMember`, `AgentResult`, `MissionConflict`, `MissionRecommendation`, `DecisionOption`
- Consumes: `knowledge.memory.search_memories(query, limit=3)` with MySQL fallback from repository.

- [ ] **Step 1: 写目标提取和组队失败测试**

```python
from datetime import date
from app.zhanggui.goal_parser import parse_goal
from app.zhanggui.team_rules import recommend_team


def test_demo_goal_extracts_fields_and_cites_memory():
    preview = parse_goal(
        "未来15天采购200吨二等玉米到潍坊，不能影响生产",
        today=date(2026, 8, 24),
        memories=["企业采购通常优先保供，再比较综合成本。"],
    )
    assert preview.goal.variety_code == "corn"
    assert preview.goal.quantity_tons == "200"
    assert preview.goal.deadline_date == "2026-09-08"
    assert preview.goal.destination == "潍坊"
    assert preview.memory_references[0].source == "企业过往经验"
    assert "预算" in preview.questions


def test_no_financing_gap_keeps_qian_out_of_team():
    preview = parse_goal("15天采购200吨玉米到潍坊", today=date(2026, 8, 24), memories=[])
    team = recommend_team(preview.goal)
    ids = [item.agent_id for item in team if item.selected]
    assert ids == ["zhan", "liang", "yun", "suan", "an"]
    qian = next(item for item in team if item.agent_id == "qian")
    assert qian.selected is False
    assert qian.reason == "当前未发现资金缺口或账期需求"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && pytest tests/zhanggui/test_goal_team.py -v`

Expected: FAIL，提示目标类型或解析函数不存在。

- [ ] **Step 3: 定义稳定的 Pydantic 协议**

```python
class MissionGoal(BaseModel):
    variety_code: str = "corn"
    variety_name: str = "玉米"
    grade: str | None = None
    quantity_tons: str | None = None
    deadline_date: str | None = None
    destination: str | None = None
    budget_yuan_per_ton: str | None = None
    stock_days: int | None = None
    financing_gap_yuan: str | None = None
    priority: Literal["supply", "balanced", "cost"] = "supply"
    hard_constraints: list[str] = Field(default_factory=list)
```

`GoalPreview` 包含 `goal`、`fields`、`questions`、`memory_references` 和 `llm_available`。所有跨模块金额和数量在 JSON 中使用字符串，避免浮点误差。

- [ ] **Step 4: 实现规则兜底解析**

规则至少识别“200吨”“未来15天”“二等玉米”“到潍坊”“2500元/吨”“不能影响生产”。如果配置了模型，则通过 Pydantic 结构化输出补充规则结果；模型失败时完整回退规则结果。只对缺少的高影响字段生成问题，主演示输入固定询问预算或质量底线中的一个，不连续追问非关键字段。

- [ ] **Step 5: 实现确定性组队**

```python
def recommend_team(goal: MissionGoal) -> list[TeamMember]:
    selected = {
        "zhan": goal.deadline_date is not None,
        "liang": True,
        "yun": goal.destination is not None,
        "suan": True,
        "qian": goal.financing_gap_yuan not in (None, "", "0"),
        "an": True,
    }
    return [TeamMember(agent_id=agent_id, selected=selected[agent_id], reason=reason_for(agent_id, goal, selected[agent_id])) for agent_id in AGENT_ORDER]
```

顺序固定为 `zhan, liang, yun, suan, qian, an`，但执行图只运行 `selected=True` 的成员。

- [ ] **Step 6: 运行测试**

Run: `cd backend && pytest tests/zhanggui/test_goal_team.py -v`

Expected: PASS。

- [ ] **Step 7: 检查差异，不提交**

Run: `git diff --check && git status --short`

---

### Task 3: 接入六位专业小二的统一适配器

**Files:**
- Create: `backend/app/zhanggui/adapters/base.py`
- Create: `backend/app/zhanggui/adapters/zhan.py`
- Create: `backend/app/zhanggui/adapters/liang.py`
- Create: `backend/app/zhanggui/adapters/yun.py`
- Create: `backend/app/zhanggui/adapters/suan.py`
- Create: `backend/app/zhanggui/adapters/qian.py`
- Create: `backend/app/zhanggui/adapters/an.py`
- Create: `backend/app/zhanggui/demo_data.py`
- Test: `backend/tests/zhanggui/test_adapters.py`

**Interfaces:**
- Produces: `AgentContext(mission_id: int, goal: MissionGoal, prior_results: dict[str, AgentResult])`
- Produces: `run_agent(agent_id: str, db: Session, context: AgentContext) -> AgentResult`
- Each adapter exposes: `run(db: Session, context: AgentContext) -> AgentResult`
- Consumes existing rules: `build_procurement_judgment`, `run_sourcing_graph`, `match_plans`, `compare_schemes`, `match_products`.

- [ ] **Step 1: 写统一协议与主演示结果测试**

```python
from app.zhanggui.adapters.base import AgentContext, run_agent


def test_selected_agents_return_structured_results(db_session, demo_goal):
    prior = {}
    for agent_id in ["zhan", "liang", "yun"]:
        result = run_agent(agent_id, db_session, AgentContext(1, demo_goal, prior))
        prior[agent_id] = result
        assert result.agent_id == agent_id
        assert result.status == "completed"
        assert result.summary
        assert result.evidence


def test_suan_and_an_create_cost_and_risk_opinions(db_session, demo_goal, base_agent_results):
    suan = run_agent("suan", db_session, AgentContext(1, demo_goal, base_agent_results))
    an = run_agent("an", db_session, AgentContext(1, demo_goal, base_agent_results | {"suan": suan}))
    assert suan.facts["recommended_scheme_id"] == "A"
    assert suan.facts["saving_total_yuan"] == "3600.00"
    assert an.status == "completed_with_objection"
    assert an.risks[0]["code"] == "supplier_delivery_evidence_missing"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && pytest tests/zhanggui/test_adapters.py -v`

- [ ] **Step 3: 实现适配器注册表**

```python
Adapter = Callable[[Session, AgentContext], AgentResult]

ADAPTERS: dict[str, Adapter] = {
    "zhan": zhan.run,
    "liang": liang.run,
    "yun": yun.run,
    "suan": suan.run,
    "qian": qian.run,
    "an": an.run,
}


def run_agent(agent_id: str, db: Session, context: AgentContext) -> AgentResult:
    adapter = ADAPTERS.get(agent_id)
    if adapter is None:
        raise ValueError(f"未知小二：{agent_id}")
    return adapter(db, context)
```

- [ ] **Step 4: 接入已有专业规则并稳定主演示数据**

适配器边界如下：

- 瞻小二：读取现有行情数据并调用 `build_procurement_judgment`，返回分批采购建议、支持证据和失效条件。
- 粮小二：使用 `run_sourcing_graph` 对 `demo_data.py` 中三条合理候选执行筛选，返回 A、B 和淘汰候选。
- 运小二：调用 `match_plans` 形成两批汽运/联运结果，返回时效和吨运费。
- 算小二：将粮源和运输结果转换成 `SchemeInput`，调用 `compare_schemes`；主演示数据保证 A 比 B 总计低 3,600 元。
- 钱小二：只有存在 `financing_gap_yuan` 时调用 `match_products`，否则不运行。
- 安小二：根据候选供应量、历史最大单次交付量和当前证据时间识别履约证据不足，返回可核验动作，不修改粮小二结论。

`demo_data.py` 内部可以注明数据集版本，输出到页面时只保留业务来源标签。

- [ ] **Step 5: 保证专业失败可结构化降级**

`run_agent` 捕获适配器异常并返回：

```python
AgentResult(
    agent_id=agent_id,
    status="failed",
    summary="该专业结果暂时不可用",
    facts={}, recommendations=[], risks=[], missing_information=[str(exc)],
    evidence=[], impact_on_mission="综合方案将标记该专业结果缺失",
    available_actions=[{"action": "retry", "label": "重试该小二"}],
)
```

- [ ] **Step 6: 运行适配器测试和相关专业回归**

Run: `cd backend && pytest tests/zhanggui/test_adapters.py tests/analysis tests/liang tests/logistics tests/costing tests/finance -q`

Expected: PASS。

- [ ] **Step 7: 检查差异，不提交**

Run: `git diff --check && git status --short`

---

### Task 4: 实现冲突检测与条件化推荐

**Files:**
- Create: `backend/app/zhanggui/conflict_rules.py`
- Create: `backend/app/zhanggui/synthesizer.py`
- Test: `backend/tests/zhanggui/test_conflicts_synthesis.py`

**Interfaces:**
- Produces: `detect_conflicts(goal: MissionGoal, results: dict[str, AgentResult]) -> list[MissionConflict]`
- Produces: `build_recommendation(goal: MissionGoal, results: dict[str, AgentResult], conflicts: list[MissionConflict]) -> MissionRecommendation`
- Consumes: `AgentResult` from Task 2 and Task 3.

- [ ] **Step 1: 写成本与风险冲突失败测试**

```python
def test_cost_risk_conflict_becomes_conditional_recommendation(demo_goal, all_agent_results):
    conflicts = detect_conflicts(demo_goal, all_agent_results)
    conflict = next(item for item in conflicts if item.kind == "cost_vs_risk")
    assert set(conflict.agent_ids) == {"suan", "an"}
    assert conflict.requires_human is True

    recommendation = build_recommendation(demo_goal, all_agent_results, conflicts)
    assert recommendation.primary_scheme_id == "A"
    assert recommendation.backup_scheme_id == "B"
    assert "履约担保" in recommendation.condition
    assert recommendation.fallback_trigger == "今日无法完成核验或核验不通过"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && pytest tests/zhanggui/test_conflicts_synthesis.py -v`

- [ ] **Step 3: 实现五类确定性冲突**

`detect_conflicts` 只生成以下 `kind`：

```python
ConflictKind = Literal[
    "cost_vs_risk",
    "price_vs_deadline",
    "market_wait_vs_stock",
    "finance_cycle_vs_deadline",
    "quality_vs_delivered_cost",
]
```

每条冲突包含 `agent_ids`、`title`、`detail`、`evidence`、`severity`、`requires_human=True` 和 `supplement_requested=False`。同一 `kind + scheme_id` 只生成一条。

- [ ] **Step 4: 实现固定结构的条件化推荐**

```python
class MissionRecommendation(BaseModel):
    primary_scheme_id: str
    backup_scheme_id: str | None
    summary: str
    reasons: list[str]
    tradeoffs: list[str]
    condition: str | None
    fallback_trigger: str | None
    next_actions: list[ActionDraft]
```

主演示建议必须生成四个行动草稿：核验 A 履约担保、向 A 询价、向 B 保留备选、确认两批运输。后 3 个动作以前置核验结果控制状态。

- [ ] **Step 5: 运行测试**

Run: `cd backend && pytest tests/zhanggui/test_conflicts_synthesis.py -v`

Expected: PASS。

- [ ] **Step 6: 检查差异，不提交**

Run: `git diff --check && git status --short`

---

### Task 5: 实现 LangGraph 编排、状态转换和人工闸门

**Files:**
- Create: `backend/app/zhanggui/graph.py`
- Create: `backend/app/zhanggui/service.py`
- Test: `backend/tests/zhanggui/test_graph_service.py`

**Interfaces:**
- Produces: `MissionGraphState(TypedDict)`
- Produces: `run_professional_graph(session_factory: sessionmaker, mission_snapshot: dict, emit: Callable[[dict], None]) -> dict`
- Produces: `preview_mission(db, text) -> GoalPreview`
- Produces: `create_mission_from_preview(db, raw_request, goal, memories) -> dict`
- Produces: `confirm_goal(db, mission_id, goal) -> dict`
- Produces: `confirm_team(db, mission_id, team) -> dict`
- Produces: `run_until_gate(db, mission_id, emit) -> dict`
- Produces: `submit_decision(db, mission_id, decision_id, action, note) -> dict`

- [ ] **Step 1: 写三个人工闸门和并行运行失败测试**

```python
def test_service_cannot_run_before_team_confirmation(db_session, created_mission):
    with pytest.raises(MissionStateError, match="请先确认协作团队"):
        run_until_gate(db_session, created_mission.id, lambda event: None)


def test_confirm_team_runs_agents_and_stops_at_decision(db_session, confirmed_goal_mission):
    confirm_team(db_session, confirmed_goal_mission.id, confirmed_goal_mission.team_snapshot)
    events = []
    snapshot = run_until_gate(db_session, confirmed_goal_mission.id, events.append)
    assert snapshot["status"] == "awaiting_decision"
    assert {e["type"] for e in events} >= {"agent_started", "agent_completed", "conflict_found", "decision_required"}
    assert snapshot["recommendation"]["primary_scheme_id"] == "A"


def test_confirm_verify_action_creates_blocked_followups(db_session, decision_mission):
    decision = next(d for d in decision_mission.decisions if d.status == "pending")
    snapshot = submit_decision(db_session, decision_mission.id, decision.id, "verify_a", "")
    tasks = {item["action_code"]: item for item in snapshot["action_tasks"]}
    assert tasks["ACT-VERIFY-A"]["status"] == "ready"
    assert tasks["ACT-INQUIRY-A"]["status"] == "waiting_prerequisite"
    assert tasks["ACT-TRANSPORT-A"]["status"] == "waiting_prerequisite"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && pytest tests/zhanggui/test_graph_service.py -v`

- [ ] **Step 3: 构建 LangGraph 专业办理图**

```python
class MissionGraphState(TypedDict, total=False):
    mission_id: int
    goal: dict
    selected_agents: list[str]
    results: dict[str, dict]
    conflicts: list[dict]
    recommendation: dict


builder = StateGraph(MissionGraphState)
builder.add_node("parallel_professionals", parallel_professionals_node)
builder.add_node("dependent_costing", dependent_costing_node)
builder.add_node("risk_review", risk_review_node)
builder.add_node("detect_conflicts", conflict_node)
builder.add_node("synthesize", synthesis_node)
builder.add_edge(START, "parallel_professionals")
builder.add_edge("parallel_professionals", "dependent_costing")
builder.add_edge("dependent_costing", "risk_review")
builder.add_edge("risk_review", "detect_conflicts")
builder.add_edge("detect_conflicts", "synthesize")
builder.add_edge("synthesize", END)
MISSION_GRAPH = builder.compile()
```

`run_professional_graph` 使用 `_build_graph(session_factory, emit)` 为本次运行构建带闭包的图。`parallel_professionals_node` 使用 `ThreadPoolExecutor(max_workers=4)` 运行瞻、粮、运，以及仅在选中时运行的钱小二；每个 worker 必须通过 `session_factory()` 创建并关闭自己的 SQLAlchemy Session，严禁多个线程共享请求 Session。算小二消费粮、运、钱结果后运行；安小二最后独立审核完整组合。父线程汇总 future 后再通过请求 Session 写入 `mission_agent_runs`，并通过 `emit` 推送进度。

每个专业 future 的等待上限为 20 秒。超时转换为 `AgentResult(status="failed")` 和 `agent_failed` 事件；如果剩余结果仍能形成方案，任务进入 `partially_completed` 并继续等待用户决策，如果无法形成任何可用方案则进入 `failed`。

- [ ] **Step 4: 在 service 层实现持久化暂停与恢复**

三个闸门由任务状态控制：

```python
ALLOWED_TRANSITIONS = {
    "awaiting_goal_confirmation": {"awaiting_team_confirmation"},
    "awaiting_team_confirmation": {"running"},
    "running": {"awaiting_decision", "partially_completed", "failed"},
    "awaiting_decision": {"completed"},
    "partially_completed": {"completed"},
}
```

LangGraph 专业节点运行结束后将状态和结果写入 MySQL。页面刷新或服务重启时，`run_until_gate` 从任务快照重建 `MissionGraphState`，已完成 Agent 不重复运行。该方式满足持久化暂停恢复，不增加独立 checkpointer 数据库。

`confirm_goal`、`confirm_team` 和 `submit_decision` 都必须创建并确认一条 `MissionDecision`，因此决策轨迹能够完整显示三个人工闸门。`preview_mission` 先调用 mem0 搜索，返回空或异常时改用 `knowledge.repository.list_experiences` 中最多三条 active 经验；两个来源都不可用时返回空引用，不阻塞目标解析。

- [ ] **Step 5: 实现一次性定向补充限制**

冲突的 `supplement_requested` 初始为 `False`。如果需要补充，service 只重新运行冲突直接关联的小二一次，并在重新检测前设置为 `True`；补充后仍有冲突则直接生成决策闸门。

- [ ] **Step 6: 实现决策后的行动依赖**

选择 `verify_a` 时，创建 `ACT-VERIFY-A` 为 `ready`；询价、备选保留和运输动作使用 `prerequisite_action_id` 指向核验任务，并设为 `waiting_prerequisite`。选择 `choose_b` 时直接为 B 创建询价和运输 `ready` 任务，不创建 A 的执行动作。

- [ ] **Step 7: 运行图和服务测试**

Run: `cd backend && pytest tests/zhanggui/test_graph_service.py -v`

Expected: PASS。

- [ ] **Step 8: 检查差异，不提交**

Run: `git diff --check && git status --short`

---

### Task 6: 暴露粮掌柜 API 与 NDJSON 进度流

**Files:**
- Create: `backend/app/zhanggui/routes.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/zhanggui/test_routes.py`

**Interfaces:**
- Produces the API paths defined in the spec.
- NDJSON event shape: `{"type": str, "mission_id": int, "agent_id": str | null, "payload": dict}`.
- Consumes service functions from Task 5.

- [ ] **Step 1: 写完整 API 主链路失败测试**

```python
def test_demo_mission_api_reaches_human_decision(client):
    preview = client.post("/api/zhanggui/missions/preview", json={
        "text": "未来15天采购200吨二等玉米到潍坊，不能影响生产"
    })
    assert preview.status_code == 200

    created = client.post("/api/zhanggui/missions", json={
        "raw_request": "未来15天采购200吨二等玉米到潍坊，不能影响生产",
        "goal": preview.json()["goal"],
        "memory_references": preview.json()["memory_references"],
    }).json()
    mission_id = created["id"]

    goal = client.post(f"/api/zhanggui/missions/{mission_id}/confirm-goal", json={
        "goal": {**created["goal"], "budget_yuan_per_ton": "2500"}
    })
    assert goal.status_code == 200

    team = client.post(f"/api/zhanggui/missions/{mission_id}/confirm-team", json={
        "team": goal.json()["team"]
    })
    assert team.status_code == 200

    run = client.post(f"/api/zhanggui/missions/{mission_id}/run")
    assert run.status_code == 200
    assert run.json()["status"] == "awaiting_decision"
    assert run.json()["recommendation"]["primary_scheme_id"] == "A"
```

- [ ] **Step 2: 运行测试确认 404**

Run: `cd backend && pytest tests/zhanggui/test_routes.py -v`

- [ ] **Step 3: 实现请求类型与状态校验**

定义 `PreviewRequest`、`MissionCreateRequest`、`GoalConfirmRequest`、`TeamConfirmRequest` 和 `DecisionSubmitRequest`。service 抛出的 `MissionStateError` 统一转换成 HTTP 409；不存在返回 404；字段错误返回 422。

- [ ] **Step 4: 实现普通快照接口**

注册以下路由：

```python
router = APIRouter(prefix="/api/zhanggui", tags=["zhanggui"])

@router.post("/missions/preview")
@router.post("/missions")
@router.get("/missions")
@router.get("/missions/{mission_id}")
@router.post("/missions/{mission_id}/confirm-goal")
@router.post("/missions/{mission_id}/confirm-team")
@router.post("/missions/{mission_id}/run")
@router.post("/missions/{mission_id}/decisions/{decision_id}")
```

- [ ] **Step 5: 实现 NDJSON 事件接口**

`GET /missions/{mission_id}/events` 返回 `StreamingResponse(media_type="application/x-ndjson")`。每行使用 `json.dumps(event, ensure_ascii=False) + "\n"`。事件至少包含：`mission_started`、`agent_started`、`agent_completed`、`agent_failed`、`conflict_found`、`recommendation_ready`、`decision_required`。

该 GET 接口在任务状态为 `running` 时调用 `run_until_gate` 并实时产生事件；任务已经到达人工闸门时只发送当前快照和 `decision_required`，不会重复运行 Agent。`POST /run` 保留为不需要流式反馈的同步降级入口。

- [ ] **Step 6: 注册模型和路由**

在 `backend/app/main.py` 导入 `app.zhanggui.models` 并 `app.include_router(zhanggui_router)`；在 `backend/tests/conftest.py` 注册模型，保证 SQLite 测试建表。

- [ ] **Step 7: 运行 API 与全后端回归**

Run: `cd backend && pytest tests/zhanggui -q && pytest tests -q`

Expected: 全部 PASS。

- [ ] **Step 8: 检查差异，不提交**

Run: `git diff --check && git status --short`

---

### Task 7: 实现粮掌柜目标输入、目标确认和团队确认

**Files:**
- Create: `web/src/features/zhanggui/types.ts`
- Create: `web/src/features/zhanggui/api.ts`
- Create: `web/src/features/zhanggui/ZhangguiPage.tsx`
- Create: `web/src/features/zhanggui/MissionStart.tsx`
- Create: `web/src/features/zhanggui/GoalConfirmation.tsx`
- Create: `web/src/features/zhanggui/TeamConfirmation.tsx`
- Create: `web/src/features/zhanggui/MissionCockpit.tsx`
- Create: `web/src/features/zhanggui/HistoryView.tsx`
- Modify: `web/src/pages/agents/AgentServicePage.tsx`
- Modify: `web/src/data/agents.ts`

**Interfaces:**
- Produces: `MissionSnapshot`, `GoalPreview`, `TeamMember`, `AgentRun`, `Decision`, `ActionTask` TypeScript interfaces matching backend JSON.
- Produces: `previewGoal`, `createMission`, `confirmGoal`, `confirmTeam`, `runMission`, `submitDecision`, `fetchMission`, `fetchMissions`, `streamMissionEvents`.
- Produces: `<ZhangguiPage />` for `agent.id === "da"`.

- [ ] **Step 1: 先运行前端构建建立基线**

Run: `cd web && npm run build`

Expected: PASS。若基线失败，先记录现有错误，不把无关修复混入本任务。

- [ ] **Step 2: 定义与后端一致的核心类型**

```ts
export type MissionStatus =
  | "awaiting_goal_confirmation"
  | "awaiting_team_confirmation"
  | "running"
  | "awaiting_decision"
  | "partially_completed"
  | "completed"
  | "failed";

export interface MissionSnapshot {
  id: number;
  mission_code: string;
  title: string;
  raw_request: string;
  goal: MissionGoal;
  memory_references: MemoryReference[];
  team: TeamMember[];
  phase: string;
  status: MissionStatus;
  agent_runs: AgentRun[];
  decisions: MissionDecision[];
  conflicts: MissionConflict[];
  recommendation: MissionRecommendation | null;
  action_tasks: ActionTask[];
}
```

- [ ] **Step 3: 实现统一 API 错误和 NDJSON 解析**

```ts
export async function streamMissionEvents(
  missionId: number,
  onEvent: (event: MissionEvent) => void,
): Promise<void> {
  const response = await fetch(`/api/zhanggui/missions/${missionId}/events`);
  if (!response.ok || !response.body) throw await toApiError(response);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.filter(Boolean).forEach((line) => onEvent(JSON.parse(line)));
    if (done) break;
  }
}
```

- [ ] **Step 4: 实现页面状态路由**

`ZhangguiPage` 根据状态渲染：

```tsx
if (!mission) return <MissionStart onCreated={setMission} onOpenHistory={() => setView("history")} />;
if (mission.status === "awaiting_goal_confirmation") return <GoalConfirmation mission={mission} onConfirmed={setMission} />;
if (mission.status === "awaiting_team_confirmation") return <TeamConfirmation mission={mission} onConfirmed={setMission} />;
return <MissionCockpit mission={mission} onMissionChange={setMission} />;
```

浏览器地址使用 `?mission=<id>` 保存当前任务，刷新时调用 `fetchMission(id)` 恢复。

- [ ] **Step 5: 实现目标输入和两次确认**

`MissionStart` 默认示例为“未来15天采购200吨二等玉米到潍坊，不能影响生产”。输入主体使用多行文本框，允许直接粘贴报价；附件入口仅接受 `.txt`、`.csv` 和 `.md`，在浏览器端通过 `File.text()` 读取并追加到目标文本，不建设文件存储服务。`GoalConfirmation` 只要求用户确认高影响字段，并明确标记“用户输入”“企业过往经验”和“暂按估算”。`TeamConfirmation` 显示六位小二，已选五位，钱小二显示“当前未发现资金缺口或账期需求”。

- [ ] **Step 6: 接入粮掌柜独立页面**

在 `AgentServicePage` 专业页判断中增加：

```tsx
if (agent.id === "da") return <ZhangguiPage />;
```

`agents.ts` 中粮掌柜 `tabs` 收敛为 `["开始新任务", "历史任务"]`，但独立页面不渲染通用 Tab。

此任务先创建可工作的 `MissionCockpit` 基础版，确保 Task 7 自身可以构建和演示：

```tsx
export default function MissionCockpit({ mission, onMissionChange }: MissionCockpitProps) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
      <h1 className="text-xl font-semibold">{mission.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{mission.phase} · {mission.status}</p>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {mission.team.map((member) => <div key={member.agent_id}>{member.name} · {member.reason}</div>)}
      </div>
    </div>
  );
}
```

Task 8 在这个可构建基础版上升级 2.5D 指挥舱。

- [ ] **Step 7: 运行 TypeScript 构建**

Run: `cd web && npm run build`

Expected: PASS，无类型错误。

- [ ] **Step 8: 手动验证前段链路**

Run: `cd backend && uvicorn app.main:app --reload --port 8000`

Run in another terminal: `cd web && npm run dev`

Verify: 打开 `/agent/da`，输入示例目标，依次看到目标确认和团队确认；刷新后仍停留在当前任务。

- [ ] **Step 9: 检查差异，不提交**

Run: `git diff --check && git status --short`

---

### Task 8: 实现可交互 2.5D 多 Agent 指挥舱

**Files:**
- Modify: `web/src/features/zhanggui/MissionCockpit.tsx`
- Create: `web/src/features/zhanggui/MissionRail.tsx`
- Create: `web/src/features/zhanggui/SpatialAgentStage.tsx`
- Create: `web/src/features/zhanggui/AgentPod.tsx`
- Create: `web/src/features/zhanggui/AgentFlowSvg.tsx`
- Create: `web/src/features/zhanggui/DecisionGate.tsx`
- Create: `web/src/features/zhanggui/zhanggui.css`
- Modify: `web/src/features/zhanggui/ZhangguiPage.tsx`

**Interfaces:**
- `MissionCockpitProps { mission: MissionSnapshot; onMissionChange(next: MissionSnapshot): void }`
- `SpatialAgentStageProps { mission: MissionSnapshot; selectedAgentId: string | null; onSelectAgent(id: string): void }`
- `AgentPodProps { agent: TeamMember; run?: AgentRun; depth: "back" | "middle" | "front"; active: boolean; onClick(): void }`
- `AgentFlowSvgProps { mission: MissionSnapshot }`
- `DecisionGateProps { mission: MissionSnapshot; onResolved(next: MissionSnapshot): void }`

- [ ] **Step 1: 建立构建基线并创建静态组件骨架**

Run: `cd web && npm run build`

Upgrade `MissionCockpit` with exact layout regions:

```tsx
<div className="zg-cockpit">
  <header className="zg-mission-header">
    <div><span>粮掌柜多 Agent 任务</span><h1>{mission.title}</h1></div>
    <div>{mission.team.filter((item) => item.selected).length} 位小二协作 · {mission.decisions.filter((item) => item.status === "pending").length} 项待确认</div>
  </header>
  <div className="zg-cockpit-grid">
    <MissionRail phase={mission.phase} status={mission.status} />
    <SpatialAgentStage mission={mission} selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />
    <DecisionGate mission={mission} onResolved={onMissionChange} />
  </div>
</div>
```

此任务中的 `DecisionGate` 先完整展示当前待确认问题、AI 建议和选项，但暂不提交选择；Task 9 接入 `submitDecision` 和请求状态。

- [ ] **Step 2: 实现状态到空间深度的纯映射**

```ts
export function resolveAgentDepth(run: AgentRun | undefined, hasConflict: boolean) {
  if (hasConflict) return "front" as const;
  if (run?.status === "running") return "middle" as const;
  return "back" as const;
}
```

未参与小二同样位于后景，但显示“未参与”和后端返回的原因；失败小二保留位置并显示“结果缺失”，不从舞台消失。

- [ ] **Step 3: 实现 2.5D 舞台语义**

`zhanggui.css` 至少包含：

```css
.zg-spatial-stage { perspective: 1200px; transform-style: preserve-3d; overflow: hidden; }
.zg-agent-pod[data-depth="back"] { transform: translate3d(var(--x), var(--y), -100px) scale(.82); opacity: .55; }
.zg-agent-pod[data-depth="middle"] { transform: translate3d(var(--x), var(--y), 10px); opacity: 1; }
.zg-agent-pod[data-depth="front"] { transform: translate3d(var(--x), var(--y), 70px) scale(1.06); }
.zg-floor { transform: rotateX(66deg) translateZ(-70px); background-size: 42px 42px; }
@media (max-width: 1024px) {
  .zg-spatial-stage { perspective: none; }
  .zg-agent-pod { position: static; transform: none !important; }
}
```

中央粮掌柜使用 CSS 环形轨道和渐变光柱；动画只改变 `transform`、`opacity` 和 SVG `stroke-dashoffset`。

同时实现 `@media (prefers-reduced-motion: reduce)` 禁用循环动画；组件监听 `document.visibilitychange`，标签页不可见时在根节点增加 `data-paused="true"` 并暂停非必要动画。

- [ ] **Step 4: 实现真实状态驱动的 SVG 数据流**

`AgentFlowSvg` 根据 `mission.agent_runs` 和 `mission.conflicts` 生成连线：

- 运行中或已完成：蓝色动态线。
- 参与冲突：橙色快速动态线。
- 未参与：灰色静态虚线。
- 失败：红灰色断线并显示结果缺失。

不要使用独立定时器伪造 Agent 状态；只允许动画表达后端已有状态。

- [ ] **Step 5: 消费 NDJSON 并刷新快照**

团队确认后调用 `streamMissionEvents`。收到事件时先更新本地 Agent 状态以产生即时反馈；流结束后调用 `fetchMission` 获取权威快照。组件卸载时使用 `AbortController` 关闭流，避免重复连接。

- [ ] **Step 6: 运行构建和手动动态验证**

Run: `cd web && npm run build`

Verify: 多位小二开始时进入中景，完成后退入后景；算小二和安小二发生冲突时进入前景，相关连线切换为橙色；钱小二保持弱化待命。

- [ ] **Step 7: 检查性能降级**

Verify in browser devtools: 将视口缩至 1024px 以下，舞台切换为列表；切换浏览器标签页后非必要循环动画暂停；无横向溢出。

- [ ] **Step 8: 检查差异，不提交**

Run: `git diff --check && git status --short`

---

### Task 9: 完成专业结果、方案决策和行动任务闭环

**Files:**
- Modify: `web/src/features/zhanggui/DecisionGate.tsx`
- Create: `web/src/features/zhanggui/AgentResultDrawer.tsx`
- Create: `web/src/features/zhanggui/PlanComparison.tsx`
- Create: `web/src/features/zhanggui/DecisionTrace.tsx`
- Create: `web/src/features/zhanggui/ActionTaskList.tsx`
- Modify: `web/src/features/zhanggui/MissionCockpit.tsx`
- Modify: `web/src/features/zhanggui/HistoryView.tsx`
- Modify: `web/src/pages/MyTasks.tsx`

**Interfaces:**
- `DecisionGateProps { mission: MissionSnapshot; onResolved(next: MissionSnapshot): void }`
- `AgentResultDrawerProps { run: AgentRun | null; onClose(): void }`
- `PlanComparisonProps { recommendation: MissionRecommendation }`
- `ActionTaskListProps { tasks: ActionTask[] }`

- [ ] **Step 1: 实现专业结果抽屉**

点击 Agent 显示：子任务、输入字段来源、核心结论、事实、专业建议、风险异议、缺失信息、证据来源、更新时间和对综合方案的影响。失败结果显示重试入口，不能展示空白成功态。

- [ ] **Step 2: 实现方案对比**

`PlanComparison` 固定展示主推、备选和淘汰原因，不显示不透明综合分。主演示内容必须包含综合吨成本、总差额、到货时间、主要风险、生效条件和切换条件。

- [ ] **Step 3: 实现 Human-in-the-loop 决策闸门**

```tsx
<section className="zg-decision-gate">
  <p className="zg-gate-kicker">HUMAN-IN-THE-LOOP · 决策闸门</p>
  <h2>{decision.prompt}</h2>
  <p>{decision.ai_recommendation}</p>
  <div className="zg-gate-actions">
    {decision.options.map((option) => (
      <button key={option.action} onClick={() => resolve(option.action)}>
        {option.label}
      </button>
    ))}
  </div>
</section>
```

任何选项默认不选中；提交前展示“确认后会发生什么”。请求期间禁用按钮，失败后保留用户当前页面和错误信息。

- [ ] **Step 4: 实现行动依赖状态**

`ActionTaskList` 将 `ready` 显示为“待办理”，`waiting_prerequisite` 显示为“等待风险核验”，`completed` 显示为“已完成”。点击可办理任务跳转到对应 `/agent/{agent_id}`，并携带 `?mission=<id>&action=<action_code>`。

- [ ] **Step 5: 实现决策轨迹与历史恢复**

轨迹按时间显示目标确认、团队确认、Agent 完成、冲突发现、粮掌柜建议、用户选择和行动任务生成。`HistoryView` 展示任务状态、最近更新时间、主推方案和待确认数量，点击后恢复指挥舱。

- [ ] **Step 6: 将粮掌柜行动任务接入“我的办事”**

`MyTasks.tsx` 调用 `fetchMissions()`，扁平化 `action_tasks`。保留“全部、办理中、待我确认、已完成、已终止”筛选；没有数据时继续显示现有空状态。行动任务只读展示和跳转，不在本任务内重建通用任务后端。

- [ ] **Step 7: 运行构建并手动验证决策链路**

Run: `cd web && npm run build`

Verify:

1. 点击算小二和安小二可以看到不同原始结论。
2. 决策闸门展示“A 先核验，否则切换 B”。
3. 确认核验后，风险任务为待办理，询价与运输为等待前置任务。
4. 刷新粮掌柜和“我的办事”页面，状态保持一致。

- [ ] **Step 8: 检查差异，不提交**

Run: `git diff --check && git status --short`

---

### Task 10: 沉淀企业经验并完成端到端验收

**Files:**
- Modify: `backend/app/zhanggui/service.py`
- Modify: `backend/app/knowledge/repository.py`
- Modify: `web/src/pages/Knowledge.tsx`
- Modify: `backend/tests/zhanggui/test_graph_service.py`
- Modify: `backend/tests/zhanggui/test_routes.py`

**Interfaces:**
- Produces: `build_mission_experience(snapshot: dict) -> str | None`
- Consumes: `knowledge.repository.create_experience(..., source_type="zhanggui")`.

- [ ] **Step 1: 写最终方案确认后的经验沉淀失败测试**

```python
def test_confirmed_mission_creates_source_scoped_experience(db_session, decision_mission):
    decision = next(d for d in decision_mission.decisions if d.status == "pending")
    submit_decision(db_session, decision_mission.id, decision.id, "verify_a", "")
    items = knowledge_repo.list_experiences(db_session)
    experience = next(item for item in items if item["source_type"] == "zhanggui")
    assert experience["source_record_id"] == decision_mission.id
    assert "优先保供" in experience["content"]
    assert "履约担保" in experience["content"]
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && pytest tests/zhanggui/test_graph_service.py::test_confirmed_mission_creates_source_scoped_experience -v`

- [ ] **Step 3: 只沉淀稳定、已确认的决策经验**

`submit_decision` 在用户确认方案并生成行动任务后，将采购决策任务更新为 `completed`。行动任务继续保留自己的 `ready` 和 `waiting_prerequisite` 状态，不阻塞采购决策任务完成。`build_mission_experience` 仅在用户做出最终选择时返回内容。主演示经验为：

> 该企业玉米补库优先保证到货连续性；当低成本供应方履约证据不足时，应先核验履约担保，未通过则切换稳定备选。

使用 `source_type="zhanggui"` 和任务 ID 去重，并调用 `knowledge.memory.sync_experience`；mem0 失败不影响任务完成。

- [ ] **Step 4: 在企业知识库显示粮掌柜来源**

`Knowledge.tsx` 将 `source_type === "zhanggui"` 显示为“粮掌柜办事经验”，保留编辑和停用能力，不增加审核流程。

- [ ] **Step 5: 运行后端完整测试与前端构建**

Run: `cd backend && pytest tests -q`

Run: `cd web && npm run build`

Expected: 全部 PASS。

- [ ] **Step 6: 按竞赛脚本完成端到端手动验收**

Verify all 12 acceptance items from the spec, including refresh recovery, five selected agents, qian standby reason, cost-risk conflict, conditional recommendation, blocked follow-up actions, and shared experience visibility.

- [ ] **Step 7: 最终检查，不提交**

Run: `git diff --check`

Run: `git status --short`

Expected: 无空白错误；所有粮掌柜相关改动保持未提交，等待用户决定。
