import { useEffect, useRef, useState } from "react";
import NumberInput from "../../components/NumberInput";
import { extractAnalysisConditions, previewAnalysis, saveAnalysis } from "./api";
import {
  VARIETIES,
  type AnalysisAction,
  type AnalysisJudgment,
  type AnalysisRequest,
} from "./types";

const GRADES = ["一等", "二等", "三等"];
const RISKS = ["稳健", "积极", "保守"];

const EXAMPLE_DESCRIBE =
  "玉米采购120吨，10天内要到货，目标东北产区，二等，预算不超过2400元/吨，库存还能撑8天，风格稳健，水分要求14%以内。";
/** 后端缺失标签中的研判必填项，用红色提醒 */
const REQUIRED_MISSING = new Set(["品种", "采购数量", "最晚采购时间", "目标地区"]);

export const ACTION_LABELS: Record<AnalysisAction, string> = {
  buy_now: "立即采购",
  split: "分批采购",
  wait: "暂缓观望",
  verify: "先核验条件",
};

export const ACTION_TONE: Record<AnalysisAction, string> = {
  buy_now: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  split: "bg-tech/15 text-tech border-tech/40",
  wait: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  verify: "bg-rice-deep text-ink-soft border-line",
};

const COMPLETENESS_LABEL = { high: "充分", medium: "中等", low: "不足" } as const;

const inputCls =
  "w-full rounded-xl border border-line bg-rice px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/50 transition-colors focus:border-tech focus:outline-none";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-ink-soft">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}

