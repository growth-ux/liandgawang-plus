// web/src/features/liang/types.ts
export interface Listing {
  id: number;
  listing_code: string;
  variety_code: string;
  variety_name: string;
  crop_year: number;
  origin_province: string;
  origin_city: string;
  grade: string;
  price: string;
  price_type: string;
  available_quantity_tons: number;
  delivery_type: string;
  earliest_ship_at: string | null;
  latest_ship_at: string | null;
  moisture_pct: string | null;
  test_weight_g_l: string | null;
  impurity_pct: string | null;
  supplier_name: string;
  supplier_region: string;
}

export interface PriceRange {
  low: string;
  high: string;
}

export interface MarketSummary {
  total_listings: number;
  total_quantity_tons: number;
  varieties: string[];
  price_range: PriceRange;
  province_count: number;
}

export interface Discovery {
  id: string;
  title: string;
  detail: string;
  filter: { key: string; value: string } | null;
}

export interface MarketSummaryResponse {
  summary: MarketSummary;
  discoveries: Discovery[];
}

export interface ListingFilters {
  variety_name?: string;
  origin_province?: string;
  grade?: string;
  crop_year?: number;
  price_type?: string;
  delivery_type?: string;
  min_price?: number;
  max_price?: number;
  min_quantity?: number;
}

export interface NeedInput {
  variety?: string;
  quantity_tons?: number;
  grade?: string;
  crop_year?: number;
  deadline_days?: number;
  budget_price?: number;
}

export interface Elimination {
  listing: Listing;
  reason_code: string;
  reason_text: string;
}

export interface Pick {
  listing: Listing;
  reasons: string[];
  risks: string[];
  verification_count: number;
}

export interface NeedSummary {
  variety?: string;
  quantity_tons?: number;
  grade?: string;
  crop_year?: number;
  deadline?: string;
  budget_price?: number;
}

export interface CompareResult {
  has_need: boolean;
  scope: Listing[];
  primary: Pick | null;
  backup: Pick | null;
  eliminated: Elimination[];
  verifications: string[];
  need_summary: NeedSummary | null;
}

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

export interface ComparisonItemReview {
  listing_id: number;
  advantages: string[];
  risks: string[];
}

export interface ComparisonInterpretation {
  summary: string;
  recommendation: string;
  key_differences: string[];
  item_reviews: ComparisonItemReview[];
  source: "llm" | "rule";
}
