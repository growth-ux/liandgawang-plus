// web/src/features/liang/SourcingTab.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTask, handoffTask, runSourcingWorkflowStream } from "./api";
import DagCanvas from "./DagCanvas";
import HistoryTab from "./HistoryTab";
import { fmtDate, fmtInt, fmtQuality } from "./format";
import { initialStatus } from "./workflow";
import type { DagNodeId, NodeStatus } from "./workflow";
import type { SourcingTask, TaskNeedSummary, TaskPick, TaskPlan } from "./types";
import RiskHandoffDialog from "../an/RiskHandoffDialog";
import type { RiskHandoffDraft } from "../an/handoff";
import { createHandoff } from "../handoff/api";

const EXAMPLE_NEED = "需要120吨二等玉米，7天内可发，预算2400元/吨";
// DAG 执行顺序：节点完成事件到达后，点亮下一个节点为执行中
const NODE_ORDER: DagNodeId[] = ["parse", "load", "filter", "sort", "eliminate", "review", "pick", "verify"];

function needText(need: TaskNeedSummary | null): string {
  if (!need) return "未指定条件";
  const parts: string[] = [];
  if (need.variety) parts.push(need.variety);
  if (need.grade) parts.push(need.grade);
  if (need.crop_year != null) parts.push(`${need.crop_year} 年`);
  if (need.quantity_tons != null) parts.push(`${need.quantity_tons} 吨`);
  if (need.deadline) parts.push(`最晚可发 ${need.deadline}`);
  if (need.budget_price != null) parts.push(`预算 ≤ ${need.budget_price} 元/吨`);
  return parts.length ? parts.join(" · ") : "未指定条件";
}

function PickCard({ pick, label }: { pick: TaskPick; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-brand-deep">{label}</span>
        <span className="text-xs text-ink-soft">{pick.listing_code}</span>
      </div>
      <div className="mt-2 text-lg font-semibold text-ink">
        {pick.variety_name} · {pick.grade} · {pick.crop_year}
        <span className="ml-2 text-sm font-normal text-ink-soft">{pick.origin}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-tech">
        {fmtInt(pick.delivered_price)}
        <span className="ml-1 text-xs font-normal text-ink-soft">元/吨（到厂价）</span>
      </div>
      <div className="mt-1 text-xs text-ink-soft">
        挂牌 {fmtInt(pick.price)} 元/吨 · {pick.price_type}
        {Number(pick.quality_penalty) > 0 && ` · 质量折价 ${pick.quality_penalty} 元/吨`}
      </div>
      <div className="mt-2 text-sm text-ink">
        水分 {fmtQuality(pick.moisture_pct)}% · 容重 {fmtQuality(pick.test_weight_g_l)} g/L · 杂质{" "}
        {fmtQuality(pick.impurity_pct)}%
      </div>
      <div className="mt-3 space-y-1 text-sm text-ink">
        <div>供应方：{pick.supplier_name}</div>
        <div>可用量：{fmtInt(pick.available_quantity_tons)} 吨</div>
        <div>最晚可发：{fmtDate(pick.latest_ship_at)}</div>
      </div>
      <div className="mt-3 rounded-xl bg-rice px-4 py-2.5">
        <div className="text-xs text-ink-soft">入选理由</div>
        <div className="mt-1 text-sm text-ink">{pick.reasons.join("；")}</div>
      </div>
      {pick.risks.length > 0 && (
        <div className="mt-2 text-xs text-amber-300">风险：{pick.risks.join("；")}</div>
      )}
    </div>
  );
}

