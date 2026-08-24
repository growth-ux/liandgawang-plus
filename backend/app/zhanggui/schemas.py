"""粮掌柜跨模块协议类型：目标、团队、专业结果、冲突与推荐。

金额和数量在 JSON 中一律使用字符串，避免浮点误差。
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

ConflictKind = Literal[
    "cost_vs_risk",
    "price_vs_deadline",
    "market_wait_vs_stock",
    "finance_cycle_vs_deadline",
    "quality_vs_delivered_cost",
]


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


class GoalField(BaseModel):
    """目标确认页展示的单个字段及其来源。"""

    key: str
    label: str
    value: str | None = None
    source: Literal["user", "memory", "estimated"] = "user"
    note: str = ""


class MemoryReference(BaseModel):
    content: str
    source: str = "企业过往经验"


class GoalPreview(BaseModel):
    goal: MissionGoal
    fields: list[GoalField] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)
    memory_references: list[MemoryReference] = Field(default_factory=list)
    llm_available: bool = False


class TeamMember(BaseModel):
    agent_id: str
    name: str
    selected: bool
    reason: str
    expected_output: str = ""


class AgentResult(BaseModel):
    """专业小二统一外层协议：粮掌柜只依赖该结构。"""

    agent_id: str
    status: Literal["completed", "completed_with_objection", "failed"] = "completed"
    summary: str = ""
    facts: dict[str, Any] = Field(default_factory=dict)
    recommendations: list[str] = Field(default_factory=list)
    risks: list[dict] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    evidence: list[dict] = Field(default_factory=list)
    impact_on_mission: str = ""
    available_actions: list[dict] = Field(default_factory=list)


class MissionConflict(BaseModel):
    kind: ConflictKind
    scheme_id: str | None = None
    agent_ids: list[str] = Field(default_factory=list)
    title: str
    detail: str = ""
    evidence: list[str] = Field(default_factory=list)
    severity: Literal["high", "medium", "low"] = "high"
    requires_human: bool = True
    supplement_requested: bool = False


class ActionDraft(BaseModel):
    """综合建议中的行动草稿，用户确认后转成行动任务。"""

    action_code: str
    agent_id: str
    title: str
    payload: dict = Field(default_factory=dict)
    scheme_id: str | None = None
    requires_prerequisite: bool = False


class MissionRecommendation(BaseModel):
    primary_scheme_id: str
    backup_scheme_id: str | None = None
    summary: str
    reasons: list[str] = Field(default_factory=list)
    tradeoffs: list[str] = Field(default_factory=list)
    condition: str | None = None
    fallback_trigger: str | None = None
    next_actions: list[ActionDraft] = Field(default_factory=list)


class DecisionOption(BaseModel):
    action: str
    label: str
    description: str = ""
