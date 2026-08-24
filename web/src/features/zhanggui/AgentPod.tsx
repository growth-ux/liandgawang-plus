import type { CSSProperties } from "react";
import type { AgentRun, TeamMember } from "./types";

export interface AgentPodProps {
  agent: TeamMember;
  run?: AgentRun;
  depth: "back" | "middle" | "front";
  active: boolean;
  inConflict?: boolean;
  x: number;
  y: number;
  onClick(): void;
}

const STATUS_TEXT: Record<string, string> = {
  pending: "待启动",
  running: "办理中",
  completed: "已完成",
  completed_with_objection: "有异议",
  failed: "结果缺失",
};

/** 单个小二空间节点：位置、深度与状态由真实任务状态驱动。 */
export default function AgentPod({ agent, run, depth, active, inConflict, x, y, onClick }: AgentPodProps) {
  const status = agent.selected ? (run?.status ?? "pending") : "standby";
  const statusText = !agent.selected ? "未参与" : STATUS_TEXT[status] ?? status;
  const summary = run?.output_snapshot?.summary;

  return (
    <div
      className="zg-agent-pod"
      data-depth={depth}
      data-active={active}
      data-conflict={inConflict}
      style={{ "--x": `${x}px`, "--y": `${y}px` } as CSSProperties}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === "Enter" && onClick()}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{agent.name}</span>
        <span className="zg-pod-status" data-status={status}>
          <span className="zg-pod-status-dot" />
          {statusText}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-ink-soft">
        {!agent.selected ? agent.reason : status === "failed" ? "专业结果缺失，可重试" : summary || agent.reason}
      </p>
    </div>
  );
}
