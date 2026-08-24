import { useState } from "react";
import type { CostingRecord, ProfitScenario, ProfitQuestionResponse } from "./types";
import { previewProfit, saveProfit, previewProfitQuestion } from "./api";
import { formatTonPrice, formatYuan, formatPct } from "./format";

interface Props {
  record: CostingRecord;
  onRecordUpdated: (record: CostingRecord) => void;
  onBackToCosting: () => void;
}

const SCENARIO_LABELS = [
  { key: "price_drop", label: "售价下跌 30 元", delta: { selling_price_delta: -30 } },
  { key: "freight_up", label: "运费上涨 15 元", delta: { freight_delta: 15 } },
  { key: "loss_up", label: "损耗增加 0.3%", delta: { loss_delta: 0.3 } },
];

export default function ProfitTab({ record, onRecordUpdated, onBackToCosting }: Props) {
  const [sellPrice, setSellPrice] = useState("");
  const [fulfillmentCost, setFulfillmentCost] = useState("0");
  const [question, setQuestion] = useState("");
  const [baseResult, setBaseResult] = useState<ProfitScenario | null>(
    record.profit as ProfitScenario | null
  );
  const [tempResult, setTempResult] = useState<ProfitScenario | null>(null);
  const [tempLabel, setTempLabel] = useState<string | null>(null);
  const [questionResult, setQuestionResult] = useState<ProfitQuestionResponse | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSelectedScheme = !!record.selected_scheme_id;

  const handlePreview = async () => {
    if (!sellPrice) return;
    setLoading("preview");
    setError(null);
    try {
      const result = await previewProfit(record.id, {
        selling_price_yuan_per_ton: sellPrice,
        sales_fulfillment_cost_yuan: fulfillmentCost || "0",
      });
      setBaseResult(result);
      setTempResult(null);
      setTempLabel(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "盈亏计算失败");
    } finally {
      setLoading(null);
    }
  };

  const handleSave = async () => {
    if (!sellPrice) return;
    setLoading("save");
    setError(null);
    try {
      const updated = await saveProfit(record.id, {
        selling_price_yuan_per_ton: sellPrice,
        sales_fulfillment_cost_yuan: fulfillmentCost || "0",
      });
      onRecordUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setLoading(null);
    }
  };

  const handleScenario = async (scenario: (typeof SCENARIO_LABELS)[number]) => {
    setLoading(scenario.key);
    setError(null);
    try {
      const currentPrice = baseResult?.selling_price_yuan_per_ton || sellPrice || "2600";
      const delta = scenario.delta;
      const req: Record<string, string | undefined> = {
        selling_price_yuan_per_ton: String(
          delta.selling_price_delta
            ? parseFloat(currentPrice) + delta.selling_price_delta
            : currentPrice
        ),
        sales_fulfillment_cost_yuan: fulfillmentCost || "0",
      };
      if (delta.freight_delta !== undefined) {
        req.freight_yuan_per_ton = undefined; // 通过 question 方式处理
      }
      const result = await previewProfit(record.id, req as any);
      setTempResult(result);
      setTempLabel(scenario.label);
    } catch (e) {
      setError(e instanceof Error ? e.message : "情景计算失败");
    } finally {
      setLoading(null);
    }
  };

  const handleQuestion = async () => {
    if (!question.trim()) return;
    setLoading("question");
    setError(null);
    try {
      const result = await previewProfitQuestion(record.id, {
        baseline_selling_price_yuan_per_ton: baseResult?.selling_price_yuan_per_ton || sellPrice || "2600",
        sales_fulfillment_cost_yuan: fulfillmentCost || "0",
        question,
      });
      setQuestionResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "问题解析失败");
    } finally {
      setLoading(null);
    }
  };

  // 无意向方案时的空状态
  if (!hasSelectedScheme) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
        <p className="text-sm text-ink-soft">请先在「成本测算」中选择意向方案</p>
        <button
          onClick={onBackToCosting}
          className="mt-4 rounded-full bg-violet-500/80 px-5 py-2 text-sm text-white"
        >
          返回成本测算
        </button>
      </div>
    );
  }

  const displayResult = tempResult || baseResult;

  return (
    <div className="flex flex-col gap-6">
      {/* 输入区 */}
      <div className="rounded-2xl border border-line bg-panel/70 p-5">
        <h3 className="mb-3 text-sm font-semibold">盈亏推演</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">预计销售价（元/吨）*</span>
            <input
              type="number"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="2600"
              className="w-full rounded-lg border border-line bg-rice-deep px-3 py-2 text-sm text-ink outline-none focus:border-violet-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">销售履约费用（元）</span>
            <input
              type="number"
              value={fulfillmentCost}
              onChange={(e) => setFulfillmentCost(e.target.value)}
              className="w-full rounded-lg border border-line bg-rice-deep px-3 py-2 text-sm text-ink outline-none focus:border-violet-400"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={!sellPrice || loading === "preview"}
            className="rounded-full bg-violet-500 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {loading === "preview" ? "计算中…" : "计算盈亏"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-900/20 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* 结果展示 */}
      {displayResult && (
        <div className="flex flex-col gap-4">
          {tempLabel && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-2 text-xs text-amber-300">
              临时情景：{tempLabel}（相对基准）
            </div>
          )}

          <div className="rounded-2xl border border-violet-400/30 bg-violet-400/5 p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <ResultCell label="吨毛利" value={formatTonPrice(displayResult.profit_yuan_per_ton)} unit="元/吨" />
              <ResultCell label="总毛利" value={formatYuan(displayResult.total_profit_yuan)} unit="元" />
              <ResultCell label="毛利率" value={formatPct(displayResult.margin_pct)} />
              <ResultCell label="盈亏平衡价" value={formatTonPrice(displayResult.break_even_price_yuan_per_ton)} unit="元/吨" />
              <ResultCell label="安全空间" value={formatTonPrice(displayResult.safety_space_yuan_per_ton)} unit="元/吨" />
            </div>
            <p className="mt-3 text-[11px] text-ink-soft/60">
              这是单笔业务测算毛利，不等同于企业会计净利润。
            </p>
          </div>

          {/* 动作区 */}
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel/60 p-4">
            {!record.profit ? (
              <button
                onClick={handleSave}
                disabled={loading === "save" || !!tempResult}
                className="rounded-full bg-violet-500 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {loading === "save" ? "保存中…" : "保存当前推演"}
              </button>
            ) : (
              <span className="rounded-full bg-emerald-400/15 px-4 py-2 text-sm text-emerald-300">
                ✓ 盈亏已保存
              </span>
            )}
            {tempResult && (
              <button
                onClick={() => { setTempResult(null); setTempLabel(null); }}
                className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft"
              >
                返回基准结果
              </button>
            )}
          </div>
        </div>
      )}

      {/* 快捷情景 */}
      {baseResult && (
        <div className="rounded-2xl border border-line bg-panel/60 p-5">
          <h4 className="mb-3 text-xs font-semibold text-ink-soft">快速情景试算</h4>
          <div className="flex flex-wrap gap-2">
            {SCENARIO_LABELS.map((s) => (
              <button
                key={s.key}
                onClick={() => handleScenario(s)}
                disabled={loading === s.key}
                className="rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft hover:border-violet-400/40 hover:text-violet-300 disabled:opacity-40"
              >
                {loading === s.key ? "…" : s.label}
              </button>
            ))}
          </div>

          {/* 一句话问题 */}
          <div className="mt-4 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="售价跌30元还能不能做？"
              className="flex-1 rounded-full border border-line bg-rice-deep px-4 py-2 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus:border-violet-400"
            />
            <button
              onClick={handleQuestion}
              disabled={!question.trim() || loading === "question"}
              className="rounded-full bg-violet-500/80 px-5 py-2 text-sm text-white disabled:opacity-40"
            >
              {loading === "question" ? "…" : "试算"}
            </button>
          </div>

          {questionResult && (
            <div className="mt-3 rounded-xl bg-rice-deep p-3">
              {Object.entries(questionResult.changes).length > 0 && (
                <p className="mb-1 text-xs text-ink-soft">
                  识别变化：{Object.entries(questionResult.changes).map(([k, v]) => `${k}=${v}`).join("，")}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span>吨毛利：{formatTonPrice(questionResult.result.profit_yuan_per_ton)} 元/吨</span>
                <span>盈亏平衡：{formatTonPrice(questionResult.result.break_even_price_yuan_per_ton)} 元/吨</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-rice-deep p-3">
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className="mt-0.5 text-base font-semibold">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-ink-soft">{unit}</span>}
      </p>
    </div>
  );
}
