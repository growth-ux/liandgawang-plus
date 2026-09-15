import type { AgentRun, CollaborationSnapshot } from "./types";

/** 舞台坐标系：以中央粮掌柜为原点，单位为 px（与 AgentPod 的 --x/--y 一致）。 */
export const STAGE_VIEW = { minX: -520, minY: -300, width: 1040, height: 600 };

export const AGENT_POSITIONS: Record<string, { x: number; y: number }> = {
  zhan: { x: -300, y: -188 },
  liang: { x: 286, y: -184 },
  yun: { x: 392, y: 10 },
  suan: { x: 286, y: 194 },
  qian: { x: -300, y: 198 },
  an: { x: -402, y: 8 },
};

export type LinkKind = "normal" | "conflict" | "standby" | "failed";

/** 连线与节点共用有效运行状态，待启动与未参与都保持灰色。 */
export function resolveLinkKind(
  mission: CollaborationSnapshot,
  agentId: string,
  liveStatus?: AgentRun["status"],
): LinkKind {
  const member = mission.team.find((item) => item.agent_id === agentId);
  if (!member?.selected) return "standby";
  const run = mission.agent_runs.find((item) => item.agent_id === agentId);
  const status = liveStatus ?? run?.status;
  if (!status || status === "pending") return "standby";
  if (status === "failed") return "failed";
  // 只有该小二自己提出异议时才用橙色连线；仅被其他小二引用为冲突关联方不算异议
  if (status === "completed_with_objection") return "conflict";
  return "normal";
}

export interface AgentFlowSvgProps {
  mission: CollaborationSnapshot;
  liveRuns?: Record<string, AgentRun["status"]>;
}

/** SVG 数据流：蓝色正常交接、橙色冲突、灰色待命、红灰断线。 */
export default function AgentFlowSvg({ mission, liveRuns }: AgentFlowSvgProps) {
  return (
    <svg
      className="zg-flow-svg"
      viewBox={`${STAGE_VIEW.minX} ${STAGE_VIEW.minY} ${STAGE_VIEW.width} ${STAGE_VIEW.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <ellipse className="zg-orbit-track" cx="0" cy="4" rx="398" ry="208" />
      {mission.team.map((member) => {
        const position = AGENT_POSITIONS[member.agent_id];
        if (!position) return null;
        const kind = resolveLinkKind(
          mission,
          member.agent_id,
          liveRuns?.[member.agent_id],
        );
        const midX = position.x * 0.45;
        const midY = position.y * 0.45 - 26;
        return (
          <path
            key={member.agent_id}
            className="zg-flow-line"
            data-kind={kind}
            data-agent-id={member.agent_id}
            d={`M 0 0 Q ${midX} ${midY} ${position.x} ${position.y}`}
          />
        );
      })}
    </svg>
  );
}
