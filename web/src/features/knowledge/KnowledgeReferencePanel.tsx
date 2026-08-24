import type { KnowledgeReference } from "./types";

const AGENTS: Record<string, string> = { zhanggui: "粮掌柜", suan: "算小二", an: "安小二", user: "用户" };

export default function KnowledgeReferencePanel({ references, effect, onReject, rejecting }: { references: KnowledgeReference[]; effect?: string; onReject?: () => void; rejecting?: boolean }) {
  if (references.length === 0) return null;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-tech/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.07),rgba(15,23,42,0.5))] p-5">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full border border-tech/10" />
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[0.22em] text-tech/70">Enterprise memory</p><h3 className="mt-1 text-sm font-semibold text-tech">本次主动引用 {references.length} 条企业知识</h3></div>
        {onReject && <button type="button" disabled={rejecting} onClick={onReject} className="relative rounded-full border border-line px-3 py-1.5 text-[10px] text-ink-soft hover:border-red-400/30 hover:text-red-300 disabled:opacity-50">{rejecting ? "正在重算…" : "本次不采用"}</button>}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {references.map((reference) => (
          <article key={reference.knowledge_id} className="rounded-xl border border-white/[0.06] bg-black/10 p-3.5">
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-ink">{reference.title}</span><span className="text-[9px] text-emerald-300">{reference.reliability_label}</span></div>
            <p className="mt-2 text-[11px] leading-5 text-ink-soft">为什么适用：{reference.applicable_reason}</p>
            <p className="mt-2 text-[10px] text-ink-soft/75">来源：{AGENTS[reference.source_agent] ?? reference.source_agent} · {reference.source_title}</p>
          </article>
        ))}
      </div>
      {effect && <div className="mt-3 border-t border-tech/10 pt-3 text-xs leading-5 text-tech/90"><span className="font-medium">如何影响本次建议：</span>{effect}</div>}
      {onReject && <p className="mt-2 text-[10px] text-ink-soft/60">仅对本次任务生效，不会停用企业知识。</p>}
    </section>
  );
}

