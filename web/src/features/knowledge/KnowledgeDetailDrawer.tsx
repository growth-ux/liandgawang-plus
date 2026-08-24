import { useEffect, useState } from "react";
import { fetchKnowledgeCitations, updateKnowledgeItem } from "./api";
import { reliability, TYPE_META } from "./KnowledgeCard";
import type { KnowledgeCitation, KnowledgeItem } from "./types";

export default function KnowledgeDetailDrawer({ item, onClose, onChanged }: { item: KnowledgeItem | null; onClose: () => void; onChanged: () => void }) {
  const [citations, setCitations] = useState<KnowledgeCitation[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) return;
    setTitle(item.title); setContent(item.content); setEditing(false); setConfirmDisable(false); setError("");
    fetchKnowledgeCitations(item.id).then((result) => setCitations(result.items)).catch(() => setCitations([]));
  }, [item]);
  if (!item) return null;
  const meta = TYPE_META[item.knowledge_type];
  const save = async (changes: Parameters<typeof updateKnowledgeItem>[1]) => {
    setBusy(true); setError("");
    try { await updateKnowledgeItem(item.id, changes); onChanged(); setEditing(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/65 backdrop-blur-sm" onMouseDown={onClose}>
      <aside className="h-full w-full max-w-[520px] overflow-y-auto border-l border-line bg-rice p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between"><span className={`rounded-md border px-2 py-1 text-[10px] tracking-[0.16em] ${meta.tone}`}>{meta.label}</span><button type="button" onClick={onClose} className="text-xl text-ink-soft hover:text-ink">×</button></div>
        {editing ? <div className="mt-6 space-y-3"><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-tech/40" /><textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="w-full resize-none rounded-xl border border-line bg-panel px-4 py-3 text-sm leading-6 outline-none focus:border-tech/40" /><div className="flex gap-2"><button disabled={busy} onClick={() => save({ title, content })} className="rounded-full bg-tech px-5 py-2 text-xs font-medium text-slate-950">保存修改</button><button onClick={() => setEditing(false)} className="rounded-full border border-line px-4 py-2 text-xs text-ink-soft">取消</button></div></div> : <><h2 className="mt-6 text-xl font-semibold leading-8">{item.title}</h2><p className="mt-3 text-sm leading-7 text-ink-soft">{item.content}</p></>}
        <div className="mt-6 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-panel/70 p-3"><span className="text-ink-soft">可靠度</span><p className="mt-1 text-emerald-300">{reliability(item)}</p></div><div className="rounded-xl bg-panel/70 p-3"><span className="text-ink-soft">引用次数</span><p className="mt-1 text-tech">{item.citation_count} 次</p></div></div>
        <section className="mt-6"><h3 className="text-xs font-semibold">适用场景</h3><div className="mt-2 flex flex-wrap gap-2">{item.applicable_context.map((value) => <span key={value} className="rounded-full bg-rice-deep px-3 py-1.5 text-[10px] text-ink-soft">{value}</span>)}</div></section>
        <section className="mt-6 border-t border-line pt-5"><h3 className="text-xs font-semibold">来源与证据</h3><p className="mt-2 text-xs leading-6 text-ink-soft">{item.source_title || "用户添加"} · 已有 {item.evidence_count} 次办事结果支持</p></section>
        <section className="mt-6 border-t border-line pt-5"><h3 className="text-xs font-semibold">最近引用轨迹</h3>{citations.length === 0 ? <p className="mt-3 text-xs text-ink-soft">还没有小二引用这条知识。</p> : <div className="mt-3 space-y-2">{citations.map((citation) => <div key={citation.id} className="rounded-xl border border-line bg-panel/50 p-3"><div className="flex justify-between text-[10px] text-ink-soft"><span>{citation.agent_key} · 任务 #{citation.task_id}</span><span>{citation.accepted ? "已采用" : "本次未采用"}</span></div><p className="mt-2 text-xs leading-5">{citation.effect}</p></div>)}</div>}</section>
        {error && <p className="mt-4 text-xs text-red-300">{error}</p>}
        <div className="mt-8 flex gap-2 border-t border-line pt-5"><button type="button" onClick={() => setEditing(true)} className="rounded-full border border-tech/25 px-4 py-2 text-xs text-tech">编辑知识</button>{item.status === "active" ? <button type="button" disabled={busy} onClick={() => confirmDisable ? save({ status: "ignored" }) : setConfirmDisable(true)} className="rounded-full border border-red-400/20 px-4 py-2 text-xs text-red-300">{confirmDisable ? "再次点击确认停用" : "停用"}</button> : <button type="button" disabled={busy} onClick={() => save({ status: "active" })} className="rounded-full border border-emerald-400/20 px-4 py-2 text-xs text-emerald-300">恢复使用</button>}</div>
      </aside>
    </div>
  );
}

