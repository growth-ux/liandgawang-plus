import type {
  AnalysisJudgment,
  AnalysisRecord,
  AnalysisRequest,
  MarketOverview,
  PriceSeriesResponse,
} from "./types";

export async function fetchMarketOverview(
  varietyCode: string,
): Promise<MarketOverview> {
  const resp = await fetch(`/api/market/overview?variety_code=${varietyCode}`);
  if (!resp.ok) {
    throw new Error(`请求失败（${resp.status}）`);
  }
  return resp.json();
}

export async function previewAnalysis(
  req: AnalysisRequest,
): Promise<AnalysisJudgment> {
  const resp = await fetch("/api/analysis/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    throw new Error(`请求失败（${resp.status}）`);
  }
  return resp.json();
}

export async function saveAnalysis(
  req: AnalysisRequest,
): Promise<{ record_id: number }> {
  const resp = await fetch("/api/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    throw new Error(`请求失败（${resp.status}）`);
  }
  return resp.json();
}

export async function fetchAnalysisList(): Promise<AnalysisRecord[]> {
  const resp = await fetch("/api/analysis");
  if (!resp.ok) {
    throw new Error(`请求失败（${resp.status}）`);
  }
  return resp.json();
}

export async function fetchPriceSeries(
  varietyCode: string,
  spotCode: string,
): Promise<PriceSeriesResponse> {
  const resp = await fetch(
    `/api/market/price-series?variety_code=${varietyCode}&spot_code=${encodeURIComponent(spotCode)}`,
  );
  if (!resp.ok) {
    throw new Error(`请求失败（${resp.status}）`);
  }
  return resp.json();
}
