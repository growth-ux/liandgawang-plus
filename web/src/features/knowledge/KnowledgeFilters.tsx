import type { KnowledgeStatus } from "./types";

interface Props {
  query: string;
  sourceAgent: string;
  status: KnowledgeStatus;
  onQueryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onStatusChange: (value: KnowledgeStatus) => void;
}

export default function KnowledgeFilters(props: Props) {
  const inputClass = "rounded-xl border border-line bg-panel/70 px-3.5 py-2.5 text-xs text-ink outline-none transition focus:border-tech/40";
  return (
    <div className="grid gap-2 rounded-2xl border border-line bg-rice-deep/45 p-3 md:grid-cols-[minmax(220px,1fr)_170px_140px]">
      <input className={inputClass} value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="搜索标题或知识内容" />
      <select className={inputClass} value={props.sourceAgent} onChange={(event) => props.onSourceChange(event.target.value)}>
        <option value="">全部来源</option><option value="zhanggui">粮掌柜</option><option value="suan">算小二</option><option value="an">安小二</option><option value="user">用户添加</option>
      </select>
      <select className={inputClass} value={props.status} onChange={(event) => props.onStatusChange(event.target.value as KnowledgeStatus)}>
        <option value="active">使用中</option><option value="ignored">已停用</option>
      </select>
    </div>
  );
}

