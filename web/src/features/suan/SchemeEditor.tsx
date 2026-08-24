import type { SchemeDraft } from "./types";

interface Props {
  schemes: SchemeDraft[];
  questions: string[];
  onChange: (schemes: SchemeDraft[]) => void;
  onCalculate: (schemes: SchemeDraft[]) => void;
  onBack: () => void;
  loading: boolean;
}

/** 必填关键参数 */
const PRIMARY_FIELDS: { key: keyof SchemeDraft; label: string; unit: string }[] = [
  { key: "variety_name", label: "品种", unit: "" },
  { key: "quantity_tons", label: "数量", unit: "吨" },
  { key: "purchase_price_yuan_per_ton", label: "含税货价", unit: "元/吨" },
];

/** 可选费用项 */
const OPTIONAL_FIELDS: { key: keyof SchemeDraft; label: string; unit: string }[] = [
  { key: "quality_discount_yuan_per_ton", label: "质量扣价", unit: "元/吨" },
  { key: "freight_yuan_per_ton", label: "运费", unit: "元/吨" },
  { key: "loading_yuan_per_ton", label: "装卸", unit: "元/吨" },
  { key: "loss_rate_pct", label: "损耗率", unit: "%" },
  { key: "financing_cost_yuan", label: "资金成本", unit: "元" },
  { key: "other_cost_yuan", label: "其他费用", unit: "元" },
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
    <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function FieldInput({
  label,
  unit,
  required,
  type,
  value,
  status,
  onValue,
}: {
  label: string;
  unit: string;
  required: boolean;
  type: "text" | "number";
  value: string;
  status: "confirmed" | "pending" | "estimated" | null;
  onValue: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-xs text-ink-soft">
          {label}
          {required && <span className="ml-0.5 text-violet-300">*</span>}
        </span>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type={type}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          placeholder={required ? "必填" : "选填"}
          className="w-full rounded-lg border border-line bg-rice-deep px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-soft/40 focus:border-violet-400"
        />
        {unit && <span className="flex-none text-xs text-ink-soft/70">{unit}</span>}
      </div>
    </label>
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

  const filledCount = (s: SchemeDraft) =>
    [...PRIMARY_FIELDS, ...OPTIONAL_FIELDS].filter((f) => s[f.key] != null && s[f.key] !== "").length +
    (s.tax_included !== null ? 1 : 0);

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

  const totalFields = PRIMARY_FIELDS.length + OPTIONAL_FIELDS.length + 1;

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

      {/* 核对说明 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-panel/50 px-5 py-3">
        <p className="text-xs text-ink-soft">
          核对各方案成本参数，带 <span className="text-violet-300">*</span> 为测算必填项；留空的费用项按 0 计。
        </p>
        <button
          onClick={onBack}
          className="text-xs text-ink-soft transition-colors hover:text-ink"
        >
          ← 返回重新录入
        </button>
      </div>

      {/* 方案卡列表 */}
      {schemes.map((scheme, idx) => (
        <div key={scheme.scheme_id} className="overflow-hidden rounded-2xl border border-line bg-panel/70">
          <div className="flex items-center justify-between border-b border-line/70 bg-violet-400/[0.04] px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/80 to-violet-400/30 text-sm font-bold text-white shadow-[0_0_10px_rgba(139,92,246,0.3)]">
                {scheme.scheme_id}
              </span>
              <input
                value={scheme.name}
                onChange={(e) => updateField(idx, "name", e.target.value)}
                className="w-40 bg-transparent text-sm font-semibold text-ink outline-none sm:w-56"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs tabular-nums text-ink-soft sm:inline">
                已填 {filledCount(scheme)}/{totalFields} 项
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeScheme(idx); }}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:border-red-400/40 hover:text-red-400"
              >
                {schemes.length <= 1 ? "清空重来" : "移除"}
              </button>
            </div>
          </div>

          <div className="p-5">
            {/* 关键参数 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
              {PRIMARY_FIELDS.map((fd) => (
                <FieldInput
                  key={fd.key}
                  label={fd.label}
                  unit={fd.unit}
                  required
                  type={fd.key === "variety_name" ? "text" : "number"}
                  value={(scheme[fd.key] as string) ?? ""}
                  status={scheme.field_meta?.[fd.key as string]?.status ?? (scheme[fd.key] != null && scheme[fd.key] !== "" ? "confirmed" : null)}
                  onValue={(v) => updateField(idx, fd.key, v || null)}
                />
              ))}
              {/* 含税口径 */}
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">
                  含税口径<span className="ml-0.5 text-violet-300">*</span>
                </span>
                <select
                  value={scheme.tax_included === null ? "" : String(scheme.tax_included)}
                  onChange={(e) =>
                    updateField(idx, "tax_included", e.target.value === "" ? null : e.target.value === "true")
                  }
                  className="w-full rounded-lg border border-line bg-rice-deep px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-violet-400"
                >
                  <option value="">请选择</option>
                  <option value="true">含税</option>
                  <option value="false">不含税</option>
                </select>
              </label>
            </div>

            {/* 费用明细 */}
            <div className="mt-4 border-t border-dashed border-line/70 pt-4">
              <p className="mb-2.5 text-xs font-medium text-ink-soft/80">费用明细（选填，留空按 0 计）</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
                {OPTIONAL_FIELDS.map((fd) => (
                  <FieldInput
                    key={fd.key}
                    label={fd.label}
                    unit={fd.unit}
                    required={false}
                    type="number"
                    value={(scheme[fd.key] as string) ?? ""}
                    status={scheme.field_meta?.[fd.key as string]?.status ?? (scheme[fd.key] != null && scheme[fd.key] !== "" ? "confirmed" : null)}
                    onValue={(v) => updateField(idx, fd.key, v || null)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* 添加方案 */}
      {schemes.length < 3 && (
        <button
          onClick={addScheme}
          className="rounded-2xl border border-dashed border-line py-3 text-sm text-ink-soft transition-colors hover:border-violet-400/40 hover:text-violet-300"
        >
          ＋ 添加对比方案（最多 3 个）
        </button>
      )}

      {/* 动作区 */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => onCalculate(schemes)}
          disabled={!canCalculate || loading}
          className="rounded-full bg-violet-500 px-7 py-2.5 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)] disabled:opacity-40"
        >
          {loading ? "测算中…" : "开始测算"}
        </button>
        {!canCalculate && (
          <span className="text-xs text-amber-300">请填写品种、数量、含税货价与含税口径后开始测算</span>
        )}
      </div>
    </div>
  );
}
