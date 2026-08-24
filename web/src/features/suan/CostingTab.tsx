import { useEffect, useState } from "react";
import type { CostComparison as CostComparisonType, CostingRecord, SchemeDraft, SuanHandoff } from "./types";
import QuoteInput from "./QuoteInput";
import SchemeEditor from "./SchemeEditor";
import CostComparisonView from "./CostComparisonView";
import HandoffAction from "./HandoffAction";
import AgentImportPanel from "./AgentImportPanel";
import { calculateCosts, saveCostingRecord } from "./api";
import { useNavigate } from "react-router-dom";

interface Props {
  pendingHandoff: SuanHandoff | null;
  onClearHandoff: () => void;
  currentRecord: CostingRecord | null;
  onRecordSaved: (record: CostingRecord) => void;
  onOpenProfit: (record: CostingRecord) => void;
}

type Stage = "input" | "editing" | "calculated";

const STEPS: { key: Stage; title: string; desc: string }[] = [
  { key: "input", title: "录入方案", desc: "粘贴报价或从小二导入" },
  { key: "editing", title: "参数核对", desc: "确认成本关键参数" },
  { key: "calculated", title: "测算结果", desc: "对比到厂成本与差异" },
];

function StepBar({ stage }: { stage: Stage }) {
  const currentIdx = STEPS.findIndex((s) => s.key === stage);
  return (
    <ol className="flex flex-wrap items-center gap-y-3 rounded-2xl border border-line bg-panel/50 px-5 py-3.5">
      {STEPS.map((step, i) => {
        const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "todo";
        return (
          <li key={step.key} className="flex items-center">
            {i > 0 && (
              <span
                className={`mx-4 h-px w-12 sm:w-20 ${i <= currentIdx ? "bg-violet-400/60" : "bg-line"}`}
                aria-hidden="true"
              />
            )}
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                  state === "done"
                    ? "border-violet-400/50 bg-violet-400/15 text-violet-300"
                    : state === "active"
                      ? "border-violet-400 bg-violet-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.45)]"
                      : "border-line text-ink-soft/70"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <div className="leading-tight">
                <p className={`text-xs font-semibold ${state === "active" ? "text-violet-300" : state === "done" ? "text-ink" : "text-ink-soft/70"}`}>
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft/70">{step.desc}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const AGENT_LABELS: Record<string, string> = {
  liang: "粮小二",
  yun: "运小二",
  qian: "钱小二",
};

export default function CostingTab({ pendingHandoff, onClearHandoff, currentRecord, onRecordSaved, onOpenProfit }: Props) {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("input");
  const [schemes, setSchemes] = useState<SchemeDraft[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [comparison, setComparison] = useState<CostComparisonType | null>(null);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedRecord, setSavedRecord] = useState<CostingRecord | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [handoffConfirmed, setHandoffConfirmed] = useState(false);

  // 从测算记录打开时，恢复方案与测算结果；切换到新记录时重置流程状态，避免串数据
  useEffect(() => {
    if (!currentRecord) return;
    setSourceText(currentRecord.source_text || "");
    setSchemes(currentRecord.schemes || []);
    setSelectedSchemeId(currentRecord.selected_scheme_id);
    setSavedRecord(currentRecord.status !== "pending" ? currentRecord : null);
    setQuestions([]);
    setHandoffConfirmed(true);
    if (currentRecord.status === "pending") {
      setComparison(null);
      setStage("editing");
    } else if (currentRecord.calculation) {
      setComparison(currentRecord.calculation);
      setStage("calculated");
    } else {
      setComparison(null);
      setStage("editing");
    }
  }, [currentRecord?.id]);

  // 接收交接数据
  const handleAcceptHandoff = () => {
    if (!pendingHandoff) return;
    const merged: SchemeDraft[] = pendingHandoff.schemes.map((s, i) => ({
      scheme_id: s.scheme_id || String.fromCharCode(65 + i),
      name: s.name || `来自${AGENT_LABELS[pendingHandoff.source_agent]}方案`,
      variety_name: s.variety_name ?? null,
      quantity_tons: s.quantity_tons ?? null,
      purchase_price_yuan_per_ton: s.purchase_price_yuan_per_ton ?? null,
      tax_included: s.tax_included ?? null,
      quality_discount_yuan_per_ton: s.quality_discount_yuan_per_ton ?? null,
      freight_yuan_per_ton: s.freight_yuan_per_ton ?? null,
      loading_yuan_per_ton: s.loading_yuan_per_ton ?? null,
      loss_rate_pct: s.loss_rate_pct ?? null,
      financing_cost_yuan: s.financing_cost_yuan ?? null,
      other_cost_yuan: s.other_cost_yuan ?? null,
      constraints_met: s.constraints_met ?? true,
      pending_items: s.pending_items ?? pendingHandoff.pending_items ?? [],
      field_meta: s.field_meta ?? {},
    }));
    setSchemes(merged);
    setStage("editing");
    setHandoffConfirmed(true);
    onClearHandoff();
  };

  // 从其他小二导入
  const handleImport = (imported: SchemeDraft[], pendingItems: string[]) => {
    const newSchemes = imported.map((s, i) => ({
      ...s,
      scheme_id: s.scheme_id || String.fromCharCode(65 + schemes.length + i),
    }));
    setSchemes([...schemes, ...newSchemes]);
    setQuestions([...questions, ...pendingItems]);
    setStage("editing");
  };

  // AI 提取后进入编辑
  const handleExtracted = (extracted: SchemeDraft[], qs: string[]) => {
    setSchemes(extracted);
    setQuestions(qs);
    setStage("editing");
  };

  // 开始测算
  const handleCalculate = async (finalSchemes: SchemeDraft[]) => {
    setLoading("calculate");
    setError(null);
    try {
      // 将 SchemeDraft 转为 SchemeInput（所有必填字段需已填充）
      const inputs = finalSchemes.map((s) => ({
        ...s,
        variety_name: s.variety_name || "未知",
        quantity_tons: s.quantity_tons || "0",
        purchase_price_yuan_per_ton: s.purchase_price_yuan_per_ton || "0",
        tax_included: s.tax_included ?? true,
        quality_discount_yuan_per_ton: s.quality_discount_yuan_per_ton || "0",
        freight_yuan_per_ton: s.freight_yuan_per_ton || "0",
        loading_yuan_per_ton: s.loading_yuan_per_ton || "0",
        loss_rate_pct: s.loss_rate_pct || "0",
        financing_cost_yuan: s.financing_cost_yuan || "0",
        other_cost_yuan: s.other_cost_yuan || "0",
      }));
      const result = await calculateCosts(inputs);
      setComparison(result);
      setSchemes(finalSchemes);
      setStage("calculated");
      if (result.recommended_scheme_id) {
        setSelectedSchemeId(result.recommended_scheme_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "测算失败");
    } finally {
      setLoading(null);
    }
  };

  // 保存测算记录
  const handleSave = async () => {
    setLoading("save");
    setError(null);
    try {
      const record = await saveCostingRecord({
        title: schemes[0]?.name ? `${schemes[0].name}成本测算` : "成本测算",
        source_text: sourceText,
        schemes,
        calculation: comparison,
        selected_scheme_id: selectedSchemeId,
      });
      setSavedRecord(record);
      onRecordSaved(record);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setLoading(null);
    }
  };

  // 降本交接
  const handleHandoff = (targetAgent: string, targetValue: string, reason: string) => {
    navigate(`/agent/${targetAgent}`, {
      state: {
        source_agent: "suan",
        source_record_id: savedRecord?.id ?? currentRecord?.id,
        target_value: targetValue,
        reason,
      },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 流程步骤条 */}
      <StepBar stage={stage} />

      {/* 交接提示条 */}
      {pendingHandoff && !handoffConfirmed && (
        <div className="rounded-2xl border border-violet-400/30 bg-violet-400/5 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="rounded-full bg-violet-400/15 px-2.5 py-0.5 text-xs text-violet-300">
                来自{AGENT_LABELS[pendingHandoff.source_agent]}
              </span>
              <span className="ml-2 text-sm">已带入 {pendingHandoff.schemes.length} 个方案数据</span>
              {pendingHandoff.pending_items.length > 0 && (
                <span className="ml-2 text-xs text-amber-300">
                  待补充：{pendingHandoff.pending_items.join("、")}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAcceptHandoff}
                className="rounded-full bg-violet-500 px-4 py-1.5 text-sm font-medium text-white"
              >
                确认接收
              </button>
              <button
                onClick={onClearHandoff}
                className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft"
              >
                忽略
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 输入阶段 */}
      {stage === "input" && (
        <>
          <QuoteInput
            onExtracted={handleExtracted}
            sourceText={sourceText}
            onSourceTextChange={setSourceText}
          />
          <AgentImportPanel onImport={handleImport} />
        </>
      )}

      {/* 编辑阶段 */}
      {stage === "editing" && (
        <SchemeEditor
          schemes={schemes}
          questions={questions}
          onChange={setSchemes}
          onCalculate={handleCalculate}
          onBack={() => setStage("input")}
          loading={loading === "calculate"}
        />
      )}

      {error && (
        <p className="rounded-xl bg-red-900/20 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* 结果阶段 */}
      {stage === "calculated" && comparison && (
        <div className="flex flex-col gap-5">
          <CostComparisonView
            comparison={comparison}
            selectedSchemeId={selectedSchemeId}
            onSelectScheme={setSelectedSchemeId}
          />

          {/* 动作区 */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel/60 px-5 py-4">
            {!savedRecord ? (
              <button
                onClick={handleSave}
                disabled={loading === "save"}
                className="rounded-full bg-violet-500 px-6 py-2.5 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)] disabled:opacity-40"
              >
                {loading === "save" ? "保存中…" : "保存测算"}
              </button>
            ) : (
              <span className="rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-medium text-emerald-300">
                ✓ 已保存 {savedRecord.record_code}
              </span>
            )}
            <button
              onClick={() => { setStage("editing"); setComparison(null); setSavedRecord(null); }}
              className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft hover:text-ink"
            >
              调整方案
            </button>
            {savedRecord && (
              <button
                onClick={() => onOpenProfit(savedRecord)}
                className="rounded-full bg-violet-500/80 px-5 py-2 text-sm font-medium text-white"
              >
                进入盈亏推演 →
              </button>
            )}
            {!savedRecord && (
              <span className="ml-auto text-xs text-ink-soft/70">保存后可进入盈亏推演，或交接其他小二降本</span>
            )}
          </div>

          {/* 降本交接 */}
          {comparison.differences.length > 0 && (
            <HandoffAction
              comparison={comparison}
              onHandoff={handleHandoff}
            />
          )}
        </div>
      )}
    </div>
  );
}
