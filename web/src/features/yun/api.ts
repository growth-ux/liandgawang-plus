import type {
  EstimateRequest,
  EstimateResponse,
  ExtractResponse,
  HotRoute,
  Inquiry,
  LogisticsLine,
  LogisticsMeta,
  QuickEstimateRecord,
  TaskDetail,
  TaskRequest,
  TransportTask,
} from "./types";

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, init);
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）`);
  return resp.json();
}

function post<T>(url: string, body?: unknown): Promise<T> {
  return http<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const fetchLogisticsMeta = () => http<LogisticsMeta>("/api/logistics/meta");
export const fetchHotRoutes = () => http<HotRoute[]>("/api/logistics/hot-routes");
export const fetchLogisticsLines = () => http<LogisticsLine[]>("/api/logistics/lines");
export const createEstimate = (body: EstimateRequest) =>
  post<EstimateResponse>("/api/logistics/estimates", body);
export const listEstimates = () => http<QuickEstimateRecord[]>("/api/logistics/estimates");
export const createTask = (body: TaskRequest) =>
  post<TransportTask>("/api/logistics/tasks", body);
export const matchTask = (taskId: number) =>
  post<{ matched: number; primary: boolean }>(`/api/logistics/tasks/${taskId}/match`);
export const listTasks = () => http<TransportTask[]>("/api/logistics/tasks");
export const fetchTaskDetail = (taskId: number) =>
  http<TaskDetail>(`/api/logistics/tasks/${taskId}`);
export const createInquiry = (taskId: number, planId: number) =>
  post<Inquiry>(`/api/logistics/tasks/${taskId}/inquiry`, { plan_id: planId });
export const submitInquiry = (inquiryId: number) =>
  post<Inquiry>(`/api/logistics/inquiries/${inquiryId}/submit`);
export const extractRequirements = (text: string) =>
  post<ExtractResponse>("/api/logistics/extract", { text });
export const explainPlans = (taskId: number, question: string) =>
  post<{ answer: string }>("/api/logistics/explain", { task_id: taskId, question });
