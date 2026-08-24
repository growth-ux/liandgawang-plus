import type {
  KnowledgeCitation,
  KnowledgeCreate,
  KnowledgeItem,
  KnowledgeListParams,
  KnowledgeOverviewData,
  KnowledgeUpdate,
} from "./types";

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

function clean(params: KnowledgeListParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([key, value]) => [key, String(value)]),
  );
}

export const fetchKnowledgeOverview = () =>
  http<KnowledgeOverviewData>("/api/knowledge/overview");

export const fetchKnowledgeItems = (params: KnowledgeListParams = {}) =>
  http<{ items: KnowledgeItem[] }>(
    `/api/knowledge/items?${new URLSearchParams(clean(params)).toString()}`,
  );

export const createKnowledgeItem = (body: KnowledgeCreate) =>
  http<KnowledgeItem>("/api/knowledge/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const updateKnowledgeItem = (id: number, body: KnowledgeUpdate) =>
  http<KnowledgeItem>(`/api/knowledge/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const fetchKnowledgeCitations = (id: number) =>
  http<{ items: KnowledgeCitation[] }>(`/api/knowledge/items/${id}/citations`);

