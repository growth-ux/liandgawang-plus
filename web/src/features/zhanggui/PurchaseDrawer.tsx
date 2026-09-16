import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getAgent } from "../../data/agents";
import { purchaseCollaboration } from "./purchaseCollaboration";
import { purchaseInteraction } from "./purchaseInteraction";
import {
  PURCHASE_STAGES,
  type Purchase,
  type PurchaseNeed,
} from "./purchaseModel";
import AgentFactList from "./AgentFactList";

const STATUS: Record<string, string> = {
  pending: "待办理",
  running: "办理中",
  completed: "已完成",
  completed_with_objection: "待处理",
  failed: "结果缺失",
};

export default function PurchaseDrawer({
  open,
  agentId,
  purchase,
  need,
  stage,
  checking,
  reviewing,
  onClose,
  onSelectAgent,
  children,
}: {
  open: boolean;
  agentId: string;
  purchase: Purchase | null;
  need: PurchaseNeed;
  stage: number;
  checking: number | null;
  reviewing: boolean;
  onClose(): void;
  onSelectAgent(id: string): void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [evidence, setEvidence] = useState(false);
  const agent = getAgent(agentId)!;
  const { roles } = purchaseInteraction(purchase, stage, reviewing);
  const mission = purchaseCollaboration(purchase, need, stage, checking);
  const run = mission.agent_runs.find((item) => item.agent_id === agentId);
  const output = run?.output_snapshot;
  const blocked = mission.conflicts.length > 0;
  const showEvidenceAction = stage !== 3 && stage !== 7 && agentId !== "da";
  const status = reviewing
    ? "回看已完成阶段"
    : checking !== null
      ? "小二正在并行核验"
      : blocked
        ? "发现待处理事项"
        : roles.action;
  const showStatusText = (stage !== 3 || blocked) && Boolean(status);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const root = document.documentElement;
    const position = { left: window.scrollX, top: window.scrollY };
    const overflow = root.style.overflow;
    // body 为 100% 高度，裁剪它会让长页面折回一屏并把 scrollY 清零。
    // 锁定实际滚动根节点，保留文档高度与已有的稳定滚动条占位。
    root.style.overflow = "hidden";
    element.showModal();
    window.scrollTo({ ...position, behavior: "instant" });
    return () => {
      element.close();
      root.style.overflow = overflow;
      window.scrollTo({ ...position, behavior: "instant" });
    };
  }, [open]);

  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
    setEvidence(false);
  }, [stage, purchase?.id, purchase?.ordered]);

  return (
    <dialog
      ref={dialog}
      className="pw-business-drawer"
      data-wide={wide}
      aria-labelledby="purchase-drawer-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="pw-drawer-shell">
        <header className="pw-drawer-header">
          <img src={agent.image} alt="" />
          <div className="pw-drawer-title">
            <p className="pw-eyebrow">
              {reviewing ? "办理回看" : "正在办理"} ·{" "}
              {String(stage + 1).padStart(2, "0")} / 08
            </p>
            <h2 id="purchase-drawer-title">
              {agent.name}
              <span> / </span>
              {PURCHASE_STAGES[stage]}
            </h2>
          </div>
          <button
            type="button"
            className="pw-drawer-resize"
            onClick={() => setWide(!wide)}
            aria-pressed={wide}
          >
            {wide ? "恢复宽度" : "展开面板"}
          </button>
          <button
            type="button"
            className="pw-drawer-close"
            onClick={onClose}
            aria-label="收起办理抽屉"
          >
            ×
          </button>
        </header>
        {stage > 1 && <div className="pw-drawer-team" aria-label="当前协作团队">
          <button
            type="button"
            data-active={agentId === "da"}
            onClick={() => {
              onSelectAgent("da");
              setEvidence(false);
            }}
          >
            粮掌柜 <small>统筹</small>
          </button>
          {roles.members.map((id) => {
            const status = mission.agent_runs.find(
              (item) => item.agent_id === id,
            )!.status;
            return (
              <button
                type="button"
                key={id}
                data-active={agentId === id}
                data-state={status}
                onClick={() => {
                  onSelectAgent(id);
                  setEvidence(false);
                }}
              >
                {getAgent(id)!.name} <small>{STATUS[status]}</small>
              </button>
            );
          })}
        </div>}
        {stage > 1 && (showStatusText || showEvidenceAction) && <div
          className="pw-drawer-status"
          data-blocked={blocked}
          data-action-only={!showStatusText}
          role="status"
          aria-live="polite"
        >
          {showStatusText && <span>{status}</span>}
          {showEvidenceAction && (
            <button
              type="button"
              aria-expanded={evidence}
              onClick={() => setEvidence(!evidence)}
            >
              {evidence ? "收起专业依据" : "专业依据"}
            </button>
          )}
        </div>}
        <div className="pw-drawer-body" ref={body}>
          {evidence && (
            <section className="pw-drawer-evidence">
              <h3>{agent.name} · 专业依据</h3>
              {output ? (
                <>
                  <p>{output.summary}</p>
                  <AgentFactList facts={output.facts} />
                  {output.risks.map((risk, index) => (
                    <p className="pw-warning" key={index}>
                      {risk.detail}
                    </p>
                  ))}
                  {output.evidence.map((item, index) => (
                    <small key={index}>
                      {item.item} · 来源：{item.source}
                    </small>
                  ))}
                </>
              ) : (
                <p>
                  {run?.status === "running"
                    ? "正在办理，完成后可查看专业结果。"
                    : "本步尚未启动办理，完成核验后生成专业依据。"}
                </p>
              )}
            </section>
          )}
          {children}
        </div>
      </div>
    </dialog>
  );
}
