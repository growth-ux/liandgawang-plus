import type { CSSProperties } from "react";
import type { AgentRun, TeamMember } from "./types";
import IpPortrait from "./IpPortrait";
import { IpPedestal, type StageFeedback } from "./StageBackdrop";

export interface AgentPodProps {
  agent: TeamMember;
  run?: AgentRun;
  effectiveStatus?: AgentRun["status"];
  participating?: boolean;
  active: boolean;
  x: number;
  y: number;
  onClick(): void;
  standbyLabel?: string;
  disabled?: boolean;
  feedback?: StageFeedback;
}
const STATUS_TEXT: Record<string, string> = {
  pending: "待启动",
  running: "办理中",
  completed: "已完成",
  completed_with_objection: "有异议",
  failed: "结果缺失",
};

export default function AgentPod({
  agent,
  run,
  effectiveStatus,
  participating = agent.selected,
  active,
  x,
  y,
  onClick,
  standbyLabel,
  disabled,
  feedback,
}: AgentPodProps) {
  const status = participating
    ? (effectiveStatus ?? run?.status ?? "pending")
    : "standby";
  const statusText = participating
    ? STATUS_TEXT[status]
    : (standbyLabel ?? "待命");
  return (
    <button
      type="button"
      className="zg-agent-pod"
      data-agent-id={agent.agent_id}
      data-depth={y < 300 ? "back" : "front"}
      data-active={active}
      data-status={status}
      data-feedback={feedback}
      data-participating={participating || undefined}
      style={
        { "--x": `${x}px`, "--y": `${y}px`, "--depth": y } as CSSProperties
      }
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${agent.name}，${statusText}${disabled ? "" : "，查看专业结果"}`}
    >
      <span className="zg-ip-figure">
        <IpPedestal feedback={feedback ? { [agent.agent_id]: feedback } : undefined} />
        <IpPortrait agentId={agent.agent_id} name={agent.name} />
      </span>
      <span className="zg-pod-caption">
        <span className="zg-pod-heading">
          <strong>{agent.name}</strong>
          <span className="zg-pod-status">
            <span className="zg-pod-status-dot" />
            {statusText}
          </span>
        </span>
      </span>
    </button>
  );
}
