import { useCallback, useEffect, useState } from "react";
import { createKnowledgeItem, fetchKnowledgeItems, fetchKnowledgeOverview } from "../features/knowledge/api";
import KnowledgeCard, { TYPE_META } from "../features/knowledge/KnowledgeCard";
import KnowledgeDetailDrawer from "../features/knowledge/KnowledgeDetailDrawer";
import KnowledgeFilters from "../features/knowledge/KnowledgeFilters";
import KnowledgeOverview from "../features/knowledge/KnowledgeOverview";
import type { KnowledgeItem, KnowledgeOverviewData, KnowledgeStatus, KnowledgeType } from "../features/knowledge/types";

type View = "overview" | KnowledgeType;
const TYPES: KnowledgeType[] = ["fact", "preference", "decision", "risk"];
const EMPTY_COPY: Record<KnowledgeType, string> = {
  fact: "添加企业长期有效的业务资料后，小二会在办事时主动带入。",
  preference: "多次确认的采购取舍会在这里形成可复用偏好。",
  decision: "完成一次成本测算或综合采购决策后，AI 会在这里沉淀选择逻辑。",
  risk: "完成合作方风控复盘后，AI 会在这里沉淀风险规则。",
};

function splitValues(value: string) { return value.split(/[，,]/).map((part) => part.trim()).filter(Boolean); }

