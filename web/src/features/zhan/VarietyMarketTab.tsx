import { useEffect, useRef, useState } from "react";
import { fetchMarketOverview, fetchPriceSeries } from "./api";
import { VARIETIES, type PriceSeriesResponse, type SpotPrice } from "./types";
import { fmtInt, fmtPct } from "./format";
import PriceTrendChart from "./PriceTrendChart";

const REGION_GROUPS = ["产区", "港口", "销区"] as const;

function RegionSelect({
  spots,
  regionType,
  value,
  onChange,
}: {
  spots: SpotPrice[];
  regionType: string;
  value: string | null;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items = spots.filter((s) => s.region_type === regionType);
  const current = items.find((s) => s.spot_code === value);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-[160px] items-center justify-between gap-2 rounded-xl border border-line bg-rice px-3.5 py-2 text-sm text-ink transition-colors hover:border-tech"
      >
        <span className="truncate">
          {current ? current.region_name : "选择地区"}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-72 w-52 overflow-y-auto rounded-2xl border border-line bg-panel py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
          {items.map((s) => {
            const selected = s.spot_code === value;
            return (
              <button
                key={s.spot_code}
                type="button"
                onClick={() => {
                  onChange(s.spot_code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors ${
                  selected ? "bg-tech/15" : "hover:bg-rice-deep"
                }`}
              >
                <span className={selected ? "font-semibold text-tech" : "text-ink"}>
                  {s.region_name}
                </span>
                {selected && <span className="text-sm text-tech">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function pctColor(v: string): string {
  const n = Number(v);
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-ink-soft";
}

function directionTone(v: string): string {
  if (v === "偏强") return "text-emerald-400";
  if (v === "偏弱") return "text-red-400";
  return "text-amber-300";
}

export default function VarietyMarketTab({
  varietyCode,
  onVarietyChange,
}: {
  varietyCode: string;
  onVarietyChange: (code: string) => void;
}) {
  const [spots, setSpots] = useState<SpotPrice[]>([]);
  const [regionType, setRegionType] = useState<string>("产区");
  const [spotCode, setSpotCode] = useState<string | null>(null);
  const [series, setSeries] = useState<PriceSeriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 品种变化 → 拉取该品种库点列表，并默认选中第一个库点
  useEffect(() => {
    let cancelled = false;
    setSpots([]);
    setSpotCode(null);
    setSeries(null);
    setError(null);
    fetchMarketOverview(varietyCode)
      .then((d) => {
        if (cancelled) return;
        setSpots(d.spots);
        const first = d.spots[0];
        setRegionType(first?.region_type ?? "产区");
        setSpotCode(first?.spot_code ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [varietyCode]);

  // 地区类型切换 → 选中该类型下第一个库点
  useEffect(() => {
    const first = spots.find((s) => s.region_type === regionType);
    setSpotCode(first?.spot_code ?? null);
  }, [regionType, spots]);

  // 选中库点变化 → 拉取走势序列
  useEffect(() => {
    if (!spotCode) return;
    let cancelled = false;
    setSeries(null);
    fetchPriceSeries(varietyCode, spotCode)
      .then((d) => {
        if (!cancelled) setSeries(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [varietyCode, spotCode]);

  return (
    <div className="flex flex-col gap-4">
      {/* 品种切换 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-soft">品种</span>
        {VARIETIES.map((v) => (
          <button
            key={v.code}
            type="button"
            onClick={() => onVarietyChange(v.code)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              varietyCode === v.code
                ? "bg-tech font-semibold text-rice"
                : "border border-line bg-panel text-ink-soft hover:text-ink"
            }`}
          >
            {v.name}
          </button>
        ))}
        {series && (
          <span className="ml-auto text-xs text-ink-soft">
            价格日期 {series.points[series.points.length - 1]?.observed_date}
          </span>
        )}
      </div>

      {error ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <p className="text-sm text-red-400">行情加载失败：{error}</p>
          <p className="mt-2 text-xs text-ink-soft">
            请确认后端服务已启动、本地数据库已初始化。
          </p>
        </div>
      ) : !series ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-sm text-ink-soft">
          正在读取走势…
        </div>
      ) : (
        <>
          {/* 地区选择 */}
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs text-ink-soft">地区类型</span>
                <div className="flex rounded-lg border border-line bg-rice p-0.5">
                  {REGION_GROUPS.map((type) => {
                    const count = spots.filter(
                      (s) => s.region_type === type,
                    ).length;
                    return (
                      <button
                        key={type}
                        type="button"
                        disabled={count === 0}
                        onClick={() => setRegionType(type)}
                        className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                          regionType === type
                            ? "bg-tech font-semibold text-rice"
                            : "text-ink-soft hover:text-ink disabled:opacity-40"
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs text-ink-soft">地区</span>
                <RegionSelect
                  spots={spots}
                  regionType={regionType}
                  value={spotCode}
                  onChange={setSpotCode}
                />
              </div>
            </div>
          </div>

          {/* 指标条 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-2xl border border-line bg-panel p-4">
              <div className="text-xs text-ink-soft">最新价</div>
              <div className="mt-1 text-xl font-semibold text-tech">
                {fmtInt(series.summary.latest_price)}
                <span className="ml-1 text-xs font-normal text-ink-soft">元/吨</span>
              </div>
            </div>
            {(
              [
                ["日涨跌", series.summary.day_change_pct],
                ["周涨跌", series.summary.week_change_pct],
                ["月涨跌", series.summary.month_change_pct],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="rounded-2xl border border-line bg-panel p-4">
                <div className="text-xs text-ink-soft">{label}</div>
                <div className={`mt-1 text-xl font-semibold ${pctColor(v)}`}>
                  {fmtPct(v)}
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-line bg-panel p-4">
              <div className="text-xs text-ink-soft">30日区间</div>
              <div className="mt-1 text-xl font-semibold">
                {fmtInt(series.summary.range_low)}
                <span className="text-ink-soft">~</span>
                {fmtInt(series.summary.range_high)}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-panel p-4">
              <div className="text-xs text-ink-soft">趋势</div>
              <div
                className={`mt-1 text-xl font-semibold ${directionTone(
                  series.summary.direction,
                )}`}
              >
                {series.summary.direction}
              </div>
            </div>
          </div>

          {/* 走势曲线 */}
          <div className="rounded-2xl border border-line bg-panel p-5">
            <PriceTrendChart
              points={series.points}
              spot={{
                region_name: series.spot.region_name,
                quote_type: series.spot.quote_type,
                remark: series.spot.remark,
              }}
            />
          </div>

          {/* 备注 */}
          <div className="rounded-xl border border-dashed border-line bg-panel/40 px-4 py-3 text-xs leading-6 text-ink-soft">
             </div>
        </>
      )}
    </div>
  );
}
