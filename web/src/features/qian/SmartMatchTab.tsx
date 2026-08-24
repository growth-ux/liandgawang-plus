import { useEffect, useState } from "react";
import { extractFinanceRequirement, previewFinanceMatch, saveFinanceMatch } from "./api";
import type { FinanceProduct, FinanceRequirement, MatchPreview } from "./types";

interface Props {
  prefill: Partial<FinanceRequirement> | null;
  onSaved: () => void;
  onViewProduct: (product: FinanceProduct) => void;
}

const PURPOSE_OPTIONS = [
  { value: "grain_purchase", label: "粮食采购" },
  { value: "inventory_turnover", label: "库存周转" },
  { value: "receivable_turnover", label: "应收周转" },
] as const;

const GUARANTEE_OPTIONS = [
  { value: "credit", label: "信用" },
  { value: "guarantee", label: "保证" },
  { value: "order", label: "订单" },
  { value: "warehouse_receipt", label: "仓单" },
  { value: "controlled_goods", label: "受控货权" },
  { value: "receivable", label: "应收账款" },
] as const;

const CREDENTIAL_OPTIONS = [
  { value: "purchase_contract", label: "采购合同" },
  { value: "purchase_order", label: "采购订单" },
  { value: "warehouse_receipt", label: "仓单" },
  { value: "controlled_goods", label: "货权凭证" },
  { value: "receivable_invoice", label: "应收凭证" },
  { value: "delivery_receipt", label: "交货单" },
  { value: "business_license", label: "营业执照" },
  { value: "bank_flow", label: "银行流水" },
] as const;

function formatWan(value: string): string {
  return `${(Number(value) / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}万`;
}

