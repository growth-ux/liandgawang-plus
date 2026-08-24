import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMission, streamMissionEvents } from "./api";
import ActionTaskList from "./ActionTaskList";
import AgentResultDrawer from "./AgentResultDrawer";
import DecisionGate from "./DecisionGate";
import DecisionTrace from "./DecisionTrace";
import MissionRail from "./MissionRail";
import PlanComparison from "./PlanComparison";
import SpatialAgentStage from "./SpatialAgentStage";
import type { AgentRun, MissionEvent, MissionSnapshot } from "./types";
import { PHASE_LABELS, STATUS_LABELS } from "./types";

export interface MissionCockpitProps {
  mission: MissionSnapshot;
  onMissionChange(next: MissionSnapshot): void;
  onBack(): void;
}

/** 粮掌柜 2.5D 指挥舱：顶部阶段轨 + 协作星环 + 决策面板。 */
export default function MissionCockpit({ mission, onMissionChange, onBack }: MissionCockpitProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [liveRuns, setLiveRuns] = useState<Record<string, AgentRun["status"]>>({});
  const [streamError, setStreamError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const streamingRef = useRef(false);

  // 团队确认后（或刷新时任务仍在办理中）消费 NDJSON 流；流结束仍在办理则自动重连追踪
  useEffect(() => {
    if (mission.status !== "running" || streamingRef.current) return;
    streamingRef.current = true;
    const controller = new AbortController();
    setStreamError(null);

    streamMissionEvents(
      mission.id,
      (event: MissionEvent) => {
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

  // 轮询兆底：即使 NDJSON 流被代理缓冲，也能定期拉取最新状态，并同步 agent_runs 让卡片可点击查看结果
  useEffect(() => {
    if (mission.status !== "running") return;
    const timer = setInterval(() => {
      fetchMission(mission.id)
        .then((snapshot) => {
          if (snapshot.status !== "running") {
            setLiveRuns({});
            onMissionChange(snapshot);
          } else {
            // 同步 agent_runs 状态到 liveRuns，让节点动态变化
            const runs: Record<string, AgentRun["status"]> = {};
            for (const run of snapshot.agent_runs) {
              if (run.status !== "pending") {
                runs[run.agent_id] = run.status;
              }
            }
            if (Object.keys(runs).length > 0) {
              setLiveRuns(runs);
            }
            // 同步最新快照：让已完成的小二卡片可点击查看专业结果
            onMissionChange(snapshot);
          }
        })
        .catch(() => { /* 轮询失败静默忽略 */ });
    }, 1500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission.id, mission.status]);

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

      <MissionRail phase={mission.phase} status={mission.status} mission={mission} />

      <div className="zg-cockpit-grid">
        <div className="flex min-w-0 flex-col gap-3">
          <SpatialAgentStage
            mission={mission}
            liveRuns={liveRuns}
            selectedAgentId={selectedAgentId}
            onSelectAgent={handleSelectAgent}
          />
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
