import type { CSSProperties } from "react";
import { getAgent } from "../../data/agents";
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
  const profile = getAgent(agent.agent_id);
  const status = agent.selected ? (run?.status ?? "pending") : "standby";
  const statusText = !agent.selected ? "未参与" : STATUS_TEXT[status] ?? status;
  const summary = run?.output_snapshot?.summary;
  const evidenceCount = run?.output_snapshot?.evidence.length ?? 0;
  const riskCount = run?.output_snapshot?.risks.length ?? 0;

  return (
    <button
      type="button"
      className="zg-agent-pod"
      data-depth={depth}
      data-active={active}
      data-conflict={inConflict}
      data-status={agent.selected ? status : undefined}
      data-participating={agent.selected || undefined}
      style={{ "--x": `${x}px`, "--y": `${y}px` } as CSSProperties}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`查看${agent.name}专业结果`}
    >
      <div className="zg-pod-head">
        <span className="zg-pod-avatar" style={{ "--agent-accent": profile?.accent ?? "var(--color-tech)" } as CSSProperties}>
          {profile?.char ?? agent.name.slice(0, 1)}
        </span>
        <span className="zg-pod-identity">
          <strong>{agent.name}</strong>
          <small>{profile?.role ?? "专业协作"}</small>
        </span>
        <span className="zg-pod-status" data-status={status}>
          <span className="zg-pod-status-dot" />{statusText}
        </span>
      </div>
      <p className="zg-pod-summary">
        {!agent.selected ? agent.reason : status === "failed" ? "专业结果缺失，可重试" : summary || agent.reason}
      </p>
      <span className="zg-pod-foot">
        {summary ? (
          <>
            <span>{evidenceCount} 条依据</span>
            <span>{riskCount > 0 ? `${riskCount} 项风险` : "已形成结论"}</span>
          </>
        ) : (
          <span>{agent.expected_output || (agent.selected ? "等待专业结果" : "本轮保持待命")}</span>
        )}
        <span className="zg-pod-open">查看详情</span>
      </span>
    </button>
  );
}
