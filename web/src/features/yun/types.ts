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

export interface LogisticsLine {
  origin: string;
  destination: string;
  mode: string;
  mode_name: string;
  carrier: string;
  tonnage_min: number;
  tonnage_max: number;
  price_low: number;
  price_high: number;
  days_low: number;
  days_high: number;
  dispatch_window: string;
  performance_note: string;
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
