import { useEffect, useRef, useState } from "react";
import AgentFlowSvg from "./AgentFlowSvg";
import AgentPod from "./AgentPod";
import { AGENT_POSITIONS } from "./AgentFlowSvg";
import type { AgentRun, MissionSnapshot } from "./types";

export interface SpatialAgentStageProps {
  mission: MissionSnapshot;
  /** 流式事件实时覆盖的运行状态（尚未落入快照） */
  liveRuns?: Record<string, AgentRun["status"]>;
  selectedAgentId: string | null;
  onSelectAgent(id: string): void;
}

/** 状态到空间深度的纯映射：冲突→前景，办理中→中景，其余→后景。 */
export function resolveAgentDepth(run: AgentRun | undefined, hasConflict: boolean, liveStatus?: AgentRun["status"]) {
  if (hasConflict) return "front" as const;
  const status = liveStatus ?? run?.status;
  if (status === "running") return "middle" as const;
  return "back" as const;
}

/** 2.5D 协作沙盘：空间深度承担业务语义，动画只表达后端已有状态。 */
export default function SpatialAgentStage({ mission, liveRuns, selectedAgentId, onSelectAgent }: SpatialAgentStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    function handleVisibility() {
      setPaused(document.visibilityState !== "visible");
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const conflictAgents = new Set(mission.conflicts.flatMap((conflict) => conflict.agent_ids));

  return (
    <section className="zg-spatial-stage" ref={stageRef} data-paused={paused || undefined}>
      <div className="zg-floor" />
      <AgentFlowSvg mission={mission} />

      <div className="zg-hub">
        <div className="zg-hub-core">
          掌
          <span className="zg-hub-ring" />
          <span className="zg-hub-ring zg-hub-ring--outer" />
          <span className="zg-hub-beam" />
        </div>
        <p className="text-xs font-medium text-brand-deep">粮掌柜 · 中央编排</p>
        <p className="max-w-[180px] text-center text-[10px] leading-4 text-ink-soft">
          {mission.recommendation
            ? `主推方案 ${mission.recommendation.primary_scheme_id}`
            : mission.status === "running"
              ? "正在汇总各专业结果…"
              : "等待任务推进"}
        </p>
      </div>

      {mission.team.map((member) => {
        const position = AGENT_POSITIONS[member.agent_id] ?? { x: 0, y: 0 };
        const run = mission.agent_runs.find((item) => item.agent_id === member.agent_id);
        const inConflict = member.selected && conflictAgents.has(member.agent_id);
        const depth = member.selected
          ? resolveAgentDepth(run, inConflict, liveRuns?.[member.agent_id])
          : "back";
        const effectiveRun =
          run && liveRuns?.[member.agent_id] && liveRuns[member.agent_id] !== run.status
            ? { ...run, status: liveRuns[member.agent_id] }
            : run;
        return (
          <AgentPod
            key={member.agent_id}
            agent={member}
            run={effectiveRun}
            depth={depth}
            active={selectedAgentId === member.agent_id}
            inConflict={inConflict}
            x={position.x}
            y={position.y}
            onClick={() => onSelectAgent(member.agent_id)}
          />
        );
      })}
    </section>
  );
}
