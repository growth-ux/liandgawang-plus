import type {
  AskRequest,
  CostComparison,
  CostingRecord,
  ExtractResponse,
  ProfitQuestionRequest,
  ProfitQuestionResponse,
  ProfitRequest,
  ProfitScenario,
  SaveRecordRequest,
  SchemeInput,
  SharedExperience,
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

export const extractSchemes = (text: string) =>
  post<ExtractResponse>("/api/costing/extract", { text });

export const calculateCosts = (schemes: SchemeInput[]) =>
  post<CostComparison>("/api/costing/calculate", { schemes });

export const saveCostingRecord = (body: SaveRecordRequest) =>
  post<CostingRecord>("/api/costing/records", body);

export const fetchCostingRecords = () =>
  http<{ items: CostingRecord[] }>("/api/costing/records");

export const fetchCostingRecord = (id: number) =>
  http<CostingRecord>(`/api/costing/records/${id}`);

export const previewProfit = (id: number, body: ProfitRequest) =>
  post<ProfitScenario>(`/api/costing/records/${id}/profit-preview`, body);

export const saveProfit = (id: number, body: ProfitRequest) =>
  post<CostingRecord>(`/api/costing/records/${id}/profit`, body);

export const previewProfitQuestion = (id: number, body: ProfitQuestionRequest) =>
  post<ProfitQuestionResponse>(`/api/costing/records/${id}/profit-question`, body);

export const cloneCostingRecord = (id: number) =>
  post<CostingRecord>(`/api/costing/records/${id}/clone`);

export const askSuan = (body: AskRequest) =>
  post<{ answer: string }>("/api/costing/ask", body);

// ─── 企业经验 API ───────────────────────────────────────────────────────────

export const fetchExperiences = (includeIgnored = false) =>
  http<{ items: SharedExperience[] }>(
    `/api/knowledge/experiences${includeIgnored ? "?include_ignored=true" : ""}`
  );

export const updateExperience = (id: number, content: string) =>
  http<SharedExperience>(`/api/knowledge/experiences/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

export const ignoreExperience = (id: number) =>
  post<SharedExperience>(`/api/knowledge/experiences/${id}/ignore`);
