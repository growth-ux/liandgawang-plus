export interface RouteLeg {
  origin: string;
  destination: string;
  mode: string;
  mode_name: string;
  distance_km: number;
}

export interface LogisticsMeta {
  nodes: string[];
  varieties: { code: string; name: string }[];
  data_updated_at: string;
}

export interface LogisticsLine {
  origin: string;
  destination: string;
  mode: string;
  mode_name: string;
  distance_km: number;
  carrier: string;
  tonnage_min: number;
  tonnage_max: number;
  price_low: number;
  price_high: number;
  days_low: number;
  days_high: number;
  dispatch_window: string;
  loading_note: string;
  performance_note: string;
  risk_note: string;
}

export interface RequirementFields {
  origin: string;
  destination: string;
  variety_code: string;
  quantity_tons: number;
  deadline_date?: string | null;
}

export interface TaskRequest extends RequirementFields {
  allow_split?: boolean;
  source_type?: string;
  source_ref?: string;
  extra_note?: string;
  decision_preference?: DecisionPreference;
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
  decision_preference: DecisionPreference;
}

export interface TransportPlan {
  id: number;
  plan_type: "primary" | "backup" | "rejected";
  title: string;
  legs: RouteLeg[];
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

export interface InquiryListItem extends Inquiry {
  task: TransportTask | null;
}

export interface TaskDetail {
  task: TransportTask;
  plans: TransportPlan[];
  inquiry: Inquiry | null;
}

export interface ExtractResponse {
  llm_available: boolean;
  fields?: Partial<RequirementFields>;
  assumptions?: string[];
  question?: string | null;
  decision_preference?: DecisionPreference | null;
}

export type DecisionPreference = "on_time" | "cost" | "balanced";

export interface TransportPlanPrefill {
  origin?: string;
  destination?: string;
  variety_code?: string;
  quantity_tons?: number;
  deadline_date?: string | null;
}
