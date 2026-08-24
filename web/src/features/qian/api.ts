import type {
  FinanceMeta,
  FinanceProduct,
  FinanceProductFilters,
  FinanceRequirement,
  FinanceHandoff,
  MatchPreview,
  MatchRecord,
  ExtractionResponse,
} from "./types";

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `请求失败（${response.status}）`);
  }
  return response.json();
}

function post<T>(url: string, body?: unknown): Promise<T> {
  return http<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function query(filters: FinanceProductFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, value);
  });
  const v = params.toString();
  return v ? `?${v}` : "";
}

export const fetchFinanceMeta = () => http<FinanceMeta>("/api/finance/meta");

export const fetchFinanceProducts = (filters: FinanceProductFilters = {}) =>
  http<{ items: FinanceProduct[] }>(`/api/finance/products${query(filters)}`);

export const fetchFinanceProduct = (id: number) =>
  http<FinanceProduct>(`/api/finance/products/${id}`);

export const extractFinanceRequirement = (text: string) =>
  post<ExtractionResponse>("/api/finance/requirements/extract", { text });

export const previewFinanceMatch = (requirement: FinanceRequirement) =>
  post<MatchPreview>("/api/finance/matches/preview", { requirement });

export const saveFinanceMatch = (requirement: FinanceRequirement) =>
  post<MatchRecord>("/api/finance/matches", { requirement });

export const fetchFinanceMatches = () =>
  http<{ items: MatchRecord[] }>("/api/finance/matches");

export const fetchFinanceMatch = (id: number) =>
  http<MatchRecord>(`/api/finance/matches/${id}`);

export const handoffFinanceMatchToSuan = (id: number) =>
  post<FinanceHandoff>(`/api/finance/matches/${id}/handoff/suan`);
