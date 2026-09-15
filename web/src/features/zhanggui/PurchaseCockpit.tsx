import { useEffect, useRef, useState, type CSSProperties } from "react";
import SpatialAgentStage from "./SpatialAgentStage";
import AgentResultDrawer from "./AgentResultDrawer";
import {
  purchaseCollaboration,
  purchaseStageRoles,
} from "./purchaseCollaboration";
import {
  PURCHASE_STAGES,
  type Purchase,
  type PurchaseNeed,
} from "./purchaseModel";

export default function PurchaseCockpit({
  purchase,
  need,
  stage,
  checking,
  advice,
}: {
  purchase: Purchase | null;
  need: PurchaseNeed;
  stage: number;
  checking: number | null;
  advice: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [scale, setScale] = useState(1);
  const frame = useRef<HTMLDivElement>(null);
  const mission = purchaseCollaboration(purchase, need, stage, checking);
  const run =
    mission.agent_runs.find((item) => item.agent_id === selected) ?? null;
  const roles = purchaseStageRoles(purchase, stage);
  const active = mission.team.filter((item) => item.selected);
  const demandStatus =
    purchase && purchase.stage > 0
      ? "采购需求已确认"
      : purchase?.marketDecision
        ? "请调整并重新确认采购需求"
        : "请描述并确认采购需求";
  const blocked = mission.conflicts.length > 0;
  useEffect(() => {
    setSelected(null);
    setExpanded(true);
  }, [stage, purchase?.id, purchase?.ordered]);
  useEffect(() => {
    if (selected && !roles.members.includes(selected)) setSelected(null);
  }, [selected, roles.members.join(",")]);
  useEffect(() => {
    if (!frame.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) =>
      setScale(entries[0].contentRect.width / 1040),
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  function openStep() {
    const element = document.getElementById("purchase-step-content");
    element?.scrollIntoView?.({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    element?.focus({ preventScroll: true });
  }
  return (
    <>
      <section
        className="pw-cockpit"
        aria-label="采购协作驾驶舱"
        data-stage={stage}
      >
        <div className="pw-cockpit-visual">
          <div className="pw-cockpit-toolbar">
            <span>
              协作驾驶舱 <small>同一采购 · 进度与结果实时联动</small>
            </span>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "收起协作全景" : "展开协作全景"}
            </button>
          </div>
          <div
            ref={frame}
            className={`pw-stage-frame${expanded ? "" : " is-collapsed"}`}
            style={{ "--cockpit-scale": scale } as CSSProperties}
          >
            <div className="pw-stage-scale">
              <SpatialAgentStage
                mission={mission}
                selectedAgentId={selected}
                onSelectAgent={setSelected}
                purchaseMode
                title={`${PURCHASE_STAGES[stage]} · ${stage === 0 ? "粮掌柜主理" : "专业协作"}`}
                subtitle={
                  stage === 0
                    ? "粮掌柜整理采购目标，确认后再安排专业小二"
                    : "粮掌柜主理 · 点击本步协作小二查看依据"
                }
                hubLabel={`粮掌柜 · ${roles.steward}`}
                hubSummary={
                  stage === 0
                    ? demandStatus
                    : checking !== null
                      ? "正在并行核验交易条件"
                      : stage === 1 &&
                          purchase?.marketDecision?.action === "watch"
                        ? "研判已保存 · 观望中"
                        : blocked
                          ? "发现阻塞，等待处理"
                          : purchase?.received
                            ? "采购闭环 · 经验已沉淀"
                            : `${PURCHASE_STAGES[stage]} · 等待你的确认`
                }
              />
            </div>
          </div>
          {!expanded && (
            <div className="pw-cockpit-compact">
              <span className="pw-compact-hub">掌</span>
              {stage === 0 && (
                <button type="button" onClick={openStep}>
                  <strong>粮掌柜 · 需求确认</strong>
                  <small>{demandStatus}</small>
                  <span>核对需求 ↓</span>
                </button>
              )}
              {active.map((member) => (
                <button
                  type="button"
                  key={member.agent_id}
                  onClick={() => setSelected(member.agent_id)}
                >
                  <strong>{member.name}</strong>
                  <small>
                    {mission.agent_runs.find(
                      (item) => item.agent_id === member.agent_id,
                    )?.output_snapshot?.summary ?? member.reason}
                  </small>
                  <span>查看结果 ↗</span>
                </button>
              ))}
            </div>
          )}
          <div className="pw-cockpit-legend">
            <span>青色 · 本步协作</span>
            <span>橙色 · 需要处理</span>
            <span>灰色 · 本步待命</span>
            <small>{purchase?.id ?? "确认需求后创建采购任务"}</small>
          </div>
        </div>
        <aside className="pw-mission-control" data-blocked={blocked}>
          <span className="pw-control-state">
            {checking !== null
              ? "小二正在办理"
              : blocked
                ? "发现待处理事项"
                : purchase?.received
                  ? "采购已完成"
                  : stage === 1 && purchase?.marketDecision?.action === "watch"
                    ? "观望中 · 尚未启动交易"
                    : "下一步由你确认"}
          </span>
          <p className="pw-eyebrow">粮掌柜 · 当前任务</p>
          <h2>{PURCHASE_STAGES[stage]}</h2>
          <p className="pw-control-advice">{advice}</p>
          {blocked && (
            <div className="pw-control-blockers" role="status">
              {mission.conflicts.map((conflict) => (
                <p key={conflict.agent_ids[0]}>{conflict.title}</p>
              ))}
            </div>
          )}
          <div className="pw-control-team">
            <strong>粮掌柜 · {roles.steward}</strong>
            <p>{roles.action}</p>
            {active.length > 0 && (
              <p>专业协作：{active.map((item) => item.name).join(" · ")}</p>
            )}
            <small>
              {checking !== null
                ? "核验进度会同步到节点与办理面板"
                : "操作结果直接更新驾驶舱，无需切换任务"}
            </small>
          </div>
          <button type="button" className="pw-button" onClick={openStep}>
            {stage === 0
              ? "填写采购需求"
              : stage === 1
                ? "查看行情与采购建议"
                : stage === 6
                  ? "查看成本与经验"
                  : blocked
                    ? "处理当前问题"
                    : "办理当前步骤"}{" "}
            ↓
          </button>
        </aside>
      </section>
      <AgentResultDrawer run={run} onClose={() => setSelected(null)} />
    </>
  );
}
