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
  const terminal = ["completed", "partially_completed", "failed"].includes(mission.status);

  if (terminal) {
    return <MissionResultPanel mission={mission} />;
  }

  if (!pending) {
    return (
      <aside className="zg-decision-gate">
        <p className="zg-gate-kicker">办理进展</p>
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
      <div className="zg-gate-header">
        <span className="zg-gate-state"><span />待你确认</span>
        <span className="zg-gate-stage">关键决策</span>
      </div>
      <h2 className="zg-gate-title">请选择下一步执行方式</h2>
      <div className="zg-gate-insight">
        <span>粮掌柜建议</span>
        <p>{pending.prompt || pending.ai_recommendation}</p>
      </div>

      <div className="zg-gate-actions">
        {pending.options.map((option, index) => (
          <button
            key={option.action}
            type="button"
            disabled={busy}
            onClick={() => resolve(option.action)}
            data-recommended={index === 0 || undefined}
            data-chosen={chosen === option.action || undefined}
          >
            <span className="zg-gate-action-head">
              <strong>{option.label}</strong>
              <small>{index === 0 ? "推荐" : "备选"}</small>
            </span>
            {option.description && (
              <span className="zg-gate-action-desc">{option.description}</span>
            )}
            <span className="zg-gate-action-cta">{chosen === option.action ? "正在创建任务…" : "确认执行"}</span>
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

function MissionResultPanel({ mission }: { mission: MissionSnapshot }) {
  const recommendation = mission.recommendation;
  const readyCount = mission.action_tasks.filter((task) => task.status === "ready").length;
  const waitingCount = mission.action_tasks.filter((task) => task.status === "waiting_prerequisite").length;
  const resultState = mission.status === "failed" ? "failed" : mission.status === "partially_completed" ? "partial" : "completed";
  const resultLabel = resultState === "failed" ? "未形成可用方案" : resultState === "partial" ? "方案已形成，部分结果缺失" : "任务已完成";
  const primaryScheme = recommendation ? getSchemeDisplay(mission, recommendation.primary_scheme_id) : null;
  const backupScheme = recommendation?.backup_scheme_id ? getSchemeDisplay(mission, recommendation.backup_scheme_id) : null;

  return (
    <aside className="zg-result-panel" data-state={resultState}>
      <div className="zg-result-status">
        <span className="zg-result-status-dot" />
        {resultLabel}
      </div>

      {recommendation ? (
        <>
          <h2 className="zg-result-title">最终办理结果</h2>
          <div className="zg-result-schemes">
            {primaryScheme && <SchemeResultCard scheme={primaryScheme} primary />}
            {backupScheme && <SchemeResultCard scheme={backupScheme} />}
          </div>

          <div className="zg-result-summary">
            <strong>粮掌柜结论</strong>
            <p>{recommendation.summary}</p>
          </div>

          {(recommendation.condition || recommendation.fallback_trigger) && (
            <dl className="zg-result-conditions">
              {recommendation.condition && (
                <div>
                  <dt>方案生效条件</dt>
                  <dd>{recommendation.condition}</dd>
                </div>
              )}
              {recommendation.fallback_trigger && (
                <div>
                  <dt>切换备选条件</dt>
                  <dd>{recommendation.fallback_trigger}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="zg-result-actions-summary">
            <strong>{mission.action_tasks.length}</strong>
            <span>项行动任务已生成</span>
            {(readyCount > 0 || waitingCount > 0) && (
              <small>
                {readyCount > 0 ? `${readyCount} 项可办理` : ""}
                {readyCount > 0 && waitingCount > 0 ? "，" : ""}
                {waitingCount > 0 ? `${waitingCount} 项等待前置核验` : ""}
              </small>
            )}
          </div>
        </>
      ) : (
        <>
          <h2 className="zg-result-title">本轮办理结果</h2>
          <p className="zg-result-summary">本轮未能形成可执行的综合方案，请调整采购目标或协作团队后重新办理。</p>
        </>
      )}
    </aside>
  );
}

interface SchemeDisplay {
  id: string;
  supplierName: string;
  listingCode: string | null;
  grade: string | null;
  availableQuantityTons: string | null;
  deliveredCostYuanPerTon: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getFacts(mission: MissionSnapshot, agentId: string) {
  return mission.agent_runs.find((run) => run.agent_id === agentId)?.output_snapshot?.facts ?? {};
}

function getSchemeDisplay(mission: MissionSnapshot, schemeId: string): SchemeDisplay {
  const candidateFacts = getFacts(mission, "liang").candidates;
  const costingFacts = getFacts(mission, "suan").schemes;
  const candidates = Array.isArray(candidateFacts) ? candidateFacts.filter(isRecord) : [];
  const schemes = Array.isArray(costingFacts) ? costingFacts.filter(isRecord) : [];
  const candidate = candidates.find((item) => String(item.scheme_id) === schemeId);
  const costing = schemes.find((item) => String(item.scheme_id) === schemeId);
  const costingName = typeof costing?.name === "string" ? costing.name : "";
  const nameMatch = costingName.match(/^(.*?)（(.*?)）$/);

  return {
    id: schemeId,
    supplierName: String(candidate?.supplier_name ?? nameMatch?.[1] ?? (costingName || `方案 ${schemeId}`)),
    listingCode: candidate?.listing_code ? String(candidate.listing_code) : nameMatch?.[2] ?? null,
    grade: candidate?.grade ? String(candidate.grade) : null,
    availableQuantityTons: candidate?.available_quantity_tons ? String(candidate.available_quantity_tons) : null,
    deliveredCostYuanPerTon: costing?.delivered_cost_yuan_per_ton ? String(costing.delivered_cost_yuan_per_ton) : null,
  };
}

function moneyText(value: string) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)
    : value;
}

function SchemeResultCard({ scheme, primary = false }: { scheme: SchemeDisplay; primary?: boolean }) {
  return (
    <div className="zg-result-scheme" data-primary={primary || undefined}>
      <div className="zg-result-scheme-head">
        <span>{primary ? "主推方案" : "备选方案"}</span>
        <strong>{scheme.id}</strong>
      </div>
      <p className="zg-result-supplier">{scheme.supplierName}</p>
      {scheme.listingCode && <p className="zg-result-listing">粮源单号 {scheme.listingCode}</p>}
      <div className="zg-result-scheme-meta">
        {scheme.grade && <span>{scheme.grade}</span>}
        {scheme.availableQuantityTons && <span>可供 {scheme.availableQuantityTons} 吨</span>}
        {scheme.deliveredCostYuanPerTon && <span>到厂 {moneyText(scheme.deliveredCostYuanPerTon)} 元/吨</span>}
      </div>
    </div>
  );
}
