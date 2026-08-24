import { TYPE_META } from "./KnowledgeCard";
import type { KnowledgeOverviewData, KnowledgeType } from "./types";

const TYPES: KnowledgeType[] = ["fact", "preference", "decision", "risk"];
const TYPE_COPY: Record<KnowledgeType, string> = {
  fact: "稳定的企业资料与业务口径",
  preference: "反复确认后的经营取舍",
  decision: "办事结果沉淀的选择逻辑",
  risk: "合作与履约中的风险边界",
};
const AGENTS: Record<string, string> = { zhanggui: "粮掌柜", suan: "算小二", an: "安小二", yun: "运小二" };

export default function KnowledgeOverview({ data, loading, onSelectType, onOpenLatest }: { data: KnowledgeOverviewData | null; loading: boolean; onSelectType: (type: KnowledgeType) => void; onOpenLatest: () => void }) {
  const metrics = [
    ["已积累企业记忆", data?.total_items, "条"], ["本周新学习", data?.new_this_week, "条"],
    ["本月主动引用", data?.citations_this_month, "次"], ["参与协作小二", data?.active_agents, "位"],
    ["减少重复确认", data?.reduced_confirmations, "次"],
  ] as const;
  return (
    <div className="space-y-5">
      <section className="grid overflow-hidden rounded-3xl border border-line bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.10),transparent_32%),linear-gradient(135deg,rgba(16,29,52,0.96),rgba(13,20,37,0.92))] lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative p-7 lg:p-9"><div className="absolute left-0 top-8 h-16 w-0.5 bg-tech shadow-[0_0_14px_rgba(34,211,238,0.8)]" /><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-tech/70">Knowledge pulse / live</p><h2 className="mt-4 max-w-xl text-2xl font-semibold leading-9">每完成一次办事，<br /><span className="text-tech">所有小二都更懂你的企业。</span></h2><p className="mt-4 max-w-lg text-sm leading-7 text-ink-soft">从已确认的采购、测算和风控结果中提炼选择逻辑；后续小二主动引用，并明确告诉你为什么适用、影响了什么。</p></div>
        <div className="grid grid-cols-2 border-t border-line lg:border-l lg:border-t-0">{metrics.map(([label, value, unit], index) => <div key={label} className={`p-5 ${index < 3 ? "border-b border-line" : ""} ${index % 2 === 0 ? "border-r border-line" : ""}`}><p className="text-[10px] text-ink-soft">{label}</p>{loading ? <div className="mt-3 h-8 w-20 animate-pulse rounded bg-white/5" /> : <p className="mt-2 font-mono text-2xl text-ink">{value ?? 0}<span className="ml-1 text-[10px] text-ink-soft">{unit}</span></p>}</div>)}</div>
      </section>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <section className="rounded-2xl border border-line bg-panel/65 p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-ink-soft">Learning stream</p><h3 className="mt-1 text-sm font-semibold">刚刚学到</h3></div><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" /></div>{data?.latest_item ? <button type="button" onClick={onOpenLatest} className="mt-5 w-full rounded-xl border border-line bg-rice-deep/60 p-4 text-left hover:border-tech/25"><span className={`rounded border px-2 py-1 text-[9px] ${TYPE_META[data.latest_item.knowledge_type].tone}`}>{TYPE_META[data.latest_item.knowledge_type].label}</span><h4 className="mt-3 text-sm font-medium">{data.latest_item.title}</h4><p className="mt-2 line-clamp-2 text-xs leading-5 text-ink-soft">{data.latest_item.content}</p><p className="mt-3 text-[10px] text-tech">查看知识来源与证据 →</p></button> : <p className="mt-8 text-xs leading-6 text-ink-soft">完成一次成本测算、采购决策或风险复盘后，这里会出现最新学习结果。</p>}</section>
        <section className="rounded-2xl border border-line bg-panel/65 p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-ink-soft">Reuse trace</p><h3 className="mt-1 text-sm font-semibold">最近被引用</h3><div className="mt-4 space-y-3">{data?.recent_citations.length ? data.recent_citations.map((citation) => <div key={citation.id} className="border-l border-tech/25 pl-3"><p className="text-xs"><span className="text-tech">{AGENTS[citation.agent_key] ?? citation.agent_key}</span> 引用了「{citation.knowledge_title ?? `知识 #${citation.knowledge_id}`}」</p><p className="mt-1 line-clamp-1 text-[10px] text-ink-soft">{citation.effect}</p></div>) : <p className="pt-4 text-xs text-ink-soft">小二采用企业知识后，引用影响会显示在这里。</p>}</div></section>
      </div>
      <section><div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-ink-soft">Memory domains</p><h3 className="mt-1 text-sm font-semibold">四类企业知识</h3></div><span className="text-[10px] text-ink-soft">点击进入管理</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{TYPES.map((type) => { const meta = TYPE_META[type]; return <button key={type} type="button" onClick={() => onSelectType(type)} className={`group min-h-36 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${meta.tone}`}><div className="flex items-start justify-between"><span className="font-mono text-2xl font-semibold opacity-70">{meta.mark}</span><span className="font-mono text-xl">{data?.counts_by_type[type] ?? 0}</span></div><h4 className="mt-4 text-sm font-semibold">{meta.label}</h4><p className="mt-1 text-[10px] leading-5 opacity-70">{TYPE_COPY[type]}</p></button>; })}</div></section>
    </div>
  );
}

