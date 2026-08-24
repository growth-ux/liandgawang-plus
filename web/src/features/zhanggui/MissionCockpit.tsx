import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMission, streamMissionEvents } from "./api";
import ActionTaskList from "./ActionTaskList";
import AgentResultDrawer from "./AgentResultDrawer";
import DecisionGate from "./DecisionGate";
import DecisionTrace from "./DecisionTrace";
import MissionRail from "./MissionRail";
import PlanComparison from "./PlanComparison";
import SpatialAgentStage from "./SpatialAgentStage";
import { getAgent } from "../../data/agents";
import type { AgentRun, MissionEvent, MissionSnapshot } from "./types";
import { PHASE_LABELS, STATUS_LABELS } from "./types";

export interface MissionCockpitProps {
  mission: MissionSnapshot;
  onMissionChange(next: MissionSnapshot): void;
  onBack(): void;
}

interface ActivityItem {
  time: string;
  text: string;
  tone: "info" | "ok" | "warn";
}

const ACTIVITY_LIMIT = 30;

function nowText() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function agentName(agentId: string | null) {
  return agentId ? (getAgent(agentId)?.name ?? agentId) : "粮掌柜";
}

/** 把进度流事件翻译成人话，供实时动态面板展示。 */
function describeEvent(event: MissionEvent): ActivityItem | null {
  const name = agentName(event.agent_id);
  switch (event.type) {
    case "mission_started":
      return { time: nowText(), text: "粮掌柜开始组织并行办理", tone: "info" };
    case "agent_started":
      return {
        time: nowText(),
        text: event.payload?.supplement ? `${name} 响应一次定向补充` : `${name} 开始办理`,
        tone: "info",
      };
    case "agent_completed": {
      const summary = typeof event.payload?.summary === "string" ? event.payload.summary : "";
      const objection = event.payload?.status === "completed_with_objection";
      return {
        time: nowText(),
        text: `${name} ${objection ? "完成办理，提出异议" : "完成办理"}${summary ? `：${summary.slice(0, 42)}${summary.length > 42 ? "…" : ""}` : ""}`,
        tone: objection ? "warn" : "ok",
      };
    }
    case "agent_failed":
      return { time: nowText(), text: `${name} 办理失败，结果缺失`, tone: "warn" };
    case "conflict_found": {
      const title = typeof event.payload?.title === "string" ? event.payload.title : "跨专业冲突";
      return { time: nowText(), text: `发现冲突：${title}`, tone: "warn" };
    }
    case "recommendation_ready":
      return {
        time: nowText(),
        text: `综合建议已生成：主推方案 ${event.payload?.primary_scheme_id ?? "—"}`,
        tone: "ok",
      };
    case "decision_required":
      return { time: nowText(), text: "已到达决策闸门，等待你的确认", tone: "info" };
    case "mission_failed":
      return { time: nowText(), text: "无法形成可用方案，任务终止", tone: "warn" };
    case "mission_terminated":
      return { time: nowText(), text: "用户已终止办事，已保留当前记录", tone: "warn" };
    default:
      return null;
  }
}

