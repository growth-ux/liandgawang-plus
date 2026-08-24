export type FieldSource = "user" | "liang" | "yun" | "qian";
export type FieldStatus = "confirmed" | "pending" | "estimated";

export interface FieldMeta {
  source: FieldSource;
  status: FieldStatus;
  note: string;
}

export interface SchemeDraft {
  scheme_id: string;
  name: string;
  variety_name: string | null;
  quantity_tons: string | null;
  purchase_price_yuan_per_ton: string | null;
  tax_included: boolean | null;
  quality_discount_yuan_per_ton: string | null;
  freight_yuan_per_ton: string | null;
  loading_yuan_per_ton: string | null;
  loss_rate_pct: string | null;
  financing_cost_yuan: string | null;
  other_cost_yuan: string | null;
  constraints_met: boolean;
  pending_items: string[];
  field_meta: Record<string, FieldMeta>;
}

export interface SchemeInput extends SchemeDraft {
  variety_name: string;
  quantity_tons: string;
  purchase_price_yuan_per_ton: string;
  tax_included: boolean;
  quality_discount_yuan_per_ton: string;
  freight_yuan_per_ton: string;
  loading_yuan_per_ton: string;
  loss_rate_pct: string;
  financing_cost_yuan: string;
  other_cost_yuan: string;
}

export interface CostBreakdown {
  purchase_yuan_per_ton: string;
  quality_yuan_per_ton: string;
  freight_yuan_per_ton: string;
  loading_yuan_per_ton: string;
  loss_impact_yuan_per_ton: string;
  financing_yuan_per_ton: string;
  other_yuan_per_ton: string;
}

export interface SchemeResult {
  scheme_id: string;
  name: string;
  eligible: boolean;
  total_cost_yuan: string;
  usable_quantity_tons: string;
  delivered_cost_yuan_per_ton: string;
  purchase_total_yuan: string;
  breakdown: CostBreakdown;
  pending_items: string[];
}

export interface CostDifference {
  scheme_id: string;
  against_scheme_id: string;
  delivered_cost_delta_yuan_per_ton: string;
  total_cost_delta_yuan: string;
}

export interface CostComparison {
  recommended_scheme_id: string | null;
  results: SchemeResult[];
  differences: CostDifference[];
  contains_estimates: boolean;
  explanation: string;
}

export interface ProfitRequest {
  selling_price_yuan_per_ton: string;
  sales_fulfillment_cost_yuan: string;
  freight_yuan_per_ton?: string | null;
  loss_rate_pct?: string | null;
}

export interface ProfitScenario {
  selling_price_yuan_per_ton: string;
  total_profit_yuan: string;
  profit_yuan_per_ton: string;
  margin_pct: string;
  break_even_price_yuan_per_ton: string;
  safety_space_yuan_per_ton: string;
}

export interface ProfitQuestionRequest {
  baseline_selling_price_yuan_per_ton: string;
  sales_fulfillment_cost_yuan: string;
  question: string;
}

export interface ProfitQuestionResponse {
  changes: Record<string, string>;
  result: ProfitScenario;
}

export interface AskRequest {
  tab: "costing" | "profit" | "records";
  question: string;
  record_id?: number | null;
}

export interface CostingRecord {
  id: number;
  record_code: string;
  title: string;
  status: "pending" | "calculated" | "completed";
  source_text: string;
  schemes: SchemeDraft[];
  calculation: CostComparison | null;
  selected_scheme_id: string | null;
  profit: ProfitScenario | null;
  ai_explanation: string;
  created_at: string;
  updated_at: string;
}

export interface ExtractResponse {
  llm_available: boolean;
  schemes: SchemeDraft[];
  questions: string[];
}

export interface SaveRecordRequest {
  title: string;
  source_text?: string;
  schemes: SchemeDraft[];
  calculation?: CostComparison | null;
  selected_scheme_id?: string | null;
}

export interface SuanHandoff {
  source_agent: "liang" | "yun" | "qian";
  target_agent: "suan";
  source_ref?: string;
  schemes: Partial<SchemeDraft>[];
  pending_items: string[];
}

export interface SharedExperience {
  id: number;
  source_type: "costing" | "zhanggui";
  source_record_id: number;
  content: string;
  tags: string[];
  status: "active" | "ignored";
  created_at: string;
  updated_at: string;
}
