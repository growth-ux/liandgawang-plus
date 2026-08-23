// web/src/features/liang/api.ts
import type {
  Listing,
  ListingFilters,
  MarketSummaryResponse,
  SourcingTask,
  TaskNeedSummary,
  TaskPlan,
} from "./types";

export async function fetchListings(
  filters: ListingFilters = {},
): Promise<Listing[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  const resp = await fetch(`/api/liang/listings${qs ? `?${qs}` : ""}`);
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  const data = await resp.json();
  return data.items as Listing[];
}

export async function fetchListing(id: number): Promise<Listing> {
  const resp = await fetch(`/api/liang/listings/${id}`);
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function fetchMarketSummary(): Promise<MarketSummaryResponse> {
  const resp = await fetch("/api/liang/market/summary");
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function fetchTasks(): Promise<SourcingTask[]> {
  const resp = await fetch("/api/liang/tasks");
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  const data = await resp.json();
  return data.items as SourcingTask[];
}

export async function fetchTask(id: number): Promise<SourcingTask> {
  const resp = await fetch(`/api/liang/tasks/${id}`);
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function createTask(payload: {
  need: TaskNeedSummary;
  plan: TaskPlan;
}): Promise<SourcingTask> {
  const resp = await fetch("/api/liang/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

export async function handoffTask(
  id: number,
  destination: string,
): Promise<SourcingTask> {
  const resp = await fetch(`/api/liang/tasks/${id}/handoff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination }),
  });
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}
