import type { MarketOverview } from "./types";

export async function fetchMarketOverview(
  varietyCode: string,
): Promise<MarketOverview> {
  const resp = await fetch(`/api/market/overview?variety_code=${varietyCode}`);
  if (!resp.ok) {
    throw new Error(`请求失败（${resp.status}）`);
  }
  return resp.json();
}
