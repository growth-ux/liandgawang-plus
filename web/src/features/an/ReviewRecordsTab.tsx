import { useMemo, useState } from "react";
import type { ReviewRecord, Verdict } from "./types";

const verdicts: Record<Verdict, { label: string; className: string }> = {
  proceed: { label: "建议继续接洽", className: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20" },
  verify: { label: "补充核验后继续", className: "bg-amber-400/10 text-amber-300 border-amber-400/20" },
  pause: { label: "建议暂缓", className: "bg-red-400/10 text-red-300 border-red-400/20" },
};

export default function ReviewRecordsTab({ records, onRecheck }: { records: ReviewRecord[]; onRecheck: (partnerId: string) => void }) {
  const [selectedId, setSelectedId] = useState(records[0].id);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set([records[1].id]));
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const selected = records.find((record) => record.id === selectedId) ?? records[0];
  const shared = sharedIds.has(selected.id);
  const visibleRecords = useMemo(() => records.filter((record) => (
    (typeFilter === "all" || record.typeLabel === typeFilter)
    && record.partnerName.includes(query.trim())
  )), [query, records, typeFilter]);

  const share = () => setSharedIds((ids) => new Set([...ids, selected.id]));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-2xl border border-line bg-panel/65">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-ink-soft">Risk review archive</p>
            <h2 className="mt-1 text-lg font-semibold">风控记录</h2>
          </div>
          <div className="flex gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索合作方" className="w-40 rounded-full border border-line bg-rice/50 px-3 py-1.5 text-xs outline-none placeholder:text-ink-soft/60 focus:border-emerald-400/30" />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-full border border-line bg-rice px-3 py-1.5 text-xs text-ink-soft outline-none">
              <option value="all">全部类型</option>
              <option value="粮源供应方">粮源供应方</option>
              <option value="物流服务方">物流服务方</option>
              <option value="资金服务方">资金服务方</option>
            </select>
          </div>
        </div>
        <div className="divide-y divide-line">
          {visibleRecords.map((record) => {
            const selectedRow = record.id === selected.id;
            return (
              <button key={record.id} type="button" onClick={() => setSelectedId(record.id)} className={`grid w-full gap-3 px-5 py-4 text-left transition sm:grid-cols-[minmax(0,1fr)_130px_100px] sm:items-center ${selectedRow ? "bg-emerald-400/[0.06]" : "hover:bg-rice/25"}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{record.partnerName}</span>
                    <span className="rounded bg-rice-deep px-1.5 py-0.5 text-[10px] text-ink-soft">{record.typeLabel}</span>
                    {sharedIds.has(record.id) && <span className="text-[10px] text-tech">已沉淀经验</span>}
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-soft">{record.summary}</p>
                </div>
                <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] ${verdicts[record.verdict].className}`}>{verdicts[record.verdict].label}</span>
                <div className="text-right text-[11px] text-ink-soft"><div>{record.date.slice(0, 10)}</div><div className="mt-1">{record.riskCount} 项发现</div></div>
              </button>
            );
          })}
          {visibleRecords.length === 0 && <div className="px-5 py-16 text-center text-xs text-ink-soft">没有找到符合条件的风控记录</div>}
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-emerald-400/20 bg-[linear-gradient(160deg,rgba(52,211,153,0.08),rgba(19,28,54,0.75)_45%)] p-5 lg:sticky lg:top-6">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/70">审核快照</span>
          <span className="font-mono text-[10px] text-ink-soft">{selected.id}</span>
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-7">{selected.partnerName}</h3>
        <div className="mt-2 flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] ${verdicts[selected.verdict].className}`}>{verdicts[selected.verdict].label}</span>
          <span className="text-[11px] text-ink-soft">{selected.date}</span>
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <div className="text-xs font-semibold">当时结论</div>
          <p className="mt-2 text-xs leading-6 text-ink-soft">{selected.summary}</p>
        </div>
        <div className="mt-4 rounded-xl border border-tech/15 bg-tech/[0.05] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tech">企业共享经验</span>
            <span className={`h-1.5 w-1.5 rounded-full ${shared ? "bg-tech shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "bg-slate-600"}`} />
          </div>
          <p className="mt-2 text-[11px] leading-5 text-ink-soft">{selected.experience}</p>
          <div className="mt-3 text-[10px] text-ink-soft">后续小二引用时将同时显示本次审核编号与日期。</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onRecheck(selected.partnerId)} className="rounded-xl border border-line px-3 py-2.5 text-xs text-ink-soft hover:border-emerald-400/25 hover:text-emerald-300">重新体检</button>
          <button type="button" disabled={shared} onClick={share} className="rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-medium text-slate-950 disabled:bg-emerald-400/10 disabled:text-emerald-300">
            {shared ? "已沉淀经验" : "沉淀企业经验"}
          </button>
        </div>
      </aside>
    </div>
  );
}
