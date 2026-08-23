import type { MarketOverview, PriceSeriesResponse, Watch } from "./types";

export async function fetchMarketOverview(
  varietyCode: string,
): Promise<MarketOverview> {
  const resp = await fetch(`/api/market/overview?variety_code=${varietyCode}`);
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

export async function fetchWatches(): Promise<Watch[]> {
  const resp = await fetch("/api/watches");
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function createWatch(input: {
  variety_code: string;
  spot_code: string;
  watch_type: string;
  threshold: number;
}): Promise<Watch> {
  const resp = await fetch("/api/watches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function updateWatch(
  id: number,
  input: { status?: string; threshold?: number },
): Promise<Watch> {
  const resp = await fetch(`/api/watches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function evaluateWatch(id: number): Promise<Watch> {
  const resp = await fetch(`/api/watches/${id}/evaluate`, { method: "POST" });
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}