export default function Knowledge() {
  const [view, setView] = useState<View>("overview");
  const [overview, setOverview] = useState<KnowledgeOverviewData | null>(null);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [query, setQuery] = useState("");
  const [sourceAgent, setSourceAgent] = useState("");
  const [status, setStatus] = useState<KnowledgeStatus>("active");
  const [selected, setSelected] = useState<KnowledgeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadOverview = useCallback(async () => {
    try { setOverview(await fetchKnowledgeOverview()); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "知识总览加载失败"); }
  }, []);
  const loadItems = useCallback(async () => {
    if (view === "overview") return;
    setLoading(true);
    try { const result = await fetchKnowledgeItems({ knowledge_type: view, query, source_agent: sourceAgent, status }); setItems(result.items); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "知识列表加载失败"); }
    finally { setLoading(false); }
  }, [query, sourceAgent, status, view]);
  useEffect(() => { setLoading(true); loadOverview().finally(() => setLoading(false)); }, [loadOverview]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const refresh = async () => { setSelected(null); await Promise.all([loadOverview(), loadItems()]); };
  const openLatest = () => { if (overview?.latest_item) setSelected(overview.latest_item); };

  return (
    <div className="relative mx-auto w-full max-w-[1320px] px-5 py-7 lg:px-8">
      <div className="pointer-events-none absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-tech/30 to-transparent" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-tech/70"><span className="h-1.5 w-1.5 rounded-full bg-tech shadow-[0_0_8px_rgba(34,211,238,0.9)]" />Enterprise intelligence</div><h1 className="mt-2 text-2xl font-semibold">企业知识大脑</h1><p className="mt-1 text-sm text-ink-soft">从办事记录中自动学习，让每个小二共享企业经验</p></div><button type="button" onClick={() => setCreating(true)} className="rounded-full border border-tech/30 bg-tech/[0.08] px-5 py-2.5 text-xs font-medium text-tech transition hover:bg-tech/15">＋ 添加企业知识</button></header>
      <nav className="mb-5 flex flex-wrap gap-2"><button type="button" onClick={() => setView("overview")} className={`rounded-full px-4 py-2 text-xs ${view === "overview" ? "bg-tech text-slate-950" : "border border-line text-ink-soft"}`}>知识总览</button>{TYPES.map((type) => <button key={type} type="button" onClick={() => setView(type)} className={`rounded-full px-4 py-2 text-xs transition ${view === type ? "bg-white/10 text-ink ring-1 ring-white/15" : "border border-line text-ink-soft hover:text-ink"}`}>{TYPE_META[type].label}</button>)}</nav>
      {error && <div className="mb-4 flex items-center justify-between rounded-xl border border-red-400/15 bg-red-400/[0.06] px-4 py-3 text-xs text-red-300"><span>{error}</span><button type="button" onClick={() => view === "overview" ? loadOverview() : loadItems()}>重试</button></div>}
      {view === "overview" ? <KnowledgeOverview data={overview} loading={loading} onSelectType={setView} onOpenLatest={openLatest} /> : <div className="space-y-4"><div className="flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-ink-soft">Knowledge domain</p><h2 className="mt-1 text-lg font-semibold">{TYPE_META[view].label}</h2></div><span className="font-mono text-xs text-ink-soft">{items.length} 条</span></div><KnowledgeFilters query={query} sourceAgent={sourceAgent} status={status} onQueryChange={setQuery} onSourceChange={setSourceAgent} onStatusChange={setStatus} />{loading ? <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((key) => <div key={key} className="h-56 animate-pulse rounded-2xl border border-line bg-white/[0.025]" />)}</div> : items.length ? <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{items.map((item) => <KnowledgeCard key={item.id} item={item} onOpen={() => setSelected(item)} />)}</div> : <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-panel/40 text-center"><span className="font-mono text-3xl text-tech">{TYPE_META[view].mark}</span><h3 className="mt-4 text-sm font-semibold">暂时没有{TYPE_META[view].label}</h3><p className="mt-2 max-w-md text-xs leading-6 text-ink-soft">{EMPTY_COPY[view]}</p></div>}</div>}
      <KnowledgeDetailDrawer item={selected} onClose={() => setSelected(null)} onChanged={refresh} />
      {creating && <CreatePanel defaultType={view === "overview" ? "fact" : view} onClose={() => { setCreating(false); setCreateError(""); }} error={createError} onSubmit={async (body) => { try { setCreateError(""); await createKnowledgeItem(body); setCreating(false); setView(body.knowledge_type); await refresh(); } catch (reason) { setCreateError(reason instanceof Error ? reason.message : "添加失败"); } }} />}
    </div>
  );
}

function CreatePanel({ defaultType, onClose, onSubmit, error }: { defaultType: KnowledgeType; onClose: () => void; onSubmit: (body: { knowledge_type: KnowledgeType; title: string; content: string; applicable_context: string[]; tags: string[] }) => Promise<void>; error: string }) {
  const [type, setType] = useState(defaultType); const [title, setTitle] = useState(""); const [content, setContent] = useState(""); const [contexts, setContexts] = useState(""); const [tags, setTags] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => { if (!title.trim() || !content.trim()) return; setBusy(true); await onSubmit({ knowledge_type: type, title: title.trim(), content: content.trim(), applicable_context: splitValues(contexts), tags: splitValues(tags) }); setBusy(false); };
  const field = "w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-tech/40";
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={onClose}><div className="w-full max-w-xl rounded-3xl border border-line bg-rice p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-tech/70">Manual knowledge</p><h2 className="mt-1 text-lg font-semibold">添加企业知识</h2></div><button onClick={onClose} className="text-xl text-ink-soft">×</button></div><div className="mt-5 space-y-3"><select className={field} value={type} onChange={(e) => setType(e.target.value as KnowledgeType)}>{TYPES.map((value) => <option key={value} value={value}>{TYPE_META[value].label}</option>)}</select><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="知识标题" /><textarea className={field} value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="描述可复用的事实、偏好、决策逻辑或风险规则" /><input className={field} value={contexts} onChange={(e) => setContexts(e.target.value)} placeholder="适用场景，用中文逗号分隔" /><input className={field} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签，用中文逗号分隔" /></div>{error && <p className="mt-3 text-xs text-red-300">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-full border border-line px-4 py-2 text-xs text-ink-soft">取消</button><button disabled={busy || !title.trim() || !content.trim()} onClick={submit} className="rounded-full bg-tech px-5 py-2 text-xs font-medium text-slate-950 disabled:opacity-40">{busy ? "正在保存…" : "保存并启用"}</button></div></div></div>;
}