/** 暗色风格自定义下拉，替代原生 select 的白底弹层 */
function Dropdown({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-rice px-3.5 py-2.5 text-sm text-ink transition-colors hover:border-tech"
      >
        <span className="truncate">{current ? current.label : "请选择"}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value || "empty"}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors ${
                  selected
                    ? "bg-tech/15 font-semibold text-tech"
                    : "text-ink hover:bg-rice-deep"
                }`}
              >
                {o.label}
                {selected && <span>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EvidenceList({
  title,
  items,
  dot,
}: {
  title: string;
  items: string[];
  dot: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-ink-soft">{title}</div>
      <ul className="flex flex-col gap-1.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-sm leading-6 text-ink">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProcurementAnalysisTab({
  varietyCode,
  onVarietyChange,
  prefill,
  onPrefillConsumed,
}: {
  varietyCode: string;
  onVarietyChange: (code: string) => void;
  prefill?: AnalysisRequest | null;
  onPrefillConsumed?: () => void;
}) {
  const [quantity, setQuantity] = useState("120");
  const [deadline, setDeadline] = useState("");
  const [grade, setGrade] = useState("");
  const [targetRegion, setTargetRegion] = useState("");
  const [budget, setBudget] = useState("");
  const [stockDays, setStockDays] = useState("");
  const [risk, setRisk] = useState("稳健");
  const [remark, setRemark] = useState("");

  // 一句话描述 → AI 提取 → 表单确认 两段式流程；从研判记录恢复时直接进表单
  const [stage, setStage] = useState<"describe" | "form">("describe");
  const [describeText, setDescribeText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractMissing, setExtractMissing] = useState<string[] | null>(null);

  const [judgment, setJudgment] = useState<AnalysisJudgment | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 从研判记录恢复条件：预填表单并清空旧结果
  useEffect(() => {
    if (!prefill) return;
    onVarietyChange(prefill.variety_code);
    setQuantity(prefill.quantity_tons);
    setDeadline(prefill.deadline_date);
    setGrade(prefill.grade ?? "");
    setTargetRegion(prefill.target_region ?? "");
    setBudget(prefill.budget_price ?? "");
    setStockDays(prefill.stock_days !== null ? String(prefill.stock_days) : "");
    setRisk(prefill.risk_preference ?? "稳健");
    setRemark(prefill.remark ?? "");
    setStage("form");
    setExtractMissing(null);
    setJudgment(null);
    setSavedId(null);
    setError(null);
    onPrefillConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  // 一句话描述 → 提取结构化条件填入表单，由用户确认后再生成研判
  const onExtract = async () => {
    if (!describeText.trim()) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await extractAnalysisConditions(describeText);
      const f = res.fields;
      if (f.variety_code) onVarietyChange(f.variety_code);
      setQuantity(f.quantity_tons ?? "");
      setDeadline(f.deadline_date ?? "");
      setGrade(f.grade ?? "");
      setTargetRegion(f.target_region ?? "");
      setBudget(f.budget_price ?? "");
      setStockDays(f.stock_days !== null ? String(f.stock_days) : "");
      setRisk(f.risk_preference ?? "稳健");
      setRemark(f.remark ?? "");
      setExtractMissing(res.missing);
      setStage("form");
      setJudgment(null);
      setSavedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提取失败");
    } finally {
      setExtracting(false);
    }
  };

  const buildRequest = (): AnalysisRequest | null => {
    if (!quantity || Number(quantity) <= 0) {
      setError("请填写大于 0 的采购数量");
      return null;
    }
    if (!deadline) {
      setError("请选择最晚采购/使用时间");
      return null;
    }
    if (!targetRegion.trim()) {
      setError("请填写目标地区，如 东北 / 锦州");
      return null;
    }
    setError(null);
    return {
      variety_code: varietyCode,
      quantity_tons: quantity,
      deadline_date: deadline,
      grade: grade || null,
      target_region: targetRegion.trim(),
      budget_price: budget ? budget : null,
      stock_days: stockDays ? Number(stockDays) : null,
      risk_preference: risk || null,
      remark: remark.trim() || null,
    };
  };

  const onPreview = async () => {
    const req = buildRequest();
    if (!req) return;
    setLoading(true);
    setError(null);
    try {
      const j = await previewAnalysis(req);
      setJudgment(j);
      setSavedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "研判失败");
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    const req = buildRequest();
    if (!req) return;
    setSaving(true);
    setError(null);
    try {
      const r = await saveAnalysis(req);
      setSavedId(r.record_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 第一步：一句话描述采购需求 */}
      {stage === "describe" && (
        <div className="rounded-2xl border border-line bg-panel p-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm font-semibold">一句话描述采购需求</span>
            <span className="text-xs text-ink-soft">
              瞻小二自动拆解为研判条件，确认后生成采购研判
            </span>
          </div>
          <textarea
            rows={3}
            value={describeText}
            onChange={(e) => setDescribeText(e.target.value)}
            placeholder={EXAMPLE_DESCRIBE}
            className="w-full resize-none rounded-xl border border-line bg-rice px-4 py-3 text-sm leading-6 text-ink placeholder:text-ink-soft/40 focus:border-tech focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onExtract}
              disabled={!describeText.trim() || extracting}
              className="rounded-xl bg-tech px-6 py-2 text-sm font-semibold text-rice transition-colors hover:bg-tech/85 disabled:opacity-50"
            >
              {extracting ? "瞻小二正在研判…" : "AI 采购研判"}
            </button>
            <button
              type="button"
              onClick={() => { setStage("form"); setExtractMissing(null); setError(null); }}
              className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              手动填写条件
            </button>
            {!describeText.trim() && (
              <button
                type="button"
                onClick={() => setDescribeText(EXAMPLE_DESCRIBE)}
                className="ml-auto text-xs text-tech/80 underline-offset-4 transition-colors hover:text-tech hover:underline"
              >
                填入示例描述 →
              </button>
            )}
          </div>
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>
      )}

      {/* 第二步：采购条件确认表单 */}
      {stage === "form" && (
      <div className="rounded-2xl border border-line bg-panel p-5">
        {/* 提取结果提示：哪些条件已带入、哪些需要补全 */}
        {extractMissing !== null && (
          <div className="mb-4 rounded-xl border border-tech/30 bg-tech/5 px-4 py-3">
            <p className="text-xs font-medium text-tech">
              已根据你的描述提取以下条件，请确认或补全后再生成研判
            </p>
            {extractMissing.length > 0 && (
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                待补全：
                {extractMissing.map((m) => (
                  <span
                    key={m}
                    className={`rounded-full px-2 py-0.5 ${
                      REQUIRED_MISSING.has(m)
                        ? "bg-red-400/10 text-red-300"
                        : "bg-rice-deep text-ink-soft"
                    }`}
                  >
                    {m}{REQUIRED_MISSING.has(m) ? " *" : ""}
                  </span>
                ))}
              </p>
            )}
          </div>
        )}

        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-semibold">采购条件</span>
          <span className="text-xs text-ink-soft">
            带 <span className="text-red-400">*</span> 为必填，其余条件越全研判越准
          </span>
          <button
            type="button"
            onClick={() => { setStage("describe"); setExtractMissing(null); setError(null); }}
            className="ml-auto text-xs text-ink-soft transition-colors hover:text-tech"
          >
            ← 换用一句话描述
          </button>
        </div>

        {/* 基础条件（必填） */}
        <div className="mb-3 flex items-center gap-2">
          <span className="h-3 w-1 rounded-full bg-tech" />
          <span className="text-xs font-semibold">基础条件</span>
          <span className="text-xs text-ink-soft">决定研判框架，均为必填</span>
        </div>

        {/* 品种：分段选择器 */}
        <div className="mb-3">
          <span className="mb-1.5 block text-xs text-ink-soft">
            品种<span className="ml-0.5 text-red-400">*</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {VARIETIES.map((v) => (
              <button
                key={v.code}
                type="button"
                onClick={() => onVarietyChange(v.code)}
                className={`rounded-xl border px-6 py-2 text-sm transition-all ${
                  varietyCode === v.code
                    ? "border-tech/60 bg-tech/15 font-semibold text-tech shadow-[0_0_14px_rgba(34,211,238,0.2)]"
                    : "border-line bg-rice text-ink-soft hover:border-tech/30 hover:text-ink"
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
          <Field label="采购数量（吨）" required>
            <NumberInput
              min={1}
              value={quantity}
              onChange={setQuantity}
              placeholder="如 120"
            />
          </Field>
          <Field label="最晚采购时间" required>
            <input
              type="date"
              className={inputCls}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>
          <Field label="目标地区" required>
            <input
              className={inputCls}
              value={targetRegion}
              onChange={(e) => setTargetRegion(e.target.value)}
              placeholder="如 东北 / 锦州"
            />
          </Field>
          <Field label="等级">
            <Dropdown
              value={grade}
              onChange={setGrade}
              options={[
                { value: "", label: "不限" },
                ...GRADES.map((g) => ({ value: g, label: g })),
              ]}
            />
          </Field>
        </div>

        {/* 约束与偏好（选填） */}
        <div className="mb-3 mt-6 flex items-center gap-2">
          <span className="h-3 w-1 rounded-full bg-tech/40" />
          <span className="text-xs font-semibold">约束与偏好</span>
          <span className="text-xs text-ink-soft">选填，条件越全研判越准</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-3">
          <Field label="目标预算（元/吨）">
            <NumberInput
              min={1}
              value={budget}
              onChange={setBudget}
              placeholder="选填"
            />
          </Field>
          <Field label="库存可用天数（天）">
            <NumberInput
              min={0}
              value={stockDays}
              onChange={setStockDays}
              placeholder="选填"
            />
          </Field>
          <Field label="风险偏好">
            <Dropdown
              value={risk}
              onChange={setRisk}
              options={RISKS.map((r) => ({ value: r, label: r }))}
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="其他说明">
            <input
              className={inputCls}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="如水分要求、到货方式等（选填）"
            />
          </Field>
        </div>

        {/* 底部操作栏 */}
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
          {extractMissing !== null &&
            extractMissing.filter((m) => REQUIRED_MISSING.has(m)).length > 0 && (
              <span className="text-xs text-amber-300">
                必填待补全：{extractMissing.filter((m) => REQUIRED_MISSING.has(m)).join("、")}
              </span>
            )}
          <button
            type="button"
            onClick={onPreview}
            disabled={loading}
            className="ml-auto rounded-xl bg-tech px-7 py-2.5 text-sm font-semibold text-rice shadow-[0_0_18px_rgba(34,211,238,0.3)] transition-colors hover:bg-tech/85 disabled:opacity-50"
          >
            {loading ? "瞻小二正在研判…" : "确认条件，生成研判"}
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>
      )}

      {/* 下：研判结论 */}
      <div className="rounded-2xl border border-line bg-panel p-5">
        {!judgment ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <div className="text-sm text-ink-soft">
              一句话描述采购需求，或直接填写条件，点击「AI 采购研判」
            </div>
            <p className="mt-2 max-w-lg text-xs leading-5 text-ink-soft/70">
              瞻小二将结合当前演示行情的价格走势、关键事件与你的库存、预算约束，
              由确定性规则生成采购节奏建议，并结合大模型输出综合解读。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* 结论头 */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold">研判结论</span>
              <span
                className={`rounded-full border px-3.5 py-1 text-sm font-semibold ${ACTION_TONE[judgment.action]}`}
              >
                {judgment.action_label}
              </span>
              {judgment.ratio_low !== null && judgment.ratio_high !== null && (
                <span className="text-sm text-ink">
                  建议先锁定{" "}
                  <span className="font-semibold text-tech">
                    {judgment.ratio_low}%~{judgment.ratio_high}%
                  </span>
                </span>
              )}
              <span className="ml-auto text-xs text-ink-soft">
                证据完整度：{COMPLETENESS_LABEL[judgment.evidence_completeness]}
              </span>
            </div>

            {/* 一句话结论 + 时间窗 */}
            <div className="rounded-xl border border-line bg-rice-deep/60 px-4 py-3">
              <p className="text-sm leading-6 text-ink">{judgment.summary}</p>
              {judgment.time_window && (
                <p className="mt-1.5 text-xs text-ink-soft">
                  时间窗口：{judgment.time_window}
                </p>
              )}
            </div>

            {/* 大模型综合解读 */}
            <div className="rounded-xl border border-tech/30 bg-tech/5 px-4 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-semibold text-tech">
                  瞻小二综合解读
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    judgment.ai_source === "qwen"
                      ? "bg-tech/15 text-tech"
                      : "bg-rice-deep text-ink-soft"
                  }`}
                >
                  {judgment.ai_source === "qwen"
                    ? "Qwen 大模型生成"
                    : "规则引擎生成"}
                </span>
              </div>
              {judgment.interpretation ? (
                <p className="text-sm leading-6 text-ink">
                  {judgment.interpretation}
                </p>
              ) : (
                <p className="text-xs leading-5 text-ink-soft">
                  大模型解读暂未启用（未配置 API Key），当前展示规则引擎生成的结论摘要，行动建议不受影响。
                </p>
              )}
            </div>

            {/* 证据区 */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <EvidenceList
                title="支持依据"
                items={judgment.supporting}
                dot="bg-emerald-400"
              />
              <EvidenceList
                title="反对依据与不确定因素"
                items={judgment.opposing}
                dot="bg-red-400"
              />
              <EvidenceList
                title="失效条件"
                items={judgment.invalidation}
                dot="bg-amber-400"
              />
              <EvidenceList
                title="继续观察指标"
                items={judgment.watch_metrics}
                dot="bg-tech"
              />
            </div>

            {/* 底部：操作 */}
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <div className="ml-auto flex items-center gap-2.5">
                {savedId !== null ? (
                  <span className="text-xs text-emerald-300">
                    ✓ 研判已保存（记录 #{savedId}），可在「研判记录」查看
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onPreview}
                      disabled={loading}
                      className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
                    >
                      重新研判
                    </button>
                    <button
                      type="button"
                      onClick={onSave}
                      disabled={saving || judgment.action === "verify"}
                      className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-rice transition-colors hover:bg-brand/85 disabled:opacity-50"
                    >
                      {saving ? "保存中…" : "保存研判"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
