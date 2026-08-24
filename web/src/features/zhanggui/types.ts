/** 粮掌柜：与后端 JSON 一致的 API 与 UI 状态类型 */

export type MissionStatus =
  | "awaiting_goal_confirmation"
  | "awaiting_team_confirmation"
  | "running"
  | "awaiting_decision"
  | "partially_completed"
  | "completed"
  | "failed";

export interface MissionGoal {
  variety_code: string;
  variety_name: string;
  grade?: string | null;
  quantity_tons?: string | null;
  deadline_date?: string | null;
  destination?: string | null;
  budget_yuan_per_ton?: string | null;
  stock_days?: number | null;
  financing_gap_yuan?: string | null;
  priority: "supply" | "balanced" | "cost";
  hard_constraints: string[];
}

export interface GoalField {
  key: string;
  label: string;
  value?: string | null;
  source: "user" | "memory" | "estimated";
  note?: string;
}

export interface MemoryReference {
  content: string;
  source: string;
}

export interface GoalPreview {
  goal: MissionGoal;
  fields: GoalField[];
  questions: string[];
  memory_references: MemoryReference[];
  llm_available: boolean;
}

export interface TeamMember {
  agent_id: string;
  name: string;
  selected: boolean;
  reason: string;
  expected_output?: string;
}

export interface AgentRun {
  agent_id: string;
  participation_reason: string;
  status: "pending" | "running" | "completed" | "completed_with_objection" | "failed";
  input_snapshot: Record<string, unknown>;
  output_snapshot: AgentResult | null;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface AgentEvidence {
  item: string;
  source: string;
}

export interface AgentRisk {
  code: string;
  scheme_id?: string | null;
  supplier_code?: string;
  supplier_name?: string;
  severity?: string;
  detail?: string;
}

export interface AgentResult {
  agent_id: string;
  status: "completed" | "completed_with_objection" | "failed";
  summary: string;
  facts: Record<string, unknown>;
  recommendations: string[];
  risks: AgentRisk[];
  missing_information: string[];
  evidence: AgentEvidence[];
  impact_on_mission: string;
  available_actions: { action: string; label: string }[];
}

export type ConflictKind =
  | "cost_vs_risk"
  | "price_vs_deadline"
  | "market_wait_vs_stock"
  | "finance_cycle_vs_deadline"
  | "quality_vs_delivered_cost";

export interface MissionConflict {
  kind: ConflictKind;
  scheme_id?: string | null;
  agent_ids: string[];
  title: string;
  detail: string;
  evidence: string[];
  severity: "high" | "medium" | "low";
  requires_human: boolean;
  supplement_requested: boolean;
  occurred_at?: string | null;
}

export interface ActionDraft {
  action_code: string;
  agent_id: string;
  title: string;
  payload: Record<string, unknown>;
  scheme_id?: string | null;
  requires_prerequisite: boolean;
}

export interface MissionRecommendation {
  primary_scheme_id: string;
  backup_scheme_id?: string | null;
  summary: string;
  reasons: string[];
  tradeoffs: string[];
  condition?: string | null;
  fallback_trigger?: string | null;
  next_actions: ActionDraft[];
  generated_at?: string | null;
}

export interface DecisionOption {
  action: string;
  label: string;
  description?: string;
}

export interface MissionDecision {
  id: number;
  gate_type: "goal" | "team" | "plan";
  prompt: string;
  options: DecisionOption[];
  ai_recommendation: string;
  selected_action?: string | null;
  note: string;
  status: "pending" | "confirmed";
  decided_at?: string | null;
  created_at?: string | null;
}

export type ActionTaskStatus = "ready" | "waiting_prerequisite" | "completed" | "cancelled";

export interface ActionTask {
  id: number;
  action_code: string;
  agent_id: string;
  title: string;
  payload: Record<string, unknown>;
  status: ActionTaskStatus;
  scheme_id?: string | null;
  prerequisite_action_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

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
  created_at?: string | null;
  updated_at?: string | null;
  agent_runs: AgentRun[];
  decisions: MissionDecision[];
  conflicts: MissionConflict[];
  recommendation: MissionRecommendation | null;
  action_tasks: ActionTask[];
}

export interface MissionSummary {
  id: number;
  mission_code: string;
  title: string;
  raw_request: string;
  phase: string;
  status: MissionStatus;
  primary_scheme_id?: string | null;
  pending_decision_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MissionEvent {
  type:
    | "mission_started"
    | "snapshot"
    | "agent_started"
    | "agent_completed"
    | "agent_failed"
    | "conflict_found"
    | "recommendation_ready"
    | "decision_required"
    | "mission_failed"
    | "error";
  mission_id: number;
  agent_id: string | null;
  payload: Record<string, unknown>;
}

export const STATUS_LABELS: Record<MissionStatus, string> = {
  awaiting_goal_confirmation: "目标待确认",
  awaiting_team_confirmation: "团队待确认",
  running: "办理中",
  awaiting_decision: "决策待确认",
  partially_completed: "部分完成",
  completed: "已完成",
  failed: "无法形成方案",
};

export const PHASE_LABELS: Record<string, string> = {
  goal_confirmation: "目标确认",
  team_confirmation: "智能组队",
  parallel_execution: "并行办理",
  decision: "方案确认",
  execution: "执行分派",
};
