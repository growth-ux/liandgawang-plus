import type { SpotPrice } from "../types";
import { fmtInt, fmtSignedPct } from "../format";

/** 涨跌着色遵循国内行情习惯：红涨绿跌 */
function chgTone(n: number): string {
  return n > 0 ? "text-red-400" : n < 0 ? "text-emerald-400" : "text-ink-soft";
}

function groupStats(spots: SpotPrice[], type: SpotPrice["region_type"]) {
  const list = spots.filter((s) => s.region_type === type);
  if (!list.length) return null;
  return {
    count: list.length,
    avgPrice: list.reduce((sum, s) => sum + Number(s.price), 0) / list.length,
    avgChg: list.reduce((sum, s) => sum + Number(s.change_pct), 0) / list.length,
  };
}

function AvgCell({
  label,
  stats,
}: {
  label: string;
  stats: ReturnType<typeof groupStats>;
}) {
  if (!stats) return null;
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <div className="text-[11px] text-ink-soft">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-ink">
        {fmtInt(String(stats.avgPrice))}
        <span className="ml-1 text-[11px] font-normal text-ink-soft">元/吨</span>
      </div>
      <div className={`mt-0.5 text-[11px] tabular-nums ${chgTone(stats.avgChg)}`}>
        {fmtSignedPct(stats.avgChg)}
        <span className="ml-1.5 text-ink-soft">{stats.count} 个监测点</span>
      </div>
    </div>
  );
}

/** 行情概览统计条：监测点数、涨跌分布、产区/港口/销区均价 */
export default function MarketStatsBar({ spots }: { spots: SpotPrice[] }) {
  const up = spots.filter((s) => Number(s.change_pct) > 0).length;
  const down = spots.filter((s) => Number(s.change_pct) < 0).length;
  const flat = spots.length - up - down;
  const provinceCount = new Set(
    spots.map((s) => s.region_name.split("·")[0]),
  ).size;

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      <div className="rounded-xl border border-line bg-panel px-4 py-3">
        <div className="text-[11px] text-ink-soft">监测点</div>
        <div className="mt-1 text-xl font-semibold tabular-nums text-ink">
          {spots.length}
          <span className="ml-1 text-[11px] font-normal text-ink-soft">个</span>
        </div>
        <div className="mt-0.5 text-[11px] text-ink-soft">
          覆盖 {provinceCount} 个省区
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel px-4 py-3">
        <div className="text-[11px] text-ink-soft">涨跌分布（环比）</div>
        <div className="mt-1 text-xl font-semibold tabular-nums">
          <span className="text-red-400">{up}</span>
          <span className="mx-1 text-xs font-normal text-ink-soft">涨 /</span>
          <span className="text-emerald-400">{down}</span>
          <span className="mx-1 text-xs font-normal text-ink-soft">跌 /</span>
          <span className="text-ink-soft">{flat}</span>
          <span className="ml-1 text-xs font-normal text-ink-soft">平</span>
        </div>
        <div className="mt-0.5 text-[11px] text-ink-soft">较上一报价日</div>
      </div>

      <AvgCell label="产区均价" stats={groupStats(spots, "产区")} />
      <AvgCell label="港口均价" stats={groupStats(spots, "港口")} />
      <AvgCell label="销区均价" stats={groupStats(spots, "销区")} />
    </div>
  );
}
