// web/src/features/liang/MarketSummaryBar.tsx
import type { MarketSummary } from "./types";
import { fmtInt } from "./format";

export default function MarketSummaryBar({ summary }: { summary: MarketSummary }) {
  const cells = [
    { label: "在架粮源", value: fmtInt(summary.total_listings), unit: "笔" },
    {
      label: "挂牌总量",
      value: fmtInt(summary.total_quantity_tons),
      unit: "吨",
    },
    { label: "主要品种", value: summary.varieties.join(" · "), unit: "" },
    {
      label: "报价区间",
      value: `${fmtInt(summary.price_range.low)}~${fmtInt(summary.price_range.high)}`,
      unit: "元/吨",
    },
    { label: "覆盖产区", value: fmtInt(summary.province_count), unit: "个省区" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {cells.map((c) => (
        <div key={c.label} className="rounded-xl border border-line bg-panel px-4 py-3">
          <div className="text-[11px] text-ink-soft">{c.label}</div>
          <div className="mt-1 truncate text-base font-semibold tabular-nums text-ink">
            {c.value}
            {c.unit && (
              <span className="ml-1 text-[11px] font-normal text-ink-soft">{c.unit}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
