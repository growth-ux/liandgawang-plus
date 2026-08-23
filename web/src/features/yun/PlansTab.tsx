import { useCallback, useEffect, useRef, useState } from "react";
import {
  createInquiry,
  explainPlans,
  fetchLogisticsMeta,
  fetchTaskDetail,
  matchTask,
} from "./api";
import type {
  DecisionPreference,
  LogisticsMeta,
  TaskDetail,
  TransportPlanPrefill,
} from "./types";
import TransportPlanComposer from "./TransportPlanComposer";
import PlanDecisionCard from "./PlanDecisionCard";
import PlanReferenceCards from "./PlanReferenceCards";
import { selectPlanReferences } from "./planReferences";

interface Props {
  taskId: number | null;
  prefill: TransportPlanPrefill | null;
  onPrefillConsumed: () => void;
  onTaskCreated: (taskId: number) => void;
  onNewTask: () => void;
  onInquiryCreated: () => void;
}

const PREFERENCES: Array<{ value: DecisionPreference; label: string }> = [
  { value: "on_time", label: "准时优先" },
  { value: "cost", label: "成本优先" },
  { value: "balanced", label: "均衡决策" },
];

const STEPS = ["理解运输需求", "过滤不可行线路", "组合运输路径", "按决策偏好优选"];

