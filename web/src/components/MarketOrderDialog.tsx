// web/src/components/MarketOrderDialog.tsx
// 市场统一下单/申请弹窗：粮源采购、运力采购、资金申请共用。
import { useState } from "react";

export type MarketOrderType = "grain_purchase" | "transport_booking" | "finance_application";

export interface OrderFieldConfig {
  key: string;
  label: string;
  type: "number" | "text" | "date" | "textarea";
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

export interface MarketOrderResult {
  id: number;
  order_code: string;
}

interface Props {
  orderType: MarketOrderType;
  title: string;
  subtitle?: string;
  summaryRows: { label: string; value: string }[];
  fields: OrderFieldConfig[];
  defaultValues?: Record<string, string>;
  submitLabel?: string;
  onClose: () => void;
}

export default function MarketOrderDialog({
  orderType,
  title,
  subtitle,
  summaryRows,
  fields,
  defaultValues = {},
  submitLabel = "提交",
  onClose,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = defaultValues[f.key] ?? "";
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketOrderResult | null>(null);

  const missing = fields.filter((f) => f.required && !String(values[f.key] ?? "").trim());

  async function submit() {
    if (busy || missing.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/market-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_type: orderType,
          title,
          subject_ref: summaryRows[0]?.value ?? "",
          summary: summaryRows.map((r) => `${r.label}：${r.value}`).join("；"),
          payload: values,
        }),
      });
      if (!resp.ok) throw new Error(`提交失败（${resp.status}）`);
      setResult((await resp.json()) as MarketOrderResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-line bg-rice px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-tech/60";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-panel shadow-[0_30px_100px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-6 py-5">
          <p className="text-[10px] uppercase tracking-[0.24em] text-tech/80">Market order</p>
          <div className="mt-1 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="text-xl leading-none text-ink-soft hover:text-ink" aria-label="关闭">×</button>
          </div>
          {subtitle && <p className="mt-1 text-xs text-ink-soft">{subtitle}</p>}
        </div>

        {result ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 text-2xl text-emerald-300">✓</span>
            <h3 className="mt-4 text-base font-semibold">提交成功</h3>
            <p className="mt-2 text-sm text-ink-soft">
              单据编号 <span className="font-mono font-medium text-tech">{result.order_code}</span>
            </p>
            <p className="mt-1 text-xs text-ink-soft/80">已生成正式单据，对方确认后会第一时间通知你。</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-full bg-brand px-8 py-2.5 text-sm font-medium text-white hover:bg-brand/90"
            >
              完成
            </button>
          </div>
        ) : (
          <>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
              <div className="rounded-2xl border border-line bg-rice/45 p-4">
                <div className="grid gap-2.5 text-xs sm:grid-cols-2">
                  {summaryRows.map((r) => (
                    <div key={r.label}>
                      <div className="text-[10px] text-ink-soft">{r.label}</div>
                      <div className="mt-0.5 font-medium text-ink">{r.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <label key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                    <span className="mb-1 block text-xs text-ink-soft">
                      {f.label}
                      {f.required && <span className="ml-0.5 text-red-400">*</span>}
                    </span>
                    {f.type === "textarea" ? (
                      <textarea
                        value={values[f.key]}
                        onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        rows={2}
                        className={`${inputCls} resize-none`}
                      />
                    ) : (
                      <input
                        type={f.type}
                        value={values[f.key]}
                        min={f.type === "number" ? 1 : undefined}
                        onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        className={inputCls}
                      />
                    )}
                    {f.hint && <span className="mt-1 block text-[10px] text-ink-soft/70">{f.hint}</span>}
                  </label>
                ))}
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
              <button type="button" onClick={onClose} className="rounded-full border border-line px-5 py-2 text-sm text-ink-soft hover:text-ink">
                取消
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || missing.length > 0}
                className="rounded-full bg-brand px-6 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "提交中…" : submitLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
