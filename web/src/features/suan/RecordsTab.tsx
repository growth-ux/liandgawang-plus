import { useEffect, useState } from "react";
import type { CostingRecord } from "./types";
import { fetchCostingRecords, cloneCostingRecord } from "./api";
import { formatTonPrice, formatYuan } from "./format";

interface Props {
  onOpenRecord: (record: CostingRecord) => void;
  onOpenProfit: (record: CostingRecord) => void;
}

const STATUS_FILTERS = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待补充" },
  { key: "calculated", label: "已测算" },
  { key: "completed", label: "已完成" },
];

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  pending: { label: "待补充", tone: "bg-amber-400/15 text-amber-300" },
  calculated: { label: "已测算", tone: "bg-sky-400/15 text-sky-300" },
  completed: { label: "已完成", tone: "bg-emerald-400/15 text-emerald-300" },
};

export default function RecordsTab({ onOpenRecord, onOpenProfit }: Props) {
  const [records, setRecords] = useState<CostingRecord[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCostingRecords();
      setRecords(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载记录失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClone = async (id: number) => {
    try {
      const cloned = await cloneCostingRecord(id);
      onOpenRecord(cloned);
    } catch (e) {
      setError(e instanceof Error ? e.message : "复制失败");
    }
  };

  const filtered = filter === "all" ? records : records.filter((r) => r.status === filter);

  return (
    <div className="flex flex-col gap-5">
      {/* 筛选条 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
                filter === f.key
                  ? "bg-violet-500/80 text-white"
                  : "border border-line text-ink-soft hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft hover:text-ink"
        >
          {loading ? "刷新中…" : "刷新"}
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-red-900/20 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* 记录列表 */}
      {filtered.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <p className="text-sm text-ink-soft">
            {records.length === 0 ? "还没有测算记录，去「成本测算」开始第一笔测算" : "没有符合条件的记录"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((record) => {
            const statusInfo = STATUS_LABELS[record.status] || STATUS_LABELS.pending;
            const calc = record.calculation;
            const best = calc?.results?.find((r) => r.scheme_id === calc.recommended_scheme_id);

            return (
              <div key={record.id} className="rounded-2xl border border-line bg-panel/70 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusInfo.tone}`}>
                        {statusInfo.label}
                      </span>
                      <h4 className="text-sm font-medium">{record.title}</h4>
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      {record.record_code} · {record.created_at?.slice(0, 16).replace("T", " ")} · {record.schemes?.length || 0} 个方案
                    </p>
                  </div>
                </div>

                {/* 摘要 */}
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  {best && (
                    <>
                      <span>推荐：{best.name}</span>
                      <span>到厂成本 {formatTonPrice(best.delivered_cost_yuan_per_ton)} 元/吨</span>
                      <span>总成本 {formatYuan(best.total_cost_yuan)} 元</span>
                    </>
                  )}
                  {record.profit && (
                    <span>吨毛利 {formatYuan(record.profit.profit_yuan_per_ton)} 元</span>
                  )}
                </div>

                {/* 操作 */}
                <div className="mt-3 flex gap-2">
                  {record.status === "pending" && (
                    <button
                      onClick={() => onOpenRecord(record)}
                      className="rounded-full bg-violet-500/80 px-4 py-1.5 text-xs text-white"
                    >
                      继续补充
                    </button>
                  )}
                  {record.status === "calculated" && (
                    <button
                      onClick={() => onOpenRecord(record)}
                      className="rounded-full bg-violet-500/80 px-4 py-1.5 text-xs text-white"
                    >
                      选择方案
                    </button>
                  )}
                  {record.status === "completed" && record.selected_scheme_id && (
                    <button
                      onClick={() => onOpenProfit(record)}
                      className="rounded-full bg-violet-500/80 px-4 py-1.5 text-xs text-white"
                    >
                      查看盈亏
                    </button>
                  )}
                  <button
                    onClick={() => handleClone(record.id)}
                    className="rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft hover:text-ink"
                  >
                    复制为新测算
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
