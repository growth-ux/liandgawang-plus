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

  const selectedMembers = mission.team.filter((member) => member.selected);
  const completedCount = selectedMembers.filter((member) => {
    const status = liveRuns?.[member.agent_id] ?? mission.agent_runs.find((run) => run.agent_id === member.agent_id)?.status;
    return status === "completed" || status === "completed_with_objection";
  }).length;

  return (
    <section className="zg-spatial-stage" ref={stageRef} data-paused={paused || undefined}>
      <header className="zg-stage-meta">
        <div className="zg-stage-heading">
          <p className="zg-stage-title">专业协作星环</p>
          <p className="zg-stage-subtitle">专业小二独立研判，粮掌柜汇总冲突与行动条件</p>
        </div>
        <div className="zg-stage-stats" aria-label="协作状态">
          <span><strong>{selectedMembers.length}</strong> 位参与</span>
          <span><strong>{completedCount}</strong> 位完成</span>
          <span data-alert={mission.conflicts.length > 0 || undefined}><strong>{mission.conflicts.length}</strong> 项冲突</span>
        </div>
      </header>
      <div className="zg-floor" />
      <AgentFlowSvg mission={mission} />

      <div className="zg-hub" data-processing={mission.status === "running" || undefined}>
        <div className="zg-hub-core">
          掌
          <span className="zg-hub-ring" />
          <span className="zg-hub-ring zg-hub-ring--outer" />
          <span className="zg-hub-beam" />
          {mission.status === "running" && <span className="zg-hub-pulse-ring" />}
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
        const effectiveRun =
          run && liveRuns?.[member.agent_id] && liveRuns[member.agent_id] !== run.status
            ? { ...run, status: liveRuns[member.agent_id] }
            : run;
        // 冲突关联方不等于异议发起方：卡片只高亮真正提交专业异议的小二。
        const hasObjection = member.selected && effectiveRun?.status === "completed_with_objection";
        const depth = member.selected
          ? resolveAgentDepth(effectiveRun, hasObjection, liveRuns?.[member.agent_id])
          : "back";
        return (
          <AgentPod
            key={member.agent_id}
            agent={member}
            run={effectiveRun}
            depth={depth}
            active={selectedAgentId === member.agent_id}
            inConflict={hasObjection}
            x={position.x}
            y={position.y}
            onClick={() => onSelectAgent(member.agent_id)}
          />
        );
      })}
    </section>
  );
}
