import type { AgentRun, CollaborationSnapshot } from "./types";

/** 背景、脚底锚点和连线共用同一设计坐标。 */
export const STAGE_VIEW = { minX: 0, minY: 0, width: 1040, height: 720 };
export const HUB_POSITION = { x: 520, y: 370 };
export const AGENT_POSITIONS: Record<string, { x: number; y: number }> = {
  zhan: { x: 260, y: 245 },
  liang: { x: 755, y: 245 },
  yun: { x: 880, y: 430 },
  suan: { x: 720, y: 575 },
  qian: { x: 325, y: 575 },
  an: { x: 155, y: 430 },
};
export type LinkKind =
  | "running"
  | "completed"
  | "conflict"
  | "standby"
  | "failed";

export function resolveLinkKind(
  mission: CollaborationSnapshot,
  agentId: string,
  liveStatus?: AgentRun["status"],
  participatingOverride?: boolean,
): LinkKind {
  if (
    participatingOverride !== true &&
    !mission.team.find((item) => item.agent_id === agentId)?.selected
  )
    return "standby";
  const status =
    liveStatus ??
    mission.agent_runs.find((item) => item.agent_id === agentId)?.status;
  if (!status || status === "pending") return "standby";
  // 关联冲突不等于主动提出异议，只高亮实际异议节点。
  if (status === "completed_with_objection") return "conflict";
  return status;
}

export interface AgentFlowSvgProps {
  mission: CollaborationSnapshot;
  liveRuns?: Record<string, AgentRun["status"]>;
  returningAgentIds?: string[];
  dispatchingAgentIds?: string[];
  activityAgentIds?: string[];
  /** 当前步骤参与者与粮掌柜之间持续传递协作信号。 */
  continuousFlow?: boolean;
}

export default function AgentFlowSvg({
  mission,
  liveRuns,
  returningAgentIds = [],
  dispatchingAgentIds = [],
  activityAgentIds = [],
  continuousFlow = false,
}: AgentFlowSvgProps) {
  return (
    <svg className="zg-flow-svg" viewBox="0 0 1040 720" aria-hidden="true">
      {Object.entries(AGENT_POSITIONS).map(([id, position]) => {
        const participating =
          activityAgentIds.includes(id) ||
          mission.team.some(
            (member) => member.agent_id === id && member.selected,
          );
        const kind = resolveLinkKind(
          mission,
          id,
          liveRuns?.[id],
          participating,
        );
        const returning =
          returningAgentIds.includes(id) &&
          (kind === "completed" || kind === "conflict");
        const dispatching = dispatchingAgentIds.includes(id) && kind === "running";
        const d = `M ${HUB_POSITION.x} ${HUB_POSITION.y} Q ${(position.x + HUB_POSITION.x) / 2} ${Math.min(position.y, HUB_POSITION.y) - 48} ${position.x} ${position.y}`;
        return (
          <g
            key={id}
            className="zg-flow-link"
            data-kind={kind}
            data-participating={participating || undefined}
            data-agent-id={id}
            data-returning={returning || undefined}
          >
            <path className="zg-flow-line" d={d} />
            {continuousFlow && participating && (
              <>
                <path
                  className="zg-flow-particle zg-flow-particle--continuous-send"
                  pathLength="100"
                  d={d}
                />
                <path
                  className="zg-flow-particle zg-flow-particle--continuous-return"
                  pathLength="100"
                  d={d}
                />
              </>
            )}
            {(dispatching || returning) && (
              <path
                key={returning ? "return" : "dispatch"}
                className={`zg-flow-particle ${returning ? "zg-flow-particle--return" : "zg-flow-particle--send"}`}
                pathLength="100"
                d={d}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
