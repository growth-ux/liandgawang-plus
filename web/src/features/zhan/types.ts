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
