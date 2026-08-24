import { useEffect, useState } from "react";
import { fetchMission, fetchMissions } from "./api";
import type { MissionSnapshot, MissionSummary } from "./types";
import { STATUS_LABELS } from "./types";

interface HistoryViewProps {
  onOpen(next: MissionSnapshot): void;
  onBack(): void;
}

/** 历史任务：查看状态、主推方案与待确认数量，点击恢复指挥舱。 */
export default function HistoryView({ onOpen, onBack }: HistoryViewProps) {
  const [items, setItems] = useState<MissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMissions()
      .then(setItems)
      .catch(() => setError("历史任务加载失败"))
      .finally(() => setLoading(false));
  }, []);

  function open(item: MissionSummary) {
    fetchMission(item.id).then(onOpen).catch(() => setError("任务打开失败"));
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 py-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs tracking-[0.3em] text-tech">MISSION HISTORY</p>
          <h1 className="mt-2 text-2xl font-semibold">历史任务</h1>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-line bg-panel px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          开始新任务
        </button>
      </div>

      {loading && <p className="mt-8 text-sm text-ink-soft">正在加载…</p>}
      {error && <p className="mt-8 text-sm text-red-300">{error}</p>}
      {!loading && items.length === 0 && !error && (
        <p className="mt-8 text-sm text-ink-soft">还没有任务，先创建一个采购目标吧。</p>
      )}

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => open(item)}
            className="block w-full rounded-2xl border border-line bg-panel px-5 py-4 text-left transition-colors hover:border-tech/40"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">{item.title}</span>
              <div className="flex items-center gap-2">
                {item.pending_decision_count > 0 && (
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs text-brand-deep">
                    {item.pending_decision_count} 项待确认
                  </span>
                )}
                <span className="rounded-full bg-rice-deep px-2.5 py-0.5 text-xs text-tech">
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">
              {item.mission_code}
              {item.primary_scheme_id ? ` · 主推方案 ${item.primary_scheme_id}` : ""}
              {` · 更新于 ${item.updated_at?.slice(0, 16).replace("T", " ") ?? "—"}`}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
