import type { TransportPlan } from "./types";
import RouteDiagram from "./RouteDiagram";

interface Props {
  plan: TransportPlan;
  quantityTons: number;
  onAdopt: (planId: number) => void;
  busy?: boolean;
}

/** 主推方案：整行视觉中心，绿色强调边框 */
export default function PlanDecisionCard({ plan, quantityTons, onAdopt, busy }: Props) {
  const totalLow = plan.price_low * quantityTons;
  const totalHigh = plan.price_high * quantityTons;

  return (
    <section className="rounded-3xl border border-emerald-500/50 bg-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-ink">{plan.title}</h3>
          <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            主推
          </span>
        </div>
        <span className="text-sm text-ink-soft">
          参考运费 ¥{plan.price_low}~{plan.price_high} 元/吨
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-line/60 bg-rice/40 px-3">
        <RouteDiagram legs={plan.legs} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line/60 bg-rice/40 px-4 py-3">
          <p className="text-xs text-ink-soft">预计总运费</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {(totalLow / 10000).toFixed(2)} ~ {(totalHigh / 10000).toFixed(2)} 万元
          </p>
        </div>
        <div className="rounded-xl border border-line/60 bg-rice/40 px-4 py-3">
          <p className="text-xs text-ink-soft">预计时效</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {plan.days_low}~{plan.days_high} 天
          </p>
        </div>
        <div className="rounded-xl border border-line/60 bg-rice/40 px-4 py-3">
          <p className="text-xs text-ink-soft">换装</p>
          <p className="mt-1 text-sm font-semibold text-ink">{plan.transship_count} 次</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-soft">满足最晚到货与承运要求</p>

      {plan.risk_note && (
        <p className="mt-2 text-xs text-amber-300">风险提示：{plan.risk_note}</p>
      )}
      {plan.check_items.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-ink-soft">
          {plan.check_items.map((c) => (
            <li key={c}>☐ 待核验：{c}</li>
          ))}
        </ul>
      )}

      {plan.reason && (
        <p className="mt-3 text-sm leading-6 text-ink-soft">推荐理由：{plan.reason}</p>
      )}

      <button
        type="button"
        onClick={() => onAdopt(plan.id)}
        disabled={busy}
        className="mt-4 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "处理中…" : "采用方案，生成询运单"}
      </button>
    </section>
  );
}
