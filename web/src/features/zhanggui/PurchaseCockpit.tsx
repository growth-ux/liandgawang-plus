import SpatialAgentStage from "./SpatialAgentStage";
import { getAgent } from "../../data/agents";
import { purchaseCollaboration } from "./purchaseCollaboration";
import { purchaseInteraction } from "./purchaseInteraction";
import {
  PURCHASE_STAGES,
  type Purchase,
  type PurchaseNeed,
} from "./purchaseModel";

/** 数字人是本步业务入口，舞台下方不再铺业务表单。 */
export default function PurchaseCockpit({
  purchase,
  need,
  stage,
  checking,
  reviewing = false,
  selectedAgent,
  onOpen,
}: {
  purchase: Purchase | null;
  need: PurchaseNeed;
  stage: number;
  checking: number | null;
  reviewing?: boolean;
  selectedAgent: string | null;
  onOpen(agentId: string): void;
}) {
  const mission = purchaseCollaboration(purchase, need, stage, checking);
  const { owner, action, entries, roles } = purchaseInteraction(
    purchase,
    stage,
    reviewing,
  );
  const blocked = mission.conflicts.length > 0;
  const state = reviewing
    ? "历史阶段 · 只读回看"
    : checking !== null
      ? "专业小二正在并行核验"
      : blocked
        ? mission.conflicts[0].title
        : stage === 6 && purchase?.received
          ? "采购已完成，经验已沉淀"
          : stage === 0
            ? "告诉我你想买什么粮，我来组织小二办理"
            : stage === 1 && purchase?.marketDecision?.action === "watch"
              ? "研判已保存，决定采购时可继续办理"
              : stage === 5 && purchase?.ordered
                ? "运小二跟进发运与到货，等待验收确认"
                : roles.action;

  return (
    <section className="pw-agent-cockpit" aria-label="采购数字人驾驶舱">
      <div className="pw-stage-task" data-blocked={blocked}>
        <div className="pw-stage-task-copy">
          <p className="pw-eyebrow">
            {reviewing ? "正在回看" : "当前待办"} · {PURCHASE_STAGES[stage]}
          </p>
          <p role="status" aria-live="polite">
            {state}
          </p>
        </div>
        <button
          type="button"
          className="pw-button"
          onClick={() => onOpen(owner)}
          aria-haspopup="dialog"
        >
          找{getAgent(owner)!.name} · {action} <span aria-hidden="true">↗</span>
        </button>
      </div>
      <SpatialAgentStage
        mission={mission}
        animationKey={`${purchase?.id ?? "draft"}:${stage}:${Boolean(purchase?.ordered)}`}
        selectedAgentId={selectedAgent}
        onSelectAgent={onOpen}
        onSelectHub={() => onOpen("da")}
        agentActions={entries}
        hubAction={
          reviewing
            ? "回看当前步骤"
            : stage === 0
              ? "开始办理采购"
              : "继续办理当前步骤"
        }
        purchaseMode
        title="点击数字人，直接办理"
        subtitle="粮掌柜统筹全程 · 点选本步参与的小二，打开办理抽屉"
        hubLabel={`粮掌柜 · ${roles.steward}`}
        hubSummary={
          stage === 0 ? "一句话说需求，小二协同办" : PURCHASE_STAGES[stage]
        }
      />
      <div className="pw-stage-footer">
        <span>
          <i data-state="running" />
          办理中
        </span>
        <span>
          <i data-state="completed" />
          已完成
        </span>
        <span>
          <i data-state="objection" />
          待处理
        </span>
        <span>
          <i />
          本步待命
        </span>
        <small>点数字人办事，点粮掌柜继续当前步骤</small>
      </div>
    </section>
  );
}
