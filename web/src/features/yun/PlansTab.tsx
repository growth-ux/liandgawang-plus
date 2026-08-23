import { useCallback, useEffect, useState } from "react";
import { createInquiry, explainPlans, fetchTaskDetail } from "./api";
import type { TaskDetail, TransportPlan } from "./types";

interface Props {
  taskId: number | null;
  onInquiryCreated: () => void;
}

/** 运输方案：主推/备选/未入选 + 待核验 + 问运小二 */
export default function PlansTab({ taskId, onInquiryCreated }: Props) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (taskId == null) return;
    setError(null);
    fetchTaskDetail(taskId).then(setDetail).catch((e) => setError(e.message));
  }, [taskId]);

  useEffect(load, [load]);

  if (taskId == null) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
        请先在「找物流」生成正式运输需求，或从「运输任务」打开一个任务。
      </div>
    );
  }
  if (error) {
    return <div className="rounded-3xl border border-line bg-panel/60 p-6 text-sm text-red-400">{error}</div>;
  }
  if (!detail) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
        运小二正在匹配方案…
      </div>
    );
  }

  const { task, plans } = detail;
  const primary = plans.find((p) => p.plan_type === "primary");
  const backup = plans.find((p) => p.plan_type === "backup");
  const rejected = plans.filter((p) => p.plan_type === "rejected");
  const checkItems = primary?.check_items ?? backup?.check_items ?? [];

  const makeInquiry = async (planId: number) => {
    await createInquiry(taskId, planId);
    onInquiryCreated();
  };

  const ask = async () => {
    setBusy(true);
    try {
      const resp = await explainPlans(taskId, question);
      setAnswer(resp.answer);
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "解释失败");
    } finally {
      setBusy(false);
    }
  };

  const routeText = (p: TransportPlan) =>
    p.legs[0].origin + p.legs.map((l) => ` → ${l.destination}（${l.mode_name}）`).join("");

  const PlanCard = ({ plan, tone }: { plan: TransportPlan; tone: "primary" | "backup" }) => (
    <div
      className={`rounded-2xl border p-5 ${
        tone === "primary" ? "border-emerald-500/50" : "border-line"
      } bg-panel/60`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {tone === "primary" ? "主推 · " : "备选 · "}{plan.title}
        </span>
        <span className="text-sm font-semibold">
          ¥{plan.price_low}~{plan.price_high} 元/吨 · {plan.days_low}~{plan.days_high} 天
        </span>
      </div>
      <p className="mt-2 text-xs text-ink-soft">{routeText(plan)}</p>
      <p className="mt-1 text-xs text-ink-soft">
        换装 {plan.transship_count} 次{plan.risk_note ? ` · ${plan.risk_note}` : ""}
      </p>
      <p className="mt-2 text-xs">{plan.reason}</p>
      {tone === "primary" && checkItems.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-ink-soft">
          {checkItems.map((c) => (
            <li key={c}>☐ 待核验：{c}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => makeInquiry(plan.id)}
        className="mt-3 rounded-full bg-brand px-5 py-2 text-xs font-medium text-white"
      >
        选定此方案，生成询运单
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 需求摘要条 */}
      <section className="rounded-3xl border border-line bg-panel px-6 py-4 text-sm">
        {task.origin} → {task.destination} · {task.variety_name} {task.quantity_tons} 吨 ·
        最晚到货 {task.deadline_date ?? "未指定"} ·
        来源：{task.source_type === "handover" ? "粮小二交接" : task.source_type === "estimate" ? "测算转入" : "独立创建"} ·
        <span className="ml-1 text-brand-deep">{task.status_label}</span>
        {task.blocked_note && <span className="ml-2 text-amber-300">{task.blocked_note}</span>}
      </section>

      {primary && <PlanCard plan={primary} tone="primary" />}
      {backup && <PlanCard plan={backup} tone="backup" />}

      {!primary && !backup && (
        <div className="rounded-3xl border border-line bg-panel/60 p-6 text-sm text-ink-soft">
          当前条件下没有可行方案，请参考上方放宽建议调整条件后重新匹配。
        </div>
      )}

      {rejected.length > 0 && (
        <details className="rounded-3xl border border-line bg-panel/60 p-5 text-sm">
          <summary className="cursor-pointer text-sm font-semibold">未入选方案（{rejected.length}）</summary>
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
        {answer && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{answer}</p>}
      </section>
    </div>
  );
}
