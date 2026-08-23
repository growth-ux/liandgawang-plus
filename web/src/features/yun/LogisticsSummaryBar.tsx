import type { LogisticsLine } from "./types";
import { fmtInt } from "./format";

const MODE_LABELS: Record<string, string> = {
  road: "公路",
  rail: "铁路",
  water: "水路",
};

export default function LogisticsSummaryBar({ lines }: { lines: LogisticsLine[] }) {
  const carriers = new Set(lines.map((l) => l.carrier));
  const nodes = new Set(lines.flatMap((l) => [l.origin, l.destination]));
  const modes = new Set(lines.map((l) => l.mode));
  const priceLow = lines.length ? Math.min(...lines.map((l) => l.price_low)) : 0;
  const priceHigh = lines.length ? Math.max(...lines.map((l) => l.price_high)) : 0;

  const cells = [
    { label: "可用线路", value: fmtInt(lines.length), unit: "条" },
    { label: "承运方", value: fmtInt(carriers.size), unit: "家" },
    { label: "覆盖节点", value: fmtInt(nodes.size), unit: "个" },
    {
      label: "运价区间",
      value: `${fmtInt(priceLow)}~${fmtInt(priceHigh)}`,
      unit: "元/吨",
    },
    {
      label: "运输方式",
      value: [...modes].map((m) => MODE_LABELS[m] ?? m).join(" · "),
      unit: "",
    },
  ];

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-panel md:grid-cols-5">
      {cells.map((c) => (
        <div
          key={c.label}
          className="border-b border-r border-line px-4 py-3.5 last:border-r-0 md:border-b-0"
        >
          <div className="text-[11px] tracking-wide text-ink-soft">{c.label}</div>
          <div className="mt-1.5 truncate text-base font-semibold tabular-nums text-ink">
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
