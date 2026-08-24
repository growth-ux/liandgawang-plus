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

export default function CostComparisonView({ comparison, selectedSchemeId, onSelectScheme }: Props) {
  const best = comparison.results.find((r) => r.scheme_id === comparison.recommended_scheme_id);
  const maxCost = Math.max(...comparison.results.map((r) => parseFloat(r.delivered_cost_yuan_per_ton) || 0));

  return (
    <div className="flex flex-col gap-5">
      {/* 推荐结论 */}
      {best && (
        <div className="rounded-2xl border border-violet-400/30 bg-violet-400/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-500 px-2.5 py-0.5 text-xs font-bold text-white">推荐</span>
            <span className="text-sm font-semibold">{best.name}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <span>到厂吨成本 <span className="text-lg font-bold text-violet-300">{formatTonPrice(best.delivered_cost_yuan_per_ton)}</span> 元/吨</span>
            <span className="text-ink-soft">总成本 {formatYuan(best.total_cost_yuan)} 元</span>
            <span className="text-ink-soft">可用数量 {formatTons(best.usable_quantity_tons)} 吨</span>
          </div>
          {comparison.contains_estimates && (
            <span className="mt-1 inline-block rounded-full bg-sky-400/10 px-2 py-0.5 text-[10px] text-sky-300">
              含估算项
            </span>
          )}
          {comparison.explanation && (
            <p className="mt-2 text-xs text-ink-soft">{comparison.explanation}</p>
          )}
        </div>
      )}

      {/* 方案对比卡 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {comparison.results.map((result) => {
          const isBest = result.scheme_id === comparison.recommended_scheme_id;
          const isSelected = result.scheme_id === selectedSchemeId;
          return (
            <div
              key={result.scheme_id}
              onClick={() => onSelectScheme(result.scheme_id)}
              className={`cursor-pointer rounded-2xl border p-4 transition-colors ${
                isSelected
                  ? "border-violet-400 bg-violet-400/5"
                  : isBest
                    ? "border-violet-400/40 bg-panel/80"
                    : "border-line bg-panel/60 hover:border-line/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {isBest && (
                    <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">推荐</span>
                  )}
                  {!result.eligible && (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-400">不满足条件</span>
                  )}
                  <span className="text-sm font-medium">{result.name}</span>
                </div>
                {isSelected && (
                  <span className="text-[10px] text-violet-300">✓ 已选</span>
                )}
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-soft">到厂吨成本</span>
                  <span className="font-semibold">{formatTonPrice(result.delivered_cost_yuan_per_ton)} 元/吨</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">总成本</span>
                  <span>{formatYuan(result.total_cost_yuan)} 元</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">采购货款</span>
                  <span>{formatYuan(result.purchase_total_yuan)} 元</span>
                </div>
              </div>

              {/* 成本构成条形图 */}
              {maxCost > 0 && (
                <div className="mt-3">
                  <div className="flex h-2.5 overflow-hidden rounded-full">
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
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {BREAKDOWN_LABELS.filter((bd) => parseFloat(result.breakdown[bd.key]) > 0).map((bd) => (
                      <span key={bd.key} className="flex items-center gap-1 text-[10px] text-ink-soft">
                        <span className={`h-1.5 w-1.5 rounded-full ${bd.color}`} />
                        {bd.label} {result.breakdown[bd.key]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.pending_items.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {result.pending_items.map((p, i) => (
                    <span key={i} className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">
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
        <div className="rounded-2xl border border-line bg-panel/60 p-5">
          <h4 className="mb-3 text-xs font-semibold text-ink-soft">成本差异拆解</h4>
          {comparison.differences.map((diff) => (
            <div key={diff.scheme_id} className="mb-2 flex items-baseline gap-2 text-sm">
              <span className="text-ink-soft">方案 {diff.scheme_id} 相比推荐方案：</span>
              <span className="font-medium text-red-400">
                高出 {formatTonPrice(diff.delivered_cost_delta_yuan_per_ton)} 元/吨
              </span>
              <span className="text-xs text-ink-soft">
                （整单差额 {formatYuan(diff.total_cost_delta_yuan)} 元）
              </span>
            </div>
          ))}
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
