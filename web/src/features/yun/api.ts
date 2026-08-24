import type {
  DecisionPreference,
  ExtractResponse,
  Inquiry,
  InquiryListItem,
  LogisticsLine,
  LogisticsMeta,
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

export const fetchLogisticsLines = () => http<LogisticsLine[]>("/api/logistics/lines");
export const fetchLogisticsMeta = () => http<LogisticsMeta>("/api/logistics/meta");
export const extractRequirements = (text: string) =>
  post<ExtractResponse>("/api/logistics/extract", { text });
export const createTask = (body: TaskRequest) =>
  post<TransportTask>("/api/logistics/tasks", body);
export const matchTask = (
  taskId: number,
  options?: { decision_preference?: DecisionPreference; use_memory?: boolean },
) =>
  post<{ matched: number; primary: boolean }>(
    `/api/logistics/tasks/${taskId}/match`,
    options,
  );
export const listTasks = () => http<TransportTask[]>("/api/logistics/tasks");
export const fetchTaskDetail = (taskId: number) =>
  http<TaskDetail>(`/api/logistics/tasks/${taskId}`);
export const createInquiry = (taskId: number, planId: number) =>
  post<Inquiry>(`/api/logistics/tasks/${taskId}/inquiry`, { plan_id: planId });
export const submitInquiry = (inquiryId: number) =>
  post<Inquiry>(`/api/logistics/inquiries/${inquiryId}/submit`);
export const listInquiries = () => http<InquiryListItem[]>("/api/logistics/inquiries");
export const explainPlans = (taskId: number, question: string) =>
  post<{ answer: string }>("/api/logistics/explain", { task_id: taskId, question });
