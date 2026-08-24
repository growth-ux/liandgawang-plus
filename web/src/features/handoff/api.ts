export type HandoffStatus = "pending" | "accepted" | "ignored";

export interface AgentHandoff {
  id: number;
  handoff_code: string;
  source_agent: string;
  target_agent: string;
  source_ref: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  status: HandoffStatus;
}

export interface CreateHandoffInput {
  source_agent: string;
  target_agent: string;
  source_ref: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "交接操作失败");
  }
  return response.json() as Promise<T>;
}

export const createHandoff = (body: CreateHandoffInput) => request<AgentHandoff>("/api/handoffs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const fetchHandoff = (id: number) => request<AgentHandoff>(`/api/handoffs/${id}`);
export const acceptHandoff = (id: number) => request<AgentHandoff>(`/api/handoffs/${id}/accept`, { method: "POST" });
export const ignoreHandoff = (id: number) => request<AgentHandoff>(`/api/handoffs/${id}/ignore`, { method: "POST" });