export default function SmartMatchTab({ prefill, onSaved, onViewProduct }: Props) {
  const [text, setText] = useState("采购200吨玉米，缺30万元，预计45天回款，没有抵押物，有采购合同");
  const [requirement, setRequirement] = useState<FinanceRequirement | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [preview, setPreview] = useState<MatchPreview | null>(null);
  const [loading, setLoading] = useState<"extract" | "preview" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [showAllRejected, setShowAllRejected] = useState(false);

  // 当 prefill 变化时填充表单
  useEffect(() => {
    if (!prefill) return;
    if (prefill.purpose && prefill.amount_yuan && prefill.duration_days) {
      setRequirement({
        purpose: prefill.purpose,
        amount_yuan: prefill.amount_yuan,
        duration_days: prefill.duration_days,
        business_years: prefill.business_years ?? null,
        guarantee_modes: prefill.guarantee_modes ?? null,
        credentials: prefill.credentials ?? null,
        source_type: prefill.source_type ?? "manual",
        source_ref: prefill.source_ref ?? null,
      });
    }
  }, [prefill]);

  const handleExtract = async () => {
    setLoading("extract");
    setError(null);
    try {
      const res = await extractFinanceRequirement(text);
      const fields = res.fields;
      setQuestion(res.question);
      if (fields.purpose && fields.amount_yuan && fields.duration_days) {
        setRequirement({
          purpose: fields.purpose as FinanceRequirement["purpose"],
          amount_yuan: String(fields.amount_yuan),
          duration_days: Number(fields.duration_days),
          business_years: fields.business_years ? String(fields.business_years) : null,
          guarantee_modes: (fields.guarantee_modes as string[]) ?? null,
          credentials: (fields.credentials as string[]) ?? null,
          source_type: "manual",
        });
      } else {
        setRequirement(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "需求分析失败");
    } finally {
      setLoading(null);
    }
  };

  const handleMatch = async () => {
    if (!requirement) return;
    setLoading("preview");
    setError(null);
    try {
      const p = await previewFinanceMatch(requirement);
      setPreview(p);
      setSavedCode(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "匹配预览失败");
    } finally {
      setLoading(null);
    }
  };

  const handleSave = async () => {
    if (!requirement) return;
    setLoading("save");
    try {
      const record = await saveFinanceMatch(requirement);
      setSavedCode(record.match_code);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setLoading(null);
    }
  };

  const canSubmit = requirement != null && Number(requirement.amount_yuan) > 0 && requirement.duration_days > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* 自然语言输入区 */}
      <div className="rounded-2xl border border-line bg-panel/70 p-5">
        <h3 className="mb-3 text-sm font-semibold">描述本次资金需求</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="例如：采购200吨玉米，缺30万元，预计45天回款…"
          className="w-full resize-none rounded-xl border border-line bg-rice-deep px-4 py-3 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus:border-brand"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleExtract}
            disabled={!text.trim() || loading === "extract"}
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {loading === "extract" ? "分析中…" : "分析需求"}
          </button>
          {question && (
            <span className="text-sm text-amber-300">💡 {question}</span>
          )}
        </div>
      </div>

      {/* 需求确认卡 */}
      {requirement && (
        <div className="rounded-2xl border border-line bg-panel/70 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">确认需求信息</h3>
            {requirement.source_type !== "manual" && (
              <span className="text-xs text-amber-300">
                来自{requirement.source_type === "liang" ? "粮小二" : "算小二"}，仍需你确认
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">资金用途 *</span>
              <select value={requirement.purpose}
                onChange={(e) => setRequirement({ ...requirement, purpose: e.target.value as FinanceRequirement["purpose"] })}
                className="w-full rounded-lg border border-line bg-rice-deep px-3 py-2 text-sm text-ink outline-none focus:border-brand">
                {PURPOSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">资金缺口（元）*</span>
              <div className="flex items-center gap-2">
                <input type="number" value={requirement.amount_yuan}
                  onChange={(e) => setRequirement({ ...requirement, amount_yuan: e.target.value })}
                  className="w-full rounded-lg border border-line bg-rice-deep px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
                {requirement.amount_yuan && (
                  <span className="flex-shrink-0 text-xs text-ink-soft">{formatWan(requirement.amount_yuan)}</span>
                )}
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">使用期限（天）*</span>
              <input type="number" value={requirement.duration_days}
                onChange={(e) => setRequirement({ ...requirement, duration_days: Number(e.target.value) })}
                className="w-full rounded-lg border border-line bg-rice-deep px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">企业经营年限</span>
              <input type="number" step="0.5" value={requirement.business_years ?? ""}
                onChange={(e) => setRequirement({ ...requirement, business_years: e.target.value || null })}
                placeholder="可选" className="w-full rounded-lg border border-line bg-rice-deep px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
            </label>
          </div>

          {/* 增信方式 */}
          <div className="mt-4">
            <span className="mb-2 block text-xs text-ink-soft">增信方式</span>
            <div className="flex flex-wrap gap-2">
              {GUARANTEE_OPTIONS.map((o) => {
                const selected = requirement.guarantee_modes?.includes(o.value) ?? false;
                return (
                  <button key={o.value} type="button"
                    onClick={() => {
                      const cur = requirement.guarantee_modes ?? [];
                      const next = selected ? cur.filter((g) => g !== o.value) : [...cur, o.value];
                      setRequirement({ ...requirement, guarantee_modes: next.length > 0 ? next : null });
                    }}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${selected ? "bg-tech/20 text-tech border border-tech/40" : "border border-line text-ink-soft hover:text-ink"}`}
                  >{o.label}</button>
                );
              })}
            </div>
          </div>

          {/* 凭证 */}
          <div className="mt-4">
            <span className="mb-2 block text-xs text-ink-soft">具备凭证</span>
            <div className="flex flex-wrap gap-2">
              {CREDENTIAL_OPTIONS.map((o) => {
                const selected = requirement.credentials?.includes(o.value) ?? false;
                return (
                  <button key={o.value} type="button"
                    onClick={() => {
                      const cur = requirement.credentials ?? [];
                      const next = selected ? cur.filter((c) => c !== o.value) : [...cur, o.value];
                      setRequirement({ ...requirement, credentials: next.length > 0 ? next : null });
                    }}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${selected ? "bg-amber-400/15 text-amber-300 border border-amber-400/30" : "border border-line text-ink-soft hover:text-ink"}`}
                  >{o.label}</button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleMatch}
              disabled={!canSubmit || loading === "preview"}
              className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {loading === "preview" ? "匹配中…" : "确认并匹配"}
            </button>
            {preview && (
              <button onClick={() => { setPreview(null); setSavedCode(null); }}
                className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft hover:text-ink">
                调整需求
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="rounded-xl bg-red-900/20 px-4 py-2 text-sm text-red-400">{error}</p>}

      {/* 匹配结果 */}
      {preview && (
        <div className="flex flex-col gap-4">
          {/* 解释摘要 */}
          {preview.explanation && (
            <div className="rounded-2xl border border-brand/30 bg-brand-faint/40 px-5 py-3 text-sm text-brand-deep">
              钱小二判断：{preview.explanation}
            </div>
          )}

          {/* 主推 */}
          {preview.primary ? (
            <div className="rounded-2xl border-2 border-brand bg-panel/80 p-5">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold text-white">主推</span>
                <h4 className="font-semibold">{preview.primary.product.name}</h4>
                <span className="text-xs text-ink-soft">{preview.primary.product.institution_name}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <span>额度覆盖 <span className="text-emerald-400">✓</span></span>
                <span>参考年化 <span className="font-medium text-emerald-400">{preview.primary.product.annual_rate_pct}%</span></span>
                <span>参考资金成本 <span className="font-medium">{preview.primary.estimated_cost_yuan}元</span></span>
              </div>
              {preview.primary.matched_reasons.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {preview.primary.matched_reasons.map((r, i) => (
                    <span key={i} className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">{r}</span>
                  ))}
                </div>
              )}
              {preview.primary.pending_conditions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {preview.primary.pending_conditions.map((c, i) => (
                    <span key={i} className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">⚠ {c}</span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button onClick={() => onViewProduct(preview.primary!.product)}
                  className="rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft hover:text-ink">
                  查看产品详情
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-panel/40 p-6 text-center">
              <p className="text-sm font-medium">当前产品池中没有完全符合本次条件的产品</p>
              <p className="mt-1 text-xs text-ink-soft">请调整金额、期限或增信方式后重新匹配；也可以查看最接近产品的差距。</p>
            </div>
          )}

          {/* 备选 */}
          {preview.backups.length > 0 && (
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold text-ink-soft">备选方案</h4>
              {preview.backups.map((b, i) => (
                <div key={i} className="rounded-2xl border border-line bg-panel/60 p-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-tech/10 px-2 py-0.5 text-[10px] text-tech">备选</span>
                    <span className="text-sm font-medium">{b.product.name}</span>
                    <span className="text-xs text-ink-soft">{b.product.institution_name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs">
                    <span>参考成本 <span className="font-medium">{b.estimated_cost_yuan}元</span></span>
                    <span>参考年化 <span className="text-emerald-400">{b.product.annual_rate_pct}%</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 排除原因 */}
          {preview.rejected.length > 0 && (
            <details className="rounded-2xl border border-line bg-panel/40 p-4">
              <summary className="cursor-pointer text-xs font-medium text-ink-soft">
                为什么其他产品不适合（{preview.rejected.length}项）
              </summary>
              <div className="mt-3 space-y-2">
                {(showAllRejected ? preview.rejected : preview.rejected.slice(0, 3)).map((r, i) => (
                  <div key={i} className="rounded-xl bg-rice-deep p-3 text-xs">
                    <span className="font-medium">{r.product.name}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.rejection_reasons.map((reason, j) => (
                        <span key={j} className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">{reason}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {preview.rejected.length > 3 && !showAllRejected && (
                  <button onClick={() => setShowAllRejected(true)}
                    className="text-xs text-tech hover:text-tech/80">
                    查看全部 {preview.rejected.length} 项
                  </button>
                )}
              </div>
            </details>
          )}

          {/* 动作区 */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel/60 p-4">
            {!savedCode ? (
              <button onClick={handleSave} disabled={loading === "save"}
                className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-40">
                {loading === "save" ? "保存中…" : "保存匹配结果"}
              </button>
            ) : (
              <span className="rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-medium text-emerald-300">
                ✓ 已保存 {savedCode}
              </span>
            )}
          </div>

          {/* 免责声明 */}
          <p className="text-center text-[11px] text-ink-soft/60">参考匹配，不代表授信或放款承诺</p>
        </div>
      )}

      {/* 底部免责 */}
      {!preview && (
        <p className="text-center text-[11px] text-ink-soft/60">参考匹配，不代表授信或放款承诺</p>
      )}
    </div>
  );
}
