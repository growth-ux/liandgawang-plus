import type { MarketOverview, PriceSeriesResponse } from "./types";

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
