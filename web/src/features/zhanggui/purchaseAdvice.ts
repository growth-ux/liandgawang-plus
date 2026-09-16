export interface MarketContext {
  spot_code: string;
  period_days: 7 | 30 | 90;
  data_date: string;
}

export type MarketSelection = MarketContext | "loading" | "unavailable";

export interface PurchaseAdvice {
  title: string;
  reasoning: string;
  caution: string;
  source: "qwen" | "rule";
  model: string | null;
  elapsed_ms: number;
  context?: MarketContext;
}
