import { useEffect, useRef, useState } from "react";
import type { LogisticsLine } from "./types";

export interface LogisticsFilters {
  origin?: string;
  destination?: string;
  mode?: string;
  max_price?: number;
}

const MODE_OPTIONS = [
  { code: "road", name: "公路" },
  { code: "rail", name: "铁路" },
  { code: "water", name: "水路" },
];

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-soft">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { code: string; name: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.code === value);
  const displayText = selected ? selected.name : "全部";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const allItems = [{ code: "", name: "全部" }, ...options];

  return (
    <label className="block">
      <span className="text-[11px] text-ink-soft">{label}</span>
      <div ref={ref} className="relative mt-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex w-full items-center justify-between rounded-xl border bg-rice-deep/80 px-3 py-2 text-sm transition-colors ${
            open
              ? "border-tech/50 ring-1 ring-tech/20"
              : "border-line hover:border-line/80"
          }`}
        >
          <span className={value ? "text-ink" : "text-ink-soft"}>{displayText}</span>
          <ChevronIcon />
        </button>

        {open && (
          <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-line bg-panel shadow-lg shadow-black/30">
            {allItems.map((o) => {
              const isActive = o.code === value;
              return (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => {
                    onChange(o.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors first:rounded-t-xl last:rounded-b-xl ${
                    isActive
                      ? "bg-tech/10 text-tech"
                      : "text-ink hover:bg-rice-deep"
                  }`}
                >
                  {isActive && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2 shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  <span className={isActive ? "" : "ml-[22px]"}>{o.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </label>
  );
}

export default function LogisticsFilterPanel({
  lines,
  filters,
  onChange,
  onReset,
}: {
  lines: LogisticsLine[];
  filters: LogisticsFilters;
  onChange: (f: LogisticsFilters) => void;
  onReset: () => void;
}) {
  const set = (patch: Partial<LogisticsFilters>) => onChange({ ...filters, ...patch });

  const origins = [...new Set(lines.map((l) => l.origin))].map((v) => ({ code: v, name: v }));
  const destinations = [...new Set(lines.map((l) => l.destination))].map((v) => ({
    code: v,
    name: v,
  }));

  return (
    <div className="rounded-2xl border border-line bg-panel p-4 lg:mt-3.5 xl:sticky xl:top-5">
      <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <span className="text-sm font-semibold">条件筛选</span>
        <button type="button" onClick={onReset} className="text-xs text-ink-soft hover:text-ink">
          清空
        </button>
      </div>
      <div className="space-y-3.5">
        <Select label="起点" value={filters.origin ?? ""} options={origins}
          onChange={(v) => set({ origin: v || undefined })} />
        <Select label="终点" value={filters.destination ?? ""} options={destinations}
          onChange={(v) => set({ destination: v || undefined })} />
        <Select label="运输方式" value={filters.mode ?? ""} options={MODE_OPTIONS}
          onChange={(v) => set({ mode: v || undefined })} />
        <label className="block">
          <span className="text-[11px] text-ink-soft">运价上限（元/吨）</span>
          <input
            type="number"
            value={filters.max_price ?? ""}
            onChange={(e) =>
              set({ max_price: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="不设上限"
            className="mt-1 w-full rounded-xl border border-line bg-rice-deep/80 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-tech/50 focus:ring-1 focus:ring-tech/20 hover:border-line/80"
          />
        </label>
      </div>
    </div>
  );
}
