import { useMemo, useState } from "react";
import type { RiskLevel, VerificationItem, VerificationStatus } from "./types";

const statusLabels: Record<VerificationStatus, string> = {
  pending: "待核验",
  clear: "无异常",
  risk: "确认有风险",
  blocked: "暂无法核验",
};

const levelClass: Record<RiskLevel, string> = {
  high: "bg-red-400/12 text-red-300 border-red-400/20",
  medium: "bg-amber-400/12 text-amber-300 border-amber-400/20",
  low: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
};

interface Props {
  items: VerificationItem[];
  onUpdate: (id: string, status: VerificationStatus, note?: string) => void;
}

export default function VerificationTab({ items, onUpdate }: Props) {
  const [filter, setFilter] = useState<"all" | VerificationStatus>("pending");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const filtered = useMemo(() => items.filter((item) => filter === "all" || item.status === filter), [items, filter]);
  const pending = items.filter((item) => item.status === "pending");
  const groups = useMemo(() => {
    const result = new Map<string, VerificationItem[]>();
    filtered.forEach((item) => result.set(item.partnerName, [...(result.get(item.partnerName) ?? []), item]));
    return [...result.entries()];
  }, [filtered]);

  const saveResult = (id: string, status: VerificationStatus) => {
    onUpdate(id, status, note.trim());
    setEditingId(null);
    setNote("");
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-line bg-panel/70 p-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-amber-300/75">Verification desk</div>
              <h2 className="mt-1 text-xl font-semibold">把风险变成可办的核验动作</h2>
              <p className="mt-1 text-xs text-ink-soft">这里只保留会改变风控结论的事项，不做复杂审批和催办流程。</p>
            </div>
            <div className="ml-auto flex gap-6">
              <Metric value={pending.length} label="待核验" tone="text-amber-300" />
              <Metric value={items.filter((item) => item.status === "clear").length} label="已排除" tone="text-emerald-300" />
              <Metric value={items.filter((item) => item.status === "risk").length} label="确认风险" tone="text-red-300" />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAiSummary(
            pending.length
              ? `安小二整理：当前有 ${pending.length} 项待核验，其中${pending.some((item) => item.level === "high") ? "费用口径属于高优先级，应先取得完整说明；其余事项可与业务沟通同步完成" : "均可在继续接洽前通过一次集中沟通完成"}。`
              : "安小二整理：当前核验事项均已有结论，可以回到来源小二继续办理。",
          )}
          className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 py-4 text-left text-sm text-emerald-300 transition hover:bg-emerald-400/10 md:w-56"
        >
          <span className="block text-[10px] uppercase tracking-[0.2em] text-emerald-300/60">AI ASSIST</span>
          <span className="mt-2 block font-medium">整理核验优先级 →</span>
        </button>
      </section>

      {aiSummary && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-xs leading-5 text-ink-soft">
          <span className="mt-0.5 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] text-emerald-300">安小二</span>
          <p className="flex-1">{aiSummary}</p>
          <button type="button" onClick={() => setAiSummary("")} className="text-ink-soft hover:text-ink" aria-label="关闭">×</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["pending", "all", "clear", "risk", "blocked"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              filter === value ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-line text-ink-soft hover:text-ink"
            }`}
          >
            {value === "all" ? "全部" : statusLabels[value]}{value === "pending" ? ` ${pending.length}` : ""}
          </button>
        ))}
      </div>

      {groups.length ? groups.map(([partnerName, group]) => (
        <section key={partnerName} className="overflow-hidden rounded-2xl border border-line bg-panel/65">
          <div className="flex items-center justify-between border-b border-line bg-rice/25 px-5 py-3">
            <div>
              <span className="text-sm font-semibold">{partnerName}</span>
              <span className="ml-2 text-[11px] text-ink-soft">{group[0].sourceAgent}交接</span>
            </div>
            <span className="text-[11px] text-ink-soft">{group.length} 项</span>
          </div>
          <div className="divide-y divide-line">
            {group.map((item) => (
              <article key={item.id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${levelClass[item.level]}`}>{item.level === "high" ? "高优先级" : "一般优先级"}</span>
                      <span className="rounded-full bg-rice-deep px-2 py-0.5 text-[10px] text-ink-soft">{statusLabels[item.status]}</span>
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-ink-soft">核验要求：{item.request}</p>
                    {item.note && <p className="mt-2 rounded-lg bg-rice/50 px-3 py-2 text-[11px] leading-5"><span className="text-ink-soft">核验记录：</span>{item.note}</p>}
                  </div>
                  {item.status === "pending" ? (
                    <button type="button" onClick={() => { setEditingId(item.id); setNote(""); }} className="shrink-0 rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-slate-950 hover:bg-emerald-400">记录核验结果</button>
                  ) : (
                    <button type="button" onClick={() => onUpdate(item.id, "pending")} className="shrink-0 rounded-full border border-line px-4 py-2 text-xs text-ink-soft hover:text-ink">重新核验</button>
                  )}
                </div>

                {editingId === item.id && (
                  <div className="mt-4 rounded-xl border border-emerald-400/20 bg-rice/45 p-4">
                    <label className="text-xs text-ink-soft" htmlFor={`note-${item.id}`}>沟通或资料核对结果</label>
                    <textarea id={`note-${item.id}`} value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="记录对方反馈、资料要点或无法核验的原因…" className="mt-2 w-full resize-none rounded-xl border border-line bg-rice px-3 py-2 text-xs outline-none placeholder:text-ink-soft/60 focus:border-emerald-400/30" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ResultButton label="已核验，无异常" onClick={() => saveResult(item.id, "clear")} tone="emerald" />
                      <ResultButton label="确认存在风险" onClick={() => saveResult(item.id, "risk")} tone="red" />
                      <ResultButton label="暂无法核验" onClick={() => saveResult(item.id, "blocked")} tone="amber" />
                      <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-ink-soft">取消</button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )) : (
        <div className="rounded-2xl border border-dashed border-line bg-panel/40 py-16 text-center">
          <div className="text-sm font-medium">当前筛选下没有核验事项</div>
          <p className="mt-1 text-xs text-ink-soft">可回到合作方体检，将重要风险加入待办。</p>
        </div>
      )}
    </div>
  );
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) {
  return <div className="text-center"><div className={`font-mono text-2xl font-semibold ${tone}`}>{value}</div><div className="text-[10px] text-ink-soft">{label}</div></div>;
}

function ResultButton({ label, tone, onClick }: { label: string; tone: "emerald" | "red" | "amber"; onClick: () => void }) {
  const classes = {
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    red: "border-red-400/25 bg-red-400/10 text-red-300",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  }[tone];
  return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs ${classes}`}>{label}</button>;
}