/** 运输方案：一句话描述 → 智能抽取 + 确认 → 匹配方案（主推 + 更快/更省参照）→ 问运小二 */
export default function PlansTab({
  taskId,
  prefill,
  onPrefillConsumed,
  onTaskCreated,
  onNewTask,
  onInquiryCreated,
}: Props) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<LogisticsMeta | null>(null);
  // 记录「本组件已加载的任务」，避免 onTaskCreated 触发外部 taskId 变化后重复 fetch
  const loadedRef = useRef<number | null>(null);

  const loadDetail = useCallback(async (id: number) => {
    setError(null);
    setDetail(null);
    setAnswer(null);
    try {
      const d = await fetchTaskDetail(id);
      setDetail(d);
      loadedRef.current = id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    if (taskId == null) {
      setDetail(null);
      setAnswer(null);
      loadedRef.current = null;
      return;
    }
    if (loadedRef.current === taskId) return;
    loadDetail(taskId);
  }, [taskId, loadDetail]);

  useEffect(() => {
    fetchLogisticsMeta()
      .then(setMeta)
      .catch(() => {});
  }, []);

  const makeInquiry = async (planId: number) => {
    const currentId = detail?.task.id;
    if (currentId == null) return;
    await createInquiry(currentId, planId);
    onInquiryCreated();
  };

  const ask = async () => {
    const currentId = detail?.task.id;
    if (currentId == null) return;
    setBusy(true);
    try {
      const resp = await explainPlans(currentId, question);
      setAnswer(resp.answer);
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "解释失败");
    } finally {
      setBusy(false);
    }
  };

  const switchPreference = async (next: DecisionPreference) => {
    if (detail == null) return;
    setBusy(true);
    try {
      await matchTask(detail.task.id, next);
      const refreshed = await fetchTaskDetail(detail.task.id);
      setDetail(refreshed);
    } catch (e) {
      setError("重新排序失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const plans = detail?.plans ?? [];
  const primary = plans.find((p) => p.plan_type === "primary");
  const refs = primary
    ? selectPlanReferences(primary, plans)
    : { faster: null, cheaper: null };
  const rejected = plans.filter((p) => p.plan_type === "rejected");

  return (
    <div className="flex flex-col gap-4">
      {/* 需求输入区 或 已有任务摘要 + 偏好切换 */}
      {detail ? (
        <section className="rounded-3xl border border-line bg-panel px-6 py-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-ink-soft">
              {detail.task.origin} → {detail.task.destination} · {detail.task.variety_name}{" "}
              {detail.task.quantity_tons} 吨 · 最晚到货 {detail.task.deadline_date ?? "未指定"} ·
              来源：
              {detail.task.source_type === "handover" ? "粮小二交接" : "独立创建"}{" "}
              ·<span className="ml-1 text-brand-deep">{detail.task.status_label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {PREFERENCES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => switchPreference(p.value)}
                  disabled={busy}
                  className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                    detail.task.decision_preference === p.value
                      ? "border-brand bg-brand-faint text-brand-deep"
                      : "border-line text-ink-soft hover:border-tech hover:text-ink"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={onNewTask}
                className="shrink-0 rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft hover:border-tech hover:text-ink"
              >
                新建需求
              </button>
            </div>
          </div>
        </section>
      ) : (
        <TransportPlanComposer
          prefill={prefill}
          onPrefillConsumed={onPrefillConsumed}
          onTaskCreated={onTaskCreated}
        />
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* 方案产出 */}
      {detail && (
        <div className="flex flex-col gap-4">
          {primary == null ? (
            <div className="rounded-3xl border border-line bg-panel/60 p-6 text-sm text-ink-soft">
              {detail.task.blocked_note ? (
                <p>{detail.task.blocked_note}</p>
              ) : (
                <p>当前条件下没有可行方案。</p>
              )}
              <button
                type="button"
                onClick={onNewTask}
                className="mt-4 rounded-full border border-line px-5 py-2 text-xs text-ink-soft hover:border-tech hover:text-ink"
              >
                修改运输条件
              </button>
            </div>
          ) : (
            <>
              {/* 四步完成状态 */}
              <section className="rounded-3xl border border-line bg-panel/60 p-5">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-soft">
                  {STEPS.map((s, i) => (
                    <span key={s} className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] leading-none text-emerald-300">
                        ✓
                      </span>
                      {i + 1} {s}
                    </span>
                  ))}
                </div>
              </section>

              {/* 主推方案 */}
              <PlanDecisionCard
                plan={primary}
                quantityTons={detail.task.quantity_tons}
                onAdopt={makeInquiry}
                busy={busy}
              />

              {/* 参照方案 */}
              <PlanReferenceCards faster={refs.faster} cheaper={refs.cheaper} primary={primary} />

              {/* 未入选折叠区 */}
              {rejected.length > 0 && (
                <details className="rounded-3xl border border-line bg-panel/60 p-5 text-sm">
                  <summary className="cursor-pointer text-sm font-semibold">
                    未入选方案（{rejected.length}）
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {rejected.map((r) => (
                      <li key={r.id} className="text-xs text-ink-soft">
                        {r.title}：¥{r.price_low}~{r.price_high} 元/吨 · {r.days_low}~{r.days_high} 天
                        <span className="ml-2 text-red-400">{r.reason}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {/* 问运小二 */}
              <section className="rounded-3xl border border-line bg-panel p-5">
                <h3 className="text-sm font-semibold">问运小二</h3>
                <div className="mt-3 flex gap-3">
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="例如：为什么没选最便宜的？到货期限放宽 3 天会怎样？"
                    className="h-10 flex-1 rounded-full border border-line bg-rice px-4 text-sm text-ink placeholder:text-ink-soft/70"
                  />
                  <button
                    type="button"
                    onClick={ask}
                    disabled={busy}
                    className="h-10 rounded-full bg-brand px-6 text-sm text-white disabled:opacity-50"
                  >
                    {busy ? "思考中…" : "提问"}
                  </button>
                </div>
                {answer && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{answer}</p>
                )}
              </section>
            </>
          )}

          {/* 依据与口径 */}
          <section className="rounded-3xl border border-line bg-panel/60 p-5 text-xs text-ink-soft">
            <p>
              线路资源、承运吨位、发运窗口、参考运价、时效区间
              {meta?.data_updated_at ? `及数据更新时间：${meta.data_updated_at}` : ""}
            </p>
            <p className="mt-1">运价、时效和运力为方案匹配参考，实际结果以询运反馈为准。</p>
          </section>
        </div>
      )}
    </div>
  );
}
