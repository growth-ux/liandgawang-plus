import { useState } from "react";
import { submitDecision } from "./api";
import type { MissionSnapshot } from "./types";

export interface DecisionGateProps {
  mission: MissionSnapshot;
  onResolved(next: MissionSnapshot): void;
}

/** Human-in-the-loop 决策闸门：默认不预选，提交前说明后果，失败保留现场。 */
export default function DecisionGate({ mission, onResolved }: DecisionGateProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  const pending = mission.decisions.find((decision) => decision.status === "pending" && decision.gate_type === "plan");

  if (!pending) {
    return (
      <aside className="zg-decision-gate">
        <p className="zg-gate-kicker">DECISION PANEL</p>
        <h2 className="mt-2 text-base font-medium">当前没有待确认事项</h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          {mission.status === "completed"
            ? "任务已完成，行动任务已分派给对应小二，可在“我的办事”中跟进。"
            : mission.status === "failed"
              ? "本轮办理未能形成可用方案，可返回重新调整目标或团队。"
              : mission.status === "terminated"
                ? "这项办事已由用户终止，历史分析与确认记录仍可在任务中查看。"
              : "粮掌柜正在组织专业小二办理，到达关键节点时会在这里请你确认。"}
        </p>
        {mission.recommendation && (
          <p className="mt-3 text-sm text-ink-soft">
            当前判断：主推方案 {mission.recommendation.primary_scheme_id}
            {mission.recommendation.backup_scheme_id ? `，备选方案 ${mission.recommendation.backup_scheme_id}` : ""}。
          </p>
        )}
      </aside>
    );
  }

  async function resolve(action: string) {
    if (busy || !pending) return;
    setBusy(true);
    setError(null);
    setChosen(action);
    try {
      const next = await submitDecision(mission.id, pending.id, action);
      onResolved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "决策提交失败，请重试");
      setBusy(false);
      setChosen(null);
    }
  }

  return (
    <aside className="zg-decision-gate">
      <p className="zg-gate-kicker">HUMAN-IN-THE-LOOP · 决策闸门</p>
      <h2 className="mt-2 text-base font-medium leading-6">{pending.prompt}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{pending.ai_recommendation}</p>

      <div className="zg-gate-actions">
        {pending.options.map((option) => (
          <button
            key={option.action}
            type="button"
            disabled={busy}
            onClick={() => resolve(option.action)}
          >
            <span className="font-medium">{option.label}</span>
            {option.description && (
              <span className="mt-0.5 block text-xs text-ink-soft">{option.description}</span>
            )}
          </button>
        ))}
      </div>

      <div className="zg-gate-note">
        {chosen
          ? `正在按「${pending.options.find((o) => o.action === chosen)?.label ?? chosen}」执行…`
          : "确认后才会创建行动任务；AI 不会自动放宽质量、预算、交期或风险底线。"}
        {error && <p className="mt-2 text-red-300">{error}</p>}
      </div>
    </aside>
  );
}
