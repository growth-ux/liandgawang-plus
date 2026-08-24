export type FinanceCategory =
  | "purchase_working" | "order_finance" | "warehouse_finance" | "receivable_finance";
export type FinancePurpose = "grain_purchase" | "inventory_turnover" | "receivable_turnover";
export type SourceType = "manual" | "liang" | "suan";

export interface FinanceProduct {
  id: number;
  product_code: string;
  name: string;
  institution_name: string;
  category: FinanceCategory;
  scenario: string;
  min_amount_yuan: string;
  max_amount_yuan: string;
  min_days: number;
  max_days: number;
  annual_rate_pct: string | null;
  fee_note: string;
  purposes: FinancePurpose[];
  guarantee_modes: string[];
  required_credentials: string[];
  min_business_years: string | null;
  requirements: string[];
  data_updated_at: string;
}

export interface FinanceRequirement {
  purpose: FinancePurpose;
  amount_yuan: string;
  duration_days: number;
  business_years: string | null;
  guarantee_modes: string[] | null;
  credentials: string[] | null;
  source_type: SourceType;
  source_ref?: string | null;
}

export interface MatchCandidate {
  product: FinanceProduct;
  estimated_cost_yuan: string | null;
  matched_reasons: string[];
  pending_conditions: string[];
  rejection_reasons: string[];
}

export interface MatchPreview {
  requirement: FinanceRequirement;
  primary: MatchCandidate | null;
  backups: MatchCandidate[];
  rejected: MatchCandidate[];
  explanation: string;
}

export interface MatchRecord {
  id: number;
  match_code: string;
  source_type: SourceType;
  source_ref: string | null;
  requirement: FinanceRequirement;
  result: Omit<MatchPreview, "requirement">;
  created_at: string;
}

export interface FinanceMeta {
  product_count: number;
  categories: FinanceCategory[];
  category_names: Record<FinanceCategory, string>;
  annual_rate_min_pct: string | null;
  annual_rate_max_pct: string | null;
  data_updated_at: string;
}

export interface FinanceProductFilters {
  category?: FinanceCategory;
  purpose?: FinancePurpose;
  amount_yuan?: string;
  duration_days?: string;
  guarantee_mode?: string;
  max_annual_rate_pct?: string;
}

export interface ExtractionResponse {
  llm_available: boolean;
  fields: Partial<FinanceRequirement>;
  assumptions: string[];
  question: string | null;
}

export interface FinanceHandoff {
  source_agent: "qian";
  target_agent: "suan";
  source_match_id: number;
  product_code: string;
  product_name: string;
  amount_yuan: string;
  duration_days: number;
  annual_rate_pct: string | null;
  reference_cost_yuan: string | null;
  fee_note: string;
  pending_conditions: string[];
}
