// web/src/features/liang/FilterPanel.tsx
import type { ListingFilters } from "./types";

const VARIETIES = ["玉米", "小麦", "大豆", "稻谷"];
const GRADES = ["一等", "二等", "三等"];
const PRICE_TYPES = ["出厂价", "到库价", "港口价"];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-ink-soft">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-rice px-2.5 py-2 text-sm text-ink"
      >
        <option value="">全部</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function FilterPanel({
  filters,
  onChange,
  onReset,
}: {
  filters: ListingFilters;
  onChange: (f: ListingFilters) => void;
  onReset: () => void;
}) {
  const set = (patch: Partial<ListingFilters>) => onChange({ ...filters, ...patch });
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">筛选</span>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-ink-soft hover:text-ink"
        >
          清空
        </button>
      </div>
      <div className="space-y-3">
        <Select label="品种" value={filters.variety_name ?? ""} options={VARIETIES}
          onChange={(v) => set({ variety_name: v || undefined })} />
        <Select label="等级" value={filters.grade ?? ""} options={GRADES}
          onChange={(v) => set({ grade: v || undefined })} />
        <Select label="价格口径" value={filters.price_type ?? ""} options={PRICE_TYPES}
          onChange={(v) => set({ price_type: v || undefined })} />
        <label className="block">
          <span className="text-[11px] text-ink-soft">价格上限（元/吨）</span>
          <input
            type="number"
            value={filters.max_price ?? ""}
            onChange={(e) =>
              set({ max_price: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="不设上限"
            className="mt-1 w-full rounded-lg border border-line bg-rice px-2.5 py-2 text-sm text-ink"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-ink-soft">最低可用量（吨）</span>
          <input
            type="number"
            value={filters.min_quantity ?? ""}
            onChange={(e) =>
              set({ min_quantity: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="不限"
            className="mt-1 w-full rounded-lg border border-line bg-rice px-2.5 py-2 text-sm text-ink"
          />
        </label>
      </div>
    </div>
  );
}
