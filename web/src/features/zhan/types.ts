export type RegionType = "产区" | "销区" | "港口";

export interface SpotPrice {
  spot_code: string;
  region_name: string;
  region_type: RegionType;
  quote_type: string;
  remark: string;
  lng: number;
  lat: number;
  price: string;
  change_pct: string;
  last_year_price: string;
  interpretation: string;
}

export interface MarketEvent {
  event_code: string;
  title: string;
  summary: string;
  event_at: string;
  impact_regions: string[];
  direction: "bullish" | "bearish" | "neutral";
  strength: "strong" | "moderate" | "mild";
  duration_hint: string;
}

export interface EvidenceItem {
  text: string;
  type: "price" | "event";
}

export interface MarketJudgment {
  summary: string;
  direction: "bullish" | "bearish" | "neutral";
  supporting: EvidenceItem[];
  opposing: EvidenceItem[];
  evidence_completeness: "high" | "medium" | "low";
  watch_suggestions: string[];
}

export interface MarketOverview {
  variety_code: string;
  variety_name: string;
  price_date: string;
  spots: SpotPrice[];
  events: MarketEvent[];
  judgment: MarketJudgment;
}

export const VARIETIES = [
  { code: "corn", name: "玉米" },
  { code: "wheat", name: "小麦" },
  { code: "soybean", name: "大豆" },
  { code: "rice", name: "稻谷" },
] as const;

export interface PricePoint {
  observed_date: string;
  price: string;
}

export interface SelectedSpot {
  spot_code: string;
  region_name: string;
  region_type: RegionType;
  quote_type: string;
  remark: string;
  unit: string;
}

export interface PriceSummary {
  latest_price: string;
  day_change_pct: string;
  week_change_pct: string;
  month_change_pct: string;
  range_high: string;
  range_low: string;
  direction: string;
}

export interface PriceSeriesResponse {
  data_kind: "simulated";
  mock_dataset_version: string;
  mock_generated_at: string;
  variety_code: string;
  variety_name: string;
  spot: SelectedSpot;
  points: PricePoint[];
  summary: PriceSummary;
}

export interface AnalysisRequest {
  variety_code: string;
  quantity_tons: string;
  deadline_date: string;
  target_region: string;
  grade?: string | null;
  budget_price?: string | null;
  stock_days?: number | null;
  risk_preference?: string | null;
  remark?: string | null;
}

export type AnalysisAction = "buy_now" | "split" | "wait" | "verify";

export interface AnalysisJudgment {
  data_kind: "simulated";
  mock_dataset_version: string;
  mock_generated_at: string;
  action: AnalysisAction;
  action_label: string;
  ratio_low: number | null;
  ratio_high: number | null;
  time_window: string | null;
  summary: string;
  interpretation: string | null;
  ai_source: "qwen" | "rule";
  supporting: string[];
  opposing: string[];
  invalidation: string[];
  watch_metrics: string[];
  missing_data: string[];
  evidence_completeness: "high" | "medium" | "low";
}

export interface AnalysisRecord {
  id: number;
  created_at: string | null;
  variety_code: string;
  variety_name: string;
  quantity_tons: string;
  deadline_date: string;
  grade: string | null;
  target_region: string | null;
  budget_price: string | null;
  stock_days: number | null;
  risk_preference: string | null;
  remark: string | null;
  action: AnalysisAction;
  ratio_low: number | null;
  ratio_high: number | null;
  time_window: string | null;
  summary: string;
  interpretation: string | null;
  ai_source: "qwen" | "rule";
  supporting: string[];
  opposing: string[];
  invalidation: string[];
  watch_metrics: string[];
  evidence_completeness: "high" | "medium" | "low";
  dataset_version: string;
}

export type WatchType = "price_above" | "price_below" | "day_change" | "week_change";
export type WatchStatus = "monitoring" | "triggered" | "notified" | "paused" | "closed" | "data_pending";

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
