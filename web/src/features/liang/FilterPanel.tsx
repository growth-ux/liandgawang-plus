// web/src/features/liang/FilterPanel.tsx
import type { ListingFilters } from "./types";
import TechSelect from "../../components/TechSelect";

const VARIETIES = ["玉米", "小麦", "大豆", "稻谷"];
const GRADES = ["一等", "二等", "三等"];
const PRICE_TYPES = ["出厂价", "到库价", "港口价"];

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
    <div className="rounded-2xl border border-line bg-panel p-4 lg:mt-3.5 xl:sticky xl:top-5">
      <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <div>
          <span className="text-sm font-semibold">条件筛选</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-ink-soft hover:text-ink"
        >
          清空
        </button>
      </div>
      <div className="space-y-3.5">
        <TechSelect label="品种" value={filters.variety_name ?? ""} options={[{ value: "", label: "全部" }, ...VARIETIES.map((item) => ({ value: item, label: item }))]}
          onChange={(v) => set({ variety_name: v || undefined })} />
        <TechSelect label="等级" value={filters.grade ?? ""} options={[{ value: "", label: "全部" }, ...GRADES.map((item) => ({ value: item, label: item }))]}
          onChange={(v) => set({ grade: v || undefined })} />
        <TechSelect label="价格口径" value={filters.price_type ?? ""} options={[{ value: "", label: "全部" }, ...PRICE_TYPES.map((item) => ({ value: item, label: item }))]}
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
