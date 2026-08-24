// web/src/features/liang/api.ts
import type {
  Listing,
  ListingFilters,
  MarketSummaryResponse,
  ComparisonInterpretation,
  SourcingTask,
  SourcingRunResult,
  TaskNeedSummary,
  TaskPlan,
} from "./types";

const BASKET_VISITOR_KEY = "liang-candidate-basket-visitor";

function candidateBasketHeaders(): HeadersInit {
  let visitorId = window.localStorage.getItem(BASKET_VISITOR_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    window.localStorage.setItem(BASKET_VISITOR_KEY, visitorId);
  }
  return { "X-Visitor-Id": visitorId };
}

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

export async function interpretCandidateComparison(
  listingIds: number[],
): Promise<ComparisonInterpretation> {
  const resp = await fetch("/api/liang/compare/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_ids: listingIds }),
  });
  if (!resp.ok) throw new Error(`对比解读失败（${resp.status}）`);
  return resp.json();
}

export async function runSourcingWorkflow(text: string): Promise<SourcingRunResult> {
  const resp = await fetch("/api/liang/sourcing-runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) throw new Error(`寻源执行失败（${resp.status}）`);
  return resp.json();
}

export interface SourcingTraceEvent {
  node: string;
  status: "done" | "skipped";
  detail: string;
}

/** 流式执行寻源：每完成一个节点回调 onTrace，全部完成后返回最终结果。 */
export async function runSourcingWorkflowStream(
  text: string,
  onTrace: (event: SourcingTraceEvent) => void,
): Promise<SourcingRunResult> {
  const resp = await fetch("/api/liang/sourcing-runs/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok || !resp.body) throw new Error(`寻源执行失败（${resp.status}）`);
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: SourcingRunResult | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      const payload = JSON.parse(line.slice(5).trim());
      if (payload.type === "trace") onTrace(payload.event as SourcingTraceEvent);
      else if (payload.type === "done") result = payload.result as SourcingRunResult;
    }
  }
  if (!result) throw new Error("寻源执行失败");
  return result;
}

export async function fetchCandidateBasket(): Promise<Listing[]> {
  const resp = await fetch("/api/liang/candidate-basket", { headers: candidateBasketHeaders() });
  if (!resp.ok) throw new Error(`候选篮加载失败（${resp.status}）`);
  const data = await resp.json();
  return data.items as Listing[];
}

export async function addCandidateBasketItem(listingId: number): Promise<Listing[]> {
  const resp = await fetch("/api/liang/candidate-basket", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...candidateBasketHeaders() },
    body: JSON.stringify({ listing_id: listingId }),
  });
  if (!resp.ok) throw new Error(`候选篮保存失败（${resp.status}）`);
  const data = await resp.json();
  return data.items as Listing[];
}

export async function removeCandidateBasketItem(listingId: number): Promise<Listing[]> {
  const resp = await fetch(`/api/liang/candidate-basket/${listingId}`, {
    method: "DELETE",
    headers: candidateBasketHeaders(),
  });
  if (!resp.ok) throw new Error(`候选篮更新失败（${resp.status}）`);
  const data = await resp.json();
  return data.items as Listing[];
}

export async function clearCandidateBasket(): Promise<void> {
  const resp = await fetch("/api/liang/candidate-basket", {
    method: "DELETE",
    headers: candidateBasketHeaders(),
  });
  if (!resp.ok) throw new Error(`候选篮清空失败（${resp.status}）`);
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

export async function deleteTask(id: number): Promise<void> {
  const resp = await fetch(`/api/liang/tasks/${id}`, { method: "DELETE" });
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
}
