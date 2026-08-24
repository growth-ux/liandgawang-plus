import type { MissionSnapshot } from "./types";

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

/** 连线语义完全由后端状态决定，不用独立定时器伪造状态。 */
export function resolveLinkKind(mission: MissionSnapshot, agentId: string): LinkKind {
  const member = mission.team.find((item) => item.agent_id === agentId);
  if (!member?.selected) return "standby";
  const run = mission.agent_runs.find((item) => item.agent_id === agentId);
  if (run?.status === "failed") return "failed";
  // 只有该小二自己提出异议时才用橙色连线；仅被其他小二引用为冲突关联方不算异议
  if (run?.status === "completed_with_objection") return "conflict";
  return "normal";
}

export interface AgentFlowSvgProps {
  mission: MissionSnapshot;
}

/** SVG 数据流：蓝色正常交接、橙色冲突、灰色待命、红灰断线。 */
export default function AgentFlowSvg({ mission }: AgentFlowSvgProps) {
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
        const kind = resolveLinkKind(mission, member.agent_id);
        const midX = position.x * 0.45;
        const midY = position.y * 0.45 - 26;
        return (
          <path
            key={member.agent_id}
            className="zg-flow-line"
            data-kind={kind}
            d={`M 0 0 Q ${midX} ${midY} ${position.x} ${position.y}`}
          />
        );
      })}
    </svg>
  );
}
