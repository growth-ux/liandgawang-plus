import type { MissionRecommendation } from "./types";

export interface PlanComparisonProps {
  recommendation: MissionRecommendation;
  /** 算小二结果中的事实字段（可选）：提供综合吨成本与总差额 */
  suanFacts?: Record<string, unknown> | null;
}

/** 主推与备选方案对比：成本、时效、风险、生效条件与切换条件。 */
export default function PlanComparison({ recommendation, suanFacts }: PlanComparisonProps) {
  const delivered = (suanFacts?.delivered_cost_yuan_per_ton ?? {}) as Record<string, string>;
  const saving = typeof suanFacts?.saving_total_yuan === "string" ? suanFacts.saving_total_yuan : null;
  const delta = typeof suanFacts?.delta_yuan_per_ton === "string" ? suanFacts.delta_yuan_per_ton : null;

  return (
    <section className="rounded-2xl border border-line bg-panel px-5 py-4">
      <h3 className="text-sm font-semibold text-tech">综合方案对比</h3>

      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-ink-soft">主推方案</span>
          <span className="font-medium">
            {recommendation.primary_scheme_id}
            {delivered[recommendation.primary_scheme_id]
              ? ` · 到厂吨成本 ${delivered[recommendation.primary_scheme_id]} 元`
              : ""}
          </span>
        </div>

        {recommendation.backup_scheme_id && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-soft">备选方案</span>
            <span>
              {recommendation.backup_scheme_id}
              {delivered[recommendation.backup_scheme_id]
                ? ` · 到厂吨成本 ${delivered[recommendation.backup_scheme_id]} 元`
                : ""}
            </span>
          </div>
        )}

        {saving && (
          <p className="text-sm text-ink-soft">
            总差额：<span className="font-medium text-tech">{saving} 元</span>
            {delta ? `（每吨 ${delta} 元）` : ""}
          </p>
        )}

        {recommendation.reasons.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {recommendation.reasons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        {recommendation.tradeoffs.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-brand-deep">
            {recommendation.tradeoffs.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        {recommendation.condition && (
          <p className="text-sm text-ink-soft">
            生效条件：<span className="font-medium text-tech">{recommendation.condition}</span>
          </p>
        )}

        {recommendation.fallback_trigger && (
          <p className="text-sm text-red-300">
            切换触发：<span className="font-medium">{recommendation.fallback_trigger}</span>
          </p>
        )}

        {recommendation.next_actions.length > 0 && (
          <details className="rounded-xl border border-line bg-rice p-3">
            <summary className="cursor-pointer text-sm text-ink-soft">后续行动草稿（待确认）</summary>
            <ul className="mt-2 space-y-1.5">
              {recommendation.next_actions.map((action) => (
                <li key={action.action_code} className="flex items-start justify-between gap-3">
                  <span className="max-w-[70%] truncate">{action.title}</span>
                  <span className="shrink-0 rounded-full bg-rice-deep px-2 py-0.5 text-[11px] text-tech">
                    {action.requires_prerequisite ? "等待前置核验" : "可立即办理"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
