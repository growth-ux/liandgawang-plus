import { useEffect, useMemo, useState } from "react";
import { fetchLogisticsLines } from "./api";
import type { LogisticsLine } from "./types";
import { fmtInt } from "./format";
import LogisticsSummaryBar from "./LogisticsSummaryBar";
import LogisticsFilterPanel, { type LogisticsFilters } from "./LogisticsFilterPanel";
import LineDetailDrawer from "./LineDetailDrawer";
import Pagination from "./Pagination";

const PAGE_SIZE = 10;

/** 首 tab：运力发现 —— 概览条 + 筛选 + 线路表格 + 详情 */
export default function FindLogisticsTab() {
  const [lines, setLines] = useState<LogisticsLine[]>([]);
  const [filters, setFilters] = useState<LogisticsFilters>({});
  const [detail, setDetail] = useState<LogisticsLine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetchLogisticsLines()
      .then((d) => {
        if (!cancelled) setLines(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "线路加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return lines.filter((l) => {
      if (filters.origin && l.origin !== filters.origin) return false;
      if (filters.destination && l.destination !== filters.destination) return false;
      if (filters.mode && l.mode !== filters.mode) return false;
      if (filters.max_price != null && l.price_high > filters.max_price) return false;
      return true;
    });
  }, [lines, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageLines = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== null && v !== ""
  ).length;

  return (
    <div className="flex flex-col gap-5">
      {lines.length > 0 && <LogisticsSummaryBar lines={lines} />}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <LogisticsFilterPanel
          lines={lines}
          filters={filters}
          onChange={(f) => {
            setFilters(f);
            setPage(1);
          }}
          onReset={() => {
            setFilters({});
            setPage(1);
          }}
        />

        {error ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
            <p className="text-sm text-red-400">线路加载失败：{error}</p>
            <p className="mt-2 text-xs text-ink-soft">请确认后端服务已启动、本地数据库已初始化。</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-ink-soft">
              </span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFilters({});
                    setPage(1);
                  }}
                  className="text-xs text-tech hover:text-white"
                >
                  清除筛选
                </button>
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-line bg-panel shadow-[0_16px_36px_rgba(0,0,0,0.12)]">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-rice/40 text-left text-[11px] tracking-wide text-ink-soft">
                    <th className="px-4 py-3 font-normal">起终点</th>
                    <th className="px-4 py-3 font-normal">方式</th>
                    <th className="px-4 py-3 font-normal">承运方</th>
                    <th className="px-4 py-3 font-normal">运力（吨）</th>
                    <th className="px-4 py-3 font-normal">运价（元/吨）</th>
                    <th className="px-4 py-3 font-normal">时效</th>
                    <th className="px-4 py-3 font-normal">发运窗口</th>
                    <th className="px-4 py-3 font-normal">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageLines.map((l) => (
                    <tr
                      key={`${l.origin}-${l.destination}-${l.mode}-${l.carrier}`}
                      className="border-b border-line/60 last:border-0 transition-colors hover:bg-rice-deep/45"
                    >
                      <td className="px-4 py-3.5 font-medium text-ink">
                        {l.origin} <span className="mx-1 text-ink-soft">→</span> {l.destination}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-brand-faint px-2 py-0.5 text-xs text-brand-deep">
                          {l.mode_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink">{l.carrier}</td>
                      <td className="px-4 py-3 tabular-nums text-ink">
                        {fmtInt(l.tonnage_min)}~{fmtInt(l.tonnage_max)}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-brand-deep">
                        <span className="text-base font-semibold">
                          {fmtInt(l.price_low)}~{fmtInt(l.price_high)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-ink">{l.days_low}~{l.days_high} 天</td>
                      <td className="px-4 py-3 text-xs text-ink-soft">{l.dispatch_window}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setDetail(l)}
                          className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft hover:border-tech hover:text-ink"
                        >
                          详情
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pageLines.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-xs text-ink-soft">
                        线路加载中…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={filtered.length}
              onChange={setPage}
            />
          </div>
        )}
      </div>

      {detail && <LineDetailDrawer line={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
