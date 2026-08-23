export interface RequirementDraft {
  origin: string;
  destination: string;
  variety_code: string;
  quantity_tons: string;
  deadline_date: string;
}

interface RequirementConfirmCardProps {
  draft: RequirementDraft;
  nodes: string[];
  varieties: { code: string; name: string }[];
  missing: Array<"origin" | "destination" | "quantity_tons">;
  onChange: (next: RequirementDraft) => void;
  onConfirm: () => void;
  busy: boolean;
  disabled?: boolean;
}

const MISSING_KEYS = ["origin", "destination", "quantity_tons"] as const;

export default function RequirementConfirmCard({
  draft,
  nodes,
  varieties,
  missing,
  onChange,
  onConfirm,
  busy,
  disabled = false,
}: RequirementConfirmCardProps) {
  const borderOf = (key: (typeof MISSING_KEYS)[number]) =>
    missing.includes(key) ? "border-amber-400/70" : "border-line";

  const selectCls = "h-10 w-full rounded-xl border bg-rice px-3 text-sm text-ink";
  const inputCls =
    "h-10 w-full rounded-xl border bg-rice px-3 text-sm text-ink placeholder:text-ink-soft/70";

  return (
    <div className="rounded-2xl border border-line bg-panel/60 p-5">
      <h3 className="text-base font-semibold">确认运输条件</h3>
      <p className="mt-1 text-xs text-ink-soft">
        运小二已识别以下条件，请确认或补充后生成方案。
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft">发货地</span>
          <select
            value={draft.origin}
            onChange={(e) => onChange({ ...draft, origin: e.target.value })}
            className={`${selectCls} ${borderOf("origin")}`}
          >
            <option value="">请选择发货地</option>
            {nodes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft">收货地</span>
          <select
            value={draft.destination}
            onChange={(e) => onChange({ ...draft, destination: e.target.value })}
            className={`${selectCls} ${borderOf("destination")}`}
          >
            <option value="">请选择收货地</option>
            {nodes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft">品种</span>
          <select
            value={draft.variety_code}
            onChange={(e) => onChange({ ...draft, variety_code: e.target.value })}
            className={`${selectCls} border-line`}
          >
            {varieties.map((v) => (
              <option key={v.code} value={v.code}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft">数量（吨）</span>
          <input
            type="number"
            min={1}
            value={draft.quantity_tons}
            onChange={(e) => onChange({ ...draft, quantity_tons: e.target.value })}
            placeholder="数量（吨）"
            className={`${inputCls} ${borderOf("quantity_tons")}`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft">最晚到货（可选）</span>
          <input
            type="date"
            value={draft.deadline_date}
            onChange={(e) => onChange({ ...draft, deadline_date: e.target.value })}
            className={`${inputCls} border-line`}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || disabled || missing.length > 0}
        className="mt-5 h-11 w-full rounded-full bg-brand px-7 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "匹配方案中…" : "确认并生成方案"}
      </button>
    </div>
  );
}
