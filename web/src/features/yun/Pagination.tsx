export default function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-soft">
        共 {total} 条 · 第 {page}/{totalPages} 页
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="h-8 rounded-full border border-line px-3.5 text-xs text-ink-soft hover:border-tech hover:text-ink disabled:opacity-40"
        >
          上一页
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="h-8 rounded-full border border-line px-3.5 text-xs text-ink-soft hover:border-tech hover:text-ink disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
