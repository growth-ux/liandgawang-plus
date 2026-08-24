import type { SchemeDraft } from "./types";

interface Props {
  schemes: SchemeDraft[];
  questions: string[];
  onChange: (schemes: SchemeDraft[]) => void;
  onCalculate: (schemes: SchemeDraft[]) => void;
  onBack: () => void;
  loading: boolean;
}

const FIELD_DEFS: { key: keyof SchemeDraft; label: string; unit: string; required: boolean }[] = [
  { key: "variety_name", label: "品种", unit: "", required: false },
  { key: "quantity_tons", label: "数量", unit: "吨", required: true },
  { key: "purchase_price_yuan_per_ton", label: "含税货价", unit: "元/吨", required: true },
  { key: "quality_discount_yuan_per_ton", label: "质量扣价", unit: "元/吨", required: false },
  { key: "freight_yuan_per_ton", label: "运费", unit: "元/吨", required: false },
  { key: "loading_yuan_per_ton", label: "装卸", unit: "元/吨", required: false },
  { key: "loss_rate_pct", label: "损耗率", unit: "%", required: false },
  { key: "financing_cost_yuan", label: "资金成本", unit: "元", required: false },
  { key: "other_cost_yuan", label: "其他费用", unit: "元", required: false },
];

function StatusBadge({ status }: { status: "confirmed" | "pending" | "estimated" | null }) {
  if (!status) return null;
  const styles = {
    confirmed: "bg-emerald-400/15 text-emerald-300",
    pending: "bg-amber-400/15 text-amber-300",
    estimated: "bg-sky-400/15 text-sky-300",
  };
  const labels = { confirmed: "已确认", pending: "待确认", estimated: "暂按估算" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function SchemeEditor({ schemes, questions, onChange, onCalculate, onBack, loading }: Props) {
  const updateField = (schemeIdx: number, key: keyof SchemeDraft, value: string | boolean | null) => {
    const next = [...schemes];
    next[schemeIdx] = { ...next[schemeIdx], [key]: value };
    onChange(next);
  };

  // 检查必填字段是否已填充
  const canCalculate = schemes.every((s) => {
    const hasVariety = !!s.variety_name;
    const hasQuantity = !!s.quantity_tons && parseFloat(s.quantity_tons) > 0;
    const hasPrice = !!s.purchase_price_yuan_per_ton && parseFloat(s.purchase_price_yuan_per_ton) > 0;
    const hasTax = s.tax_included !== null;
    return hasVariety && hasQuantity && hasPrice && hasTax;
  }) && schemes.length > 0;

  const addScheme = () => {
    if (schemes.length >= 3) return;
    const newId = String.fromCharCode(65 + schemes.length);
    onChange([
      ...schemes,
      {
        scheme_id: newId,
        name: `方案 ${newId}`,
        variety_name: null,
        quantity_tons: null,
        purchase_price_yuan_per_ton: null,
        tax_included: null,
        quality_discount_yuan_per_ton: null,
        freight_yuan_per_ton: null,
        loading_yuan_per_ton: null,
        loss_rate_pct: null,
        financing_cost_yuan: null,
        other_cost_yuan: null,
        constraints_met: true,
        pending_items: [],
        field_meta: {},
      },
    ]);
  };

  const removeScheme = (idx: number) => {
    const next = [...schemes.slice(0, idx), ...schemes.slice(idx + 1)];
    if (next.length === 0) {
      onBack();
    } else {
      onChange(next);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 补问提示 */}
      {questions.length > 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 px-5 py-3">
          <p className="text-xs font-medium text-amber-300">需确认以下信息：</p>
          <ul className="mt-1 space-y-0.5">
            {questions.map((q, i) => (
              <li key={i} className="text-xs text-amber-300/80">· {q}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 方案卡列表 */}
      {schemes.map((scheme, idx) => (
        <div key={scheme.scheme_id} className="rounded-2xl border border-line bg-panel/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet-400/15 px-2.5 py-0.5 text-xs font-medium text-violet-300">
                {scheme.scheme_id}
              </span>
              <input
                value={scheme.name}
                onChange={(e) => updateField(idx, "name", e.target.value)}
                className="bg-transparent text-sm font-medium text-ink outline-none"
              />
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeScheme(idx); }}
              className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:border-red-400/40 hover:text-red-400"
            >
              {schemes.length <= 1 ? "清空重来" : "移除"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {FIELD_DEFS.map((fd) => {
              const val = scheme[fd.key];
              const meta = scheme.field_meta?.[fd.key as string];
              return (
                <label key={fd.key} className="block">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-[11px] text-ink-soft">
                      {fd.label}{fd.required && " *"}
                    </span>
                    <StatusBadge status={meta?.status ?? (val != null && val !== "" ? "confirmed" : null)} />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type={fd.key === "variety_name" ? "text" : "number"}
                      value={(val as string) ?? ""}
                      onChange={(e) => updateField(idx, fd.key, e.target.value || null)}
                      placeholder={fd.required ? "必填" : "可选"}
                      className="w-full rounded-lg border border-line bg-rice-deep px-3 py-1.5 text-sm text-ink outline-none focus:border-violet-400"
                    />
                    {fd.unit && <span className="flex-shrink-0 text-[10px] text-ink-soft">{fd.unit}</span>}
                  </div>
                </label>
              );
            })}

            {/* 含税选择 */}
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-soft">含税口径 *</span>
              <select
                value={scheme.tax_included === null ? "" : String(scheme.tax_included)}
                onChange={(e) =>
                  updateField(idx, "tax_included", e.target.value === "" ? null : e.target.value === "true")
                }
                className="w-full rounded-lg border border-line bg-rice-deep px-3 py-1.5 text-sm text-ink outline-none focus:border-violet-400"
              >
                <option value="">请选择</option>
                <option value="true">含税</option>
                <option value="false">不含税</option>
              </select>
            </label>
          </div>
        </div>
      ))}

      {/* 添加方案 */}
      {schemes.length < 3 && (
        <button
          onClick={addScheme}
          className="rounded-2xl border border-dashed border-line py-3 text-sm text-ink-soft hover:text-ink"
        >
          + 添加方案（最多 3 个）
        </button>
      )}

      {/* 动作区 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onCalculate(schemes)}
          disabled={!canCalculate || loading}
          className="rounded-full bg-violet-500 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {loading ? "测算中…" : "开始测算"}
        </button>
        <button
          onClick={onBack}
          className="rounded-full border border-line px-4 py-2.5 text-sm text-ink-soft hover:text-ink"
        >
          返回输入
        </button>
        {!canCalculate && (
          <span className="text-xs text-amber-300">请填写品种、数量、含税货价后开始测算</span>
        )}
      </div>
    </div>
  );
}
