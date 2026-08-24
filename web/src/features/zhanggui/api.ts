import type {
  GoalPreview,
  MemoryReference,
  MissionEvent,
  MissionGoal,
  MissionSnapshot,
  MissionSummary,
  TeamMember,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  const detail = typeof body?.detail === "string" ? body.detail : `请求失败（${response.status}）`;
  return new ApiError(response.status, detail);
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw await toApiError(response);
  return response.json();
}

function post<T>(url: string, body?: unknown): Promise<T> {
  return http<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const previewGoal = (text: string) =>
  post<GoalPreview>("/api/zhanggui/missions/preview", { text });

export const createMission = (rawRequest: string, goal: MissionGoal, memoryReferences: MemoryReference[]) =>
  post<MissionSnapshot>("/api/zhanggui/missions", {
    raw_request: rawRequest,
    goal,
    memory_references: memoryReferences,
  });

export const fetchMissions = () => http<MissionSummary[]>("/api/zhanggui/missions");

export const fetchMission = (missionId: number) =>
  http<MissionSnapshot>(`/api/zhanggui/missions/${missionId}`);

export const confirmGoal = (missionId: number, goal: MissionGoal) =>
  post<MissionSnapshot>(`/api/zhanggui/missions/${missionId}/confirm-goal`, { goal });

export const confirmTeam = (missionId: number, team: TeamMember[]) =>
  post<MissionSnapshot>(`/api/zhanggui/missions/${missionId}/confirm-team`, { team });

export const runMission = (missionId: number) =>
  post<MissionSnapshot>(`/api/zhanggui/missions/${missionId}/run`);

export const submitDecision = (missionId: number, decisionId: number, action: string, note = "") =>
  post<MissionSnapshot>(`/api/zhanggui/missions/${missionId}/decisions/${decisionId}`, { action, note });

export const terminateMission = (missionId: number, reason = "") =>
  post<MissionSnapshot>(`/api/zhanggui/missions/${missionId}/terminate`, { reason });

export const cancelActionTask = (missionId: number, actionTaskId: number) =>
  post<MissionSnapshot>(`/api/zhanggui/missions/${missionId}/action-tasks/${actionTaskId}/cancel`);

/** 消费 NDJSON 进度流；组件卸载时通过 signal 中断。 */
export async function streamMissionEvents(
  missionId: number,
  onEvent: (event: MissionEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`/api/zhanggui/missions/${missionId}/events`, { signal });
  if (!response.ok || !response.body) throw await toApiError(response);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.filter(Boolean).forEach((line) => {
      try {
        onEvent(JSON.parse(line) as MissionEvent);
      } catch {
        // 忽略损坏的行，保持流继续
      }
    });
    if (done) break;
  }
}
