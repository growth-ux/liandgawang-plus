import type { CostComparison, SchemeResult } from "./types";
import { formatTonPrice, formatYuan, formatTons } from "./format";

interface Props {
  comparison: CostComparison;
  selectedSchemeId: string | null;
  onSelectScheme: (id: string) => void;
}

const BREAKDOWN_LABELS: { key: keyof SchemeResult["breakdown"]; label: string; color: string }[] = [
  { key: "purchase_yuan_per_ton", label: "货价", color: "bg-violet-400" },
  { key: "quality_yuan_per_ton", label: "质量扣价", color: "bg-amber-400" },
  { key: "freight_yuan_per_ton", label: "运费", color: "bg-emerald-400" },
  { key: "loading_yuan_per_ton", label: "装卸", color: "bg-sky-400" },
  { key: "loss_impact_yuan_per_ton", label: "损耗影响", color: "bg-red-400" },
  { key: "financing_yuan_per_ton", label: "资金", color: "bg-pink-400" },
  { key: "other_yuan_per_ton", label: "其他", color: "bg-slate-400" },
];

function StatItem({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-ink-soft">{unit}</span>}
      </p>
    </div>
  );
}

export default function CostComparisonView({ comparison, selectedSchemeId, onSelectScheme }: Props) {
  const best = comparison.results.find((r) => r.scheme_id === comparison.recommended_scheme_id);
  const maxCost = Math.max(...comparison.results.map((r) => parseFloat(r.delivered_cost_yuan_per_ton) || 0));
  const bestCost = best ? parseFloat(best.delivered_cost_yuan_per_ton) || 0 : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* 结果标题行 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-400/15 text-xs font-bold text-violet-300">
            ✓
          </span>
          <h3 className="text-sm font-semibold">测算结果对比</h3>
          <span className="text-xs text-ink-soft">{comparison.results.length} 个方案 · 点击卡片选择落地方案</span>
        </div>
        {comparison.contains_estimates && (
          <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs text-sky-300">
            含估算项 · 建议核实后决策
          </span>
        )}
      </div>

      {/* 推荐结论 */}
      {best && (
        <div className="relative overflow-hidden rounded-2xl border border-violet-400/35 bg-panel">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/[0.14] via-violet-400/[0.04] to-transparent" aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-violet-400 to-violet-500/20" aria-hidden="true" />
          <div className="relative px-6 py-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full bg-violet-500 px-2.5 py-0.5 text-xs font-bold text-white shadow-[0_0_12px_rgba(139,92,246,0.45)]">
                AI 推荐
              </span>
              <span className="text-base font-semibold">{best.name}</span>
              {!best.eligible && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">不满足条件</span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-3">
              <div>
                <p className="text-xs text-ink-soft">到厂吨成本</p>
                <p className="mt-0.5 text-3xl font-bold tabular-nums text-violet-300">
                  {formatTonPrice(best.delivered_cost_yuan_per_ton)}
                  <span className="ml-1.5 text-sm font-normal text-ink-soft">元/吨</span>
                </p>
              </div>
              <StatItem label="总成本" value={formatYuan(best.total_cost_yuan)} unit="元" />
              <StatItem label="可用数量" value={formatTons(best.usable_quantity_tons)} unit="吨" />
              <StatItem label="采购货款" value={formatYuan(best.purchase_total_yuan)} unit="元" />
            </div>
            {comparison.explanation && (
              <p className="mt-4 border-t border-line/60 pt-3 text-xs leading-relaxed text-ink-soft">
                {comparison.explanation}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 方案对比卡 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {comparison.results.map((result) => {
          const isBest = result.scheme_id === comparison.recommended_scheme_id;
          const isSelected = result.scheme_id === selectedSchemeId;
          const cost = parseFloat(result.delivered_cost_yuan_per_ton) || 0;
          const delta = bestCost > 0 ? cost - bestCost : 0;
          return (
            <div
              key={result.scheme_id}
              onClick={() => onSelectScheme(result.scheme_id)}
              className={`cursor-pointer rounded-2xl border transition-all ${
                isSelected
                  ? "border-violet-400 bg-violet-400/[0.06] shadow-[0_0_20px_rgba(139,92,246,0.18)]"
                  : isBest
                    ? "border-violet-400/40 bg-panel/80 hover:border-violet-400/70"
                    : "border-line bg-panel/60 hover:border-line/90"
              }`}
            >
              <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg text-xs font-bold text-white ${
                    isBest
                      ? "bg-gradient-to-br from-violet-500/90 to-violet-400/40"
                      : "bg-slate-500/40"
                  }`}>
                    {result.scheme_id}
                  </span>
                  <span className="text-sm font-medium">{result.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isBest && (
                    <span className="rounded-full bg-violet-500 px-2 py-0.5 text-xs font-bold text-white">推荐</span>
                  )}
                  {!result.eligible && (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">不满足</span>
                  )}
                  {isSelected && (
                    <span className="rounded-full bg-violet-400/15 px-2 py-0.5 text-xs text-violet-300">✓ 已选</span>
                  )}
                </div>
              </div>

              <div className="px-4 pt-3.5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-ink-soft">到厂吨成本</p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums">
                      {formatTonPrice(result.delivered_cost_yuan_per_ton)}
                      <span className="ml-1 text-xs font-normal text-ink-soft">元/吨</span>
                    </p>
                  </div>
                  {!isBest && delta > 0 && (
                    <span className="rounded-full bg-red-400/10 px-2 py-0.5 text-xs tabular-nums text-red-300">
                      高出 {formatTonPrice(delta)}
                    </span>
                  )}
                  {isBest && comparison.results.length > 1 && (
                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">
                      成本最优
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-4 border-t border-line/50 pt-3 pb-3.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink-soft">总成本</span>
                    <span className="tabular-nums">{formatYuan(result.total_cost_yuan)} 元</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">采购货款</span>
                    <span className="tabular-nums">{formatYuan(result.purchase_total_yuan)} 元</span>
                  </div>
                </div>
              </div>

              {/* 成本构成条形图 */}
              {maxCost > 0 && (
                <div className="px-4 pb-4">
                  <div className="flex h-2 overflow-hidden rounded-full bg-rice-deep">
                    {BREAKDOWN_LABELS.map((bd) => {
                      const val = parseFloat(result.breakdown[bd.key]) || 0;
                      const pct = (val / maxCost) * 100;
                      return pct > 0 ? (
                        <div
                          key={bd.key}
                          className={`${bd.color} opacity-80`}
                          style={{ width: `${pct}%` }}
                          title={`${bd.label}: ${val} 元/吨`}
                        />
                      ) : null;
                    })}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                    {BREAKDOWN_LABELS.filter((bd) => parseFloat(result.breakdown[bd.key]) > 0).map((bd) => (
                      <span key={bd.key} className="flex items-center justify-between gap-1 text-xs text-ink-soft">
                        <span className="flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${bd.color}`} />
                          {bd.label}
                        </span>
                        <span className="tabular-nums">{result.breakdown[bd.key]}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.pending_items.length > 0 && (
                <div className="flex flex-wrap gap-1 border-t border-line/50 px-4 py-2.5">
                  {result.pending_items.map((p, i) => (
                    <span key={i} className="rounded-full bg-amber-400/10 px-2 py-0.5 text-xs text-amber-300">
                      ⚠ {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 差异拆解 */}
      {comparison.differences.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel/60">
          <div className="border-b border-line/70 px-5 py-3.5">
            <h4 className="text-sm font-semibold">成本差异拆解</h4>
            <p className="mt-0.5 text-xs text-ink-soft">各方案相对推荐方案 {best?.name ?? ""} 的到厂成本差距</p>
          </div>
          <div className="divide-y divide-line/50">
            {comparison.differences.map((diff) => (
              <div key={diff.scheme_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-500/40 text-xs font-bold text-white">
                  {diff.scheme_id}
                </span>
                <span className="text-xs text-ink-soft">方案 {diff.scheme_id} 相比推荐方案</span>
                <div className="ml-auto flex items-baseline gap-3">
                  <span className="text-sm font-semibold tabular-nums text-red-300">
                    +{formatTonPrice(diff.delivered_cost_delta_yuan_per_ton)} 元/吨
                  </span>
                  <span className="text-xs tabular-nums text-ink-soft">
                    整单差额 {formatYuan(diff.total_cost_delta_yuan)} 元
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 单方案提示 */}
      {comparison.results.length === 1 && (
        <p className="text-center text-xs text-ink-soft">
          当前已完成单方案成本测算，增加方案后可横向比较。
        </p>
      )}
    </div>
  );
}