/** 粮掌柜 2.5D 指挥舱：任务轨 + 协作沙盘 + 决策面板 + 实时动态。 */
export default function MissionCockpit({ mission, onMissionChange, onBack }: MissionCockpitProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [liveRuns, setLiveRuns] = useState<Record<string, AgentRun["status"]>>({});
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const streamingRef = useRef(false);

  const pushActivity = useCallback((item: ActivityItem | null) => {
    if (!item) return;
    setActivity((prev) => [...prev.slice(-(ACTIVITY_LIMIT - 1)), item]);
  }, []);

  // 团队确认后（或刷新时任务仍在办理中）消费 NDJSON 流；流结束仍在办理则自动重连追踪
  useEffect(() => {
    if (mission.status !== "running" || streamingRef.current) return;
    streamingRef.current = true;
    const controller = new AbortController();
    setStreamError(null);
    pushActivity({ time: nowText(), text: "已连接进度流，等待小二启动…", tone: "info" });

    streamMissionEvents(
      mission.id,
      (event: MissionEvent) => {
        pushActivity(describeEvent(event));
        if (!event.agent_id) return;
        if (event.type === "agent_started") {
          setLiveRuns((prev) => ({ ...prev, [event.agent_id as string]: "running" }));
        } else if (event.type === "agent_completed") {
          const objection = event.payload?.status === "completed_with_objection";
          setLiveRuns((prev) => ({
            ...prev,
            [event.agent_id as string]: objection ? "completed_with_objection" : "completed",
          }));
        } else if (event.type === "agent_failed") {
          setLiveRuns((prev) => ({ ...prev, [event.agent_id as string]: "failed" }));
        }
      },
      controller.signal,
    )
      .then(() => fetchMission(mission.id))
      .then((snapshot) => {
        if (snapshot.status === "running") {
          // 后端已有运行实例时只回放快照：稍后重连继续追踪，直到状态变化
          pushActivity({ time: nowText(), text: "小二仍在办理，继续追踪进度…", tone: "info" });
          setTimeout(() => setRetryTick((tick) => tick + 1), 2500);
          return;
        }
        setLiveRuns({});
        onMissionChange(snapshot);
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") {
          setStreamError(err instanceof Error ? err.message : "进度流连接失败");
        }
      })
      .finally(() => {
        streamingRef.current = false;
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission.id, mission.status, retryTick]);

  const handleSelectAgent = useCallback((id: string) => {
    setSelectedAgentId((prev) => (prev === id ? null : id));
  }, []);

  const selectedRun = mission.agent_runs.find((run) => run.agent_id === selectedAgentId) ?? null;
  const pendingCount = mission.decisions.filter((decision) => decision.status === "pending").length;
  const suanRun = mission.agent_runs.find((run) => run.agent_id === "suan");

  return (
    <div className="zg-cockpit mx-auto w-full max-w-[1440px] px-6 py-6">
      <header className="zg-mission-header">
        <div>
          <p className="text-xs tracking-[0.3em] text-tech">粮掌柜多 Agent 任务 · {mission.mission_code}</p>
          <h1 className="mt-1 text-xl font-semibold">{mission.title}</h1>
          <p className="mt-1 text-xs text-ink-soft">
            {PHASE_LABELS[mission.phase] ?? mission.phase} · {STATUS_LABELS[mission.status]}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-ink-soft">
          <span>{mission.team.filter((item) => item.selected).length} 位小二协作</span>
          <span className="text-line">|</span>
          <span className={pendingCount > 0 ? "font-medium text-brand-deep" : ""}>{pendingCount} 项待确认</span>
          <button
            type="button"
            onClick={onBack}
            className="ml-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs transition-colors hover:text-ink"
          >
            返回
          </button>
        </div>
      </header>

      {streamError && (
        <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-300">
          {streamError}
        </p>
      )}

      <div className="zg-cockpit-grid">
        <MissionRail phase={mission.phase} status={mission.status} mission={mission} />
        <div className="flex min-w-0 flex-col gap-3">
          <SpatialAgentStage
            mission={mission}
            liveRuns={liveRuns}
            selectedAgentId={selectedAgentId}
            onSelectAgent={handleSelectAgent}
          />
          <section className="zg-activity">
            <div className="flex items-center justify-between">
              <h3 className="text-xs tracking-[0.25em] text-tech">实时动态</h3>
              {mission.status === "running" && <span className="zg-activity-pulse text-[11px] text-tech">办理中</span>}
            </div>
            {activity.length === 0 ? (
              <p className="mt-2 text-xs text-ink-soft">暂无动态；团队确认后，办理进度会逐条出现在这里。</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {activity.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs leading-5">
                    <span className="shrink-0 text-ink-soft/60">{item.time}</span>
                    <span
                      className={
                        item.tone === "warn" ? "text-brand-deep" : item.tone === "ok" ? "text-emerald-300" : "text-ink-soft"
                      }
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <DecisionGate mission={mission} onResolved={onMissionChange} />
      </div>

      {(mission.recommendation || mission.action_tasks.length > 0 || mission.decisions.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {mission.recommendation && (
            <PlanComparison recommendation={mission.recommendation} suanFacts={suanRun?.output_snapshot?.facts ?? null} />
          )}
          <DecisionTrace mission={mission} />
          <ActionTaskList tasks={mission.action_tasks} missionId={mission.id} />
        </div>
      )}

      <AgentResultDrawer run={selectedRun} onClose={() => setSelectedAgentId(null)} />
    </div>
  );
}
