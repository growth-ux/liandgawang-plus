import { useState } from "react";
import type { SchemeDraft } from "./types";
import { extractSchemes } from "./api";

interface Props {
  onExtracted: (schemes: SchemeDraft[], questions: string[]) => void;
  sourceText: string;
  onSourceTextChange: (text: string) => void;
}

const EXAMPLE_TEXT = "方案A：吉林玉米300吨，含税2300元/吨，质量折价12元/吨，运费160元/吨，装卸8元/吨，损耗0.5%，资金成本6000元。\n方案B：黑龙江玉米300吨，含税2275元/吨，质量折价28元/吨，运费178元/吨，装卸8元/吨，损耗0.8%，资金成本4500元。";

const SUPPORTED_FORMATS = ["自然语言报价", "微信消息摘要", "合同关键条款"];

export default function QuoteInput({ onExtracted, sourceText, onSourceTextChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!sourceText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await extractSchemes(sourceText);
      onExtracted(result.schemes as SchemeDraft[], result.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提取失败");
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    // 创建一个空方案让用户手动填写
    onExtracted(
      [
        {
          scheme_id: "A",
          name: "方案 A",
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
      ],
      []
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 主输入区 */}
      <div className="overflow-hidden rounded-2xl border border-line bg-panel/70">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 bg-violet-400/[0.04] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-violet-400/15 text-xs font-bold text-violet-300">
              AI
            </span>
            <div>
              <h3 className="text-sm font-semibold">粘贴报价，自动拆解为结构化方案</h3>
              <p className="mt-0.5 text-xs text-ink-soft">支持多条报价一次录入，AI 识别品种、数量与各项费用参数</p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 md:flex">
            {SUPPORTED_FORMATS.map((f) => (
              <span key={f} className="rounded-full border border-line/80 px-2.5 py-0.5 text-xs text-ink-soft">
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="p-5">
          <textarea
            value={sourceText}
            onChange={(e) => onSourceTextChange(e.target.value)}
            rows={6}
            placeholder={EXAMPLE_TEXT}
            className="w-full resize-none rounded-xl border border-line bg-rice-deep px-4 py-3.5 text-sm leading-relaxed text-ink placeholder:text-ink-soft/40 outline-none transition-colors focus:border-violet-400"
          />
          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleExtract}
              disabled={!sourceText.trim() || loading}
              className="rounded-full bg-violet-500 px-6 py-2.5 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)] disabled:opacity-40"
            >
              {loading ? "AI 整理中…" : "AI 整理方案"}
            </button>
            <button
              onClick={handleManualEntry}
              className="rounded-full border border-line px-4 py-2.5 text-sm text-ink-soft hover:text-ink"
            >
              手动录入
            </button>
            {!sourceText.trim() && (
              <button
                onClick={() => onSourceTextChange(EXAMPLE_TEXT)}
                className="ml-auto text-xs text-violet-300/80 underline-offset-4 hover:text-violet-300 hover:underline"
              >
                填入示例报价 →
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-900/20 px-4 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