export default function SourcingTab() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Record<DagNodeId, NodeStatus>>(initialStatus);
  const [need, setNeed] = useState<TaskNeedSummary | null>(null);
  const [listingCount, setListingCount] = useState(0);
  const [parserSource, setParserSource] = useState<"llm" | "rule">("rule");
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState<SourcingTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [eliminatedOpen, setEliminatedOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [historyKey, setHistoryKey] = useState(0);
  const [riskDraft, setRiskDraft] = useState<RiskHandoffDraft | null>(null);
  async function startRun() {
    const raw = text.trim();
    if (!raw || running) return;
    setRunning(true);
    setSaved(null);
    setError(null);
    setPlan(null);
    setListingCount(0);
    setHandoffOpen(false);
    setEliminatedOpen(false);
    setDestination("");
    setStatus({ ...initialStatus(), parse: "running" });

    try {
      const result = await runSourcingWorkflowStream(raw, (event) => {
        const node = event.node as DagNodeId;
        setStatus((previous) => {
          const next: Record<DagNodeId, NodeStatus> = { ...previous, [node]: event.status };
          // 节点完成后点亮执行链上的下一个节点为执行中
          if (event.status === "done") {
            const upcoming = NODE_ORDER[NODE_ORDER.indexOf(node) + 1];
            if (upcoming && next[upcoming] === "pending") next[upcoming] = "running";
          }
          return next;
        });
      });
      setNeed(result.need);
      setListingCount(result.listing_count);
      setParserSource(result.parser_source);
      setPlan(result.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "粮源加载失败");
    } finally {
      setRunning(false);
    }
  }

  async function onSave() {
    if (!plan || !plan.primary) return;
    try {
      const t = await createTask({
        need: plan.need_summary ?? {},
        plan,
      });
      setSaved(t);
      setStatus((s) => ({ ...s, save: "done" }));
      setHistoryKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  async function onHandoff() {
    if (!saved || !destination.trim()) return;
    const origin = primary?.origin?.trim();
    const quantity = Number(need?.quantity_tons ?? 0);
    if (!origin || !quantity) {
      setError("主推粮源缺少发货地或运输吨位，暂不能交接运小二。");
      return;
    }
    try {
      const t = await handoffTask(saved.id, destination.trim());
      setSaved(t);
      setHandoffOpen(false);
      setDestination("");
      setHistoryKey((k) => k + 1);
      const summary = t.handoff?.summary;
      const handoff = await createHandoff({
        source_agent: "liang",
        target_agent: "yun",
        source_ref: t.task_code,
        title: "请安排主推粮源的运输方案",
        summary: `${summary?.origin ?? primary?.origin ?? "产地"} → ${summary?.destination ?? "目的地"}，请确认运输条件后生成方案。`,
        payload: {
          type: "transport_requirement",
          origin: summary?.origin ?? origin,
          destination: summary?.destination ?? "",
          variety_code: primary?.variety_name.includes("玉米") ? "corn" : "",
          quantity_tons: Number(summary?.quantity_tons ?? quantity),
          deadline_date: summary?.latest_ship_at ?? null,
        },
      });
      navigate(`/agent/yun?handoff=${handoff.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "交接失败");
    }
  }

  const primary = plan?.primary ?? null;
  const backup = plan?.backup ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* 输入 */}
      <div className="flex flex-col gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startRun();
          }}
          className="flex items-center gap-3"
        >
          <span className="shrink-0 text-sm font-medium text-ink">描述寻源需求</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="如：120吨二等玉米，7天内可发，预算2400"
            className="h-11 flex-1 rounded-full border border-line bg-rice px-5 text-sm text-ink placeholder:text-ink-soft/70"
          />
          <button
            type="submit"
            disabled={running || !text.trim()}
            className="h-11 rounded-full bg-brand px-7 text-sm font-medium text-white disabled:opacity-50"
          >
            {running ? "寻源中…" : "开始寻源"}
          </button>
        </form>
        {!text.trim() && (
          <button
            type="button"
            onClick={() => setText(EXAMPLE_NEED)}
            className="self-start text-xs text-brand-deep/70 underline-offset-4 transition-colors hover:text-brand-deep hover:underline"
          >
            填入示例需求 →
          </button>
        )}
      </div>

      {/* DAG 画布 */}
      <DagCanvas status={status} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* 产出面板 */}
      {need && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-panel px-5 py-4">
            <span className="text-xs text-ink-soft">
              {status.parse === "done" ? parserSource === "llm" ? "LLM 已理解需求" : "已识别需求" : ""} · 已加载 {listingCount} 笔粮源
            </span>
            <div className="mt-1 text-sm font-medium text-ink">{needText(need)}</div>
          </div>

          {plan && primary && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <PickCard pick={primary} label="主推粮源" />
                {backup ? (
                  <PickCard pick={backup} label="备选粮源" />
                ) : (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-line bg-panel/40 text-sm text-ink-soft">
                    暂无满足硬条件的备选
                  </div>
                )}
              </div>

              {plan.eliminated.length > 0 && (
                <div className="rounded-2xl border border-line bg-panel p-5">
                  <button
                    type="button"
                    onClick={() => setEliminatedOpen((open) => !open)}
                    className="flex w-full items-center gap-2 text-left text-sm font-semibold"
                  >
                    未入选原因
                    <span className="text-xs font-normal text-ink-soft">{plan.eliminated.length} 条</span>
                    <span className="ml-auto text-xs font-normal text-ink-soft">
                      {eliminatedOpen ? "收起 ▲" : "展开查看 ▼"}
                    </span>
                  </button>
                  {eliminatedOpen && (
                    <ul className="mt-3 space-y-2">
                      {plan.eliminated.map((e) => (
                        <li key={`${e.listing_code}-${e.reason_code}`} className="flex items-start justify-between gap-4 text-sm">
                          <span className="shrink-0 text-ink">
                            {e.variety_name}·{e.grade} · {e.supplier_name}
                          </span>
                          <span className="text-right text-ink-soft">{e.reason_text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-line bg-panel p-5">
                <div className="mb-3 text-sm font-semibold">交易前待核验清单</div>
                <ol className="space-y-1.5">
                  {plan.verifications.map((v, i) => (
                    <li key={v} className="text-sm text-ink">
                      <span className="mr-2 text-ink-soft">{i + 1}.</span>
                      {v}
                    </li>
                  ))}
                </ol>
              </div>

              {plan.ranking_review && (
                <div className="rounded-2xl border border-brand/35 bg-brand-faint/30 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">AI 比选决策</div>
                    <span className="text-xs text-brand-deep">{plan.ranking_review.source === "llm" ? "AI 决策" : "规则回退"}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink">{plan.ranking_review.summary}</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                    {plan.ranking_review.decision_basis.map((item) => <li key={item}>· {item}</li>)}
                  </ul>
                  <div className="mt-3 rounded-xl bg-panel/80 px-4 py-3 text-sm text-ink">下一步：{plan.ranking_review.procurement_advice}</div>
                </div>
              )}
            </>
          )}

          {plan && !primary && (
            <div className="rounded-2xl border border-dashed border-line bg-panel/40 p-5 text-sm text-ink-soft">
              无粮源通过硬条件，请放宽品种、数量、等级或发运时间后重试。
            </div>
          )}
        </div>
      )}

      {/* 结论区：保存 / 交接 */}
      {plan && primary && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <div className="text-sm font-semibold">下一步办理</div>
              <div className="mt-0.5 text-xs text-ink-soft">保存寻源结果，或让安小二独立检查主推供应方。</div>
            </div>
            <button
              type="button"
              onClick={() => setRiskDraft({
                id: `liang-${saved?.id ?? primary.listing_code}-${Date.now()}`,
                partnerType: "grain",
                partnerName: primary.supplier_name,
                region: primary.origin,
                business: `${primary.variety_name}供应`,
                sourceAgent: "粮小二",
                sourceTask: saved?.task_code ?? `寻源结果 · ${primary.listing_code}`,
                profile: [
                  { label: "粮源", value: `${primary.variety_name} · ${primary.grade}` },
                  { label: "报价", value: `${fmtInt(primary.price)} 元/吨` },
                  { label: "可供应量", value: `${fmtInt(primary.available_quantity_tons)} 吨` },
                  { label: "质量", value: `水分 ${fmtQuality(primary.moisture_pct)}% · 容重 ${fmtQuality(primary.test_weight_g_l)} g/L` },
                ],
                findings: [...new Set([...primary.risks, ...(plan.verifications ?? [])])],
                positiveEvidence: primary.reasons,
                createdAt: new Date().toISOString(),
              })}
              className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.07] px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-400/10"
            >
              查供应方风险
            </button>
          </div>
          {!saved ? (
            <button
              type="button"
              onClick={onSave}
              className="h-11 rounded-full bg-brand px-7 text-sm font-medium text-white"
            >
              保存为任务
            </button>
          ) : saved.status === "handed_off" ? (
            <div className="text-sm text-ink">
              已交接 · {saved.handoff?.handoff_code} · 目的地{" "}
              {saved.handoff?.summary.destination ?? "—"}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-ink">已保存 · {saved.task_code}</span>
              {!handoffOpen ? (
                <button
                  type="button"
                  onClick={() => setHandoffOpen(true)}
                  className="h-9 rounded-full bg-tech px-5 text-sm font-medium text-rice"
                >
                  交接运小二
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="目的到达地区，如：深圳"
                    className="h-9 rounded-full border border-line bg-rice px-4 text-sm text-ink placeholder:text-ink-soft/70"
                  />
                  <button
                    type="button"
                    disabled={!destination.trim()}
                    onClick={onHandoff}
                    className="h-9 rounded-full bg-tech px-5 text-sm font-medium text-rice disabled:opacity-50"
                  >
                    确认交接
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 历史记录 */}
      <HistoryTab refreshKey={historyKey} />
      {riskDraft && <RiskHandoffDialog draft={riskDraft} onClose={() => setRiskDraft(null)} />}
    </div>
  );
}
