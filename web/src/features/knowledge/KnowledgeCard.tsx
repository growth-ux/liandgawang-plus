import type { KnowledgeItem, KnowledgeType } from "./types";

export const TYPE_META: Record<KnowledgeType, { label: string; mark: string; tone: string }> = {
  fact: { label: "企业事实", mark: "F", tone: "border-cyan-400/25 bg-cyan-400/[0.06] text-cyan-200" },
  preference: { label: "经营偏好", mark: "P", tone: "border-violet-400/25 bg-violet-400/[0.06] text-violet-200" },
  decision: { label: "决策经验", mark: "D", tone: "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200" },
  risk: { label: "风险规则", mark: "R", tone: "border-amber-400/25 bg-amber-400/[0.06] text-amber-200" },
};

const AGENTS: Record<string, string> = {
  zhanggui: "粮掌柜",
  suan: "算小二",
  an: "安小二",
  user: "用户",
};

export function reliability(item: KnowledgeItem) {
  if (item.origin === "manual") return "用户添加";
  return item.evidence_count > 1 ? "已确认 · 多次验证" : "已确认 · 单次经验";
}

export default function KnowledgeCard({ item, onOpen }: { item: KnowledgeItem; onOpen: () => void }) {
  const meta = TYPE_META[item.knowledge_type];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full overflow-hidden rounded-2xl border border-line bg-panel/75 p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-tech/30 hover:bg-panel"
    >
      <span className="absolute right-4 top-3 font-mono text-4xl font-semibold text-white/[0.025]">{meta.mark}</span>
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-md border px-2 py-1 text-[10px] tracking-[0.16em] ${meta.tone}`}>{meta.label}</span>
        <span className={`text-[10px] ${item.status === "active" ? "text-emerald-300" : "text-slate-500"}`}>
          {item.status === "active" ? "● 使用中" : "○ 已停用"}
        </span>
      </div>
      <h3 className="mt-4 pr-7 text-base font-semibold leading-6 text-ink transition group-hover:text-tech">{item.title}</h3>
      <p className="mt-2 line-clamp-2 text-xs leading-6 text-ink-soft">{item.content}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {item.applicable_context.slice(0, 3).map((context) => (
          <span key={context} className="rounded-full bg-rice-deep px-2.5 py-1 text-[10px] text-ink-soft">{context}</span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[10px] text-ink-soft">
        <span>{AGENTS[item.source_agent] ?? item.source_agent} · {reliability(item)}</span>
        <span>被引用 {item.citation_count} 次 →</span>
      </div>
    </button>
  );
}

