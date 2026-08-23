// web/src/features/liang/SourcingTab.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { createTask, fetchListings, fetchTasks, handoffTask } from "./api";
import { compareListings } from "./compare";
import DagCanvas from "./DagCanvas";
import { fmtDate, fmtInt } from "./format";
import { parseNeed } from "./parseNeed";
import { AUTO_BATCHES, buildPlan, initialStatus } from "./workflow";
import type { DagNodeId, NodeStatus } from "./workflow";
import type { CompareResult, Listing, NeedInput, SourcingTask, TaskPick } from "./types";

const STEP_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function needText(need: NeedInput | null): string {
  if (!need) return "未指定条件";
  const parts: string[] = [];
  if (need.variety) parts.push(need.variety);
  if (need.grade) parts.push(need.grade);
  if (need.crop_year != null) parts.push(`${need.crop_year} 年`);
  if (need.quantity_tons != null) parts.push(`${need.quantity_tons} 吨`);
  if (need.deadline_days != null) parts.push(`${need.deadline_days} 天内可发`);
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
        {fmtInt(pick.price)}
        <span className="ml-1 text-xs font-normal text-ink-soft">
          元/吨 · {pick.price_type}
        </span>
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

function HistoryRow({ task }: { task: SourcingTask }) {
  const [open, setOpen] = useState(false);
  const plan = task.plan;
  const primary = plan?.primary ?? null;
  return (
    <div className="rounded-2xl border border-line bg-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-ink">{task.task_code}</span>
        <span className="flex items-center gap-4 text-xs text-ink-soft">
          <span>{task.need?.variety ?? "—"}</span>
          <span>{task.need?.quantity_tons != null ? `${task.need.quantity_tons} 吨` : "—"}</span>
          <span>{primary ? primary.supplier_name : "—"}</span>
          <span
            className={`rounded-full px-2 py-0.5 ${
              task.status === "handed_off"
                ? "bg-tech/15 text-tech"
                : "bg-brand-faint text-brand-deep"
            }`}
          >
            {task.status === "handed_off" ? "已交接" : "已出方案"}
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-5 py-4 text-sm text-ink">
          <div className="text-ink-soft">
            需求：
            {[
              task.need?.variety,
              task.need?.grade,
              task.need?.quantity_tons != null ? `${task.need.quantity_tons} 吨` : null,
              task.need?.deadline ? `最晚 ${task.need.deadline} 发运` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
          {primary && (
            <div className="mt-2">
              主推：{primary.variety_name} · {primary.supplier_name} · {fmtInt(primary.price)} 元/吨
            </div>
          )}
          {plan?.backup && (
            <div className="mt-1">
              备选：{plan.backup.variety_name} · {plan.backup.supplier_name} · {fmtInt(plan.backup.price)} 元/吨
            </div>
          )}
          <div className="mt-1">淘汰 {plan?.eliminated.length ?? 0} 笔 · 待核验 {plan?.verifications.length ?? 0} 项</div>
          {task.handoff && (
            <div className="mt-2 rounded-xl bg-rice px-4 py-2 text-xs">
              交接单 {task.handoff.handoff_code} · 目的地 {task.handoff.summary.destination ?? "—"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SourcingTab() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Record<DagNodeId, NodeStatus>>(initialStatus);
  const [need, setNeed] = useState<NeedInput | null>(null);
  const [listingCount, setListingCount] = useState(0);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [running, setRunning] = useState(false);
  const [tasks, setTasks] = useState<SourcingTask[]>([]);
  const [saved, setSaved] = useState<SourcingTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const runId = useRef(0);

  const refreshTasks = useCallback(() => {
    fetchTasks().then(setTasks).catch(() => {});
  }, []);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  async function startRun() {
    const raw = text.trim();
    if (!raw || running) return;
    const id = ++runId.current;
    setRunning(true);
    setSaved(null);
    setError(null);
    setCompare(null);
    setListingCount(0);
    setHandoffOpen(false);
    setDestination("");
    setStatus(initialStatus());

    // ① 理解需求
    setStatus((s) => ({ ...s, parse: "running" }));
    await sleep(STEP_MS);
    const parsed = parseNeed(raw);
    setNeed(parsed);
    if (runId.current !== id) return;
    setStatus((s) => ({ ...s, parse: "done" }));

    // ② 读取粮源
    setStatus((s) => ({ ...s, load: "running" }));
    let listings: Listing[];
    try {
      listings = await fetchListings();
    } catch (e) {
      if (runId.current !== id) return;
      setError(e instanceof Error ? e.message : "粮源加载失败");
      setRunning(false);
      return;
    }
    await sleep(STEP_MS);
    if (runId.current !== id) return;
    setListingCount(listings.length);
    setStatus((s) => ({ ...s, load: "done" }));

    // 计算 + 逐步揭示 ③~⑦
    const result = compareListings(listings, [], parsed);
    setCompare(result);

    if (!result.has_need) {
      setStatus((s) => ({
        ...s,
        filter: "skipped",
        sort: "skipped",
        eliminate: "skipped",
        pick: "skipped",
        verify: "skipped",
      }));
      setRunning(false);
      return;
    }

    for (const batch of AUTO_BATCHES.slice(2)) {
      setStatus((s) => {
        const next = { ...s };
        for (const nid of batch) next[nid] = "running";
        return next;
      });
      await sleep(STEP_MS);
      if (runId.current !== id) return;
      setStatus((s) => {
        const next = { ...s };
        for (const nid of batch) next[nid] = "done";
        return next;
      });
    }
    setRunning(false);
  }

  async function onSave() {
    if (!compare || !compare.primary) return;
    try {
      const t = await createTask({
        need: compare.need_summary ?? {},
        plan: buildPlan(compare),
      });
      setSaved(t);
      setStatus((s) => ({ ...s, save: "done" }));
      refreshTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  async function onHandoff() {
    if (!saved || !destination.trim()) return;
    try {
      const t = await handoffTask(saved.id, destination.trim());
      setSaved(t);
      setHandoffOpen(false);
      setDestination("");
      refreshTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "交接失败");
    }
  }

  const plan = compare ? buildPlan(compare) : null;
  const primary = plan?.primary ?? null;
  const backup = plan?.backup ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* 输入 */}
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

      {/* DAG 画布 */}
      <DagCanvas status={status} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* 产出面板 */}
      {need && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-panel px-5 py-4">
            <span className="text-xs text-ink-soft">
              {status.parse === "done" ? "已识别需求" : ""} · 已加载 {listingCount} 笔粮源
            </span>
            <div className="mt-1 text-sm font-medium text-ink">{needText(need)}</div>
          </div>

          {compare && compare.has_need && primary && (
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

              {compare.eliminated.length > 0 && (
                <div className="rounded-2xl border border-line bg-panel p-5">
                  <div className="mb-3 text-sm font-semibold">未入选原因</div>
                  <ul className="space-y-2">
                    {compare.eliminated.map((e) => (
                      <li key={e.listing.id} className="flex items-start justify-between gap-4 text-sm">
                        <span className="shrink-0 text-ink">
                          {e.listing.variety_name}·{e.listing.grade} · {e.listing.supplier_name}
                        </span>
                        <span className="text-right text-ink-soft">{e.reason_text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-2xl border border-line bg-panel p-5">
                <div className="mb-3 text-sm font-semibold">交易前待核验清单</div>
                <ol className="space-y-1.5">
                  {compare.verifications.map((v, i) => (
                    <li key={v} className="text-sm text-ink">
                      <span className="mr-2 text-ink-soft">{i + 1}.</span>
                      {v}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}

          {compare && compare.has_need && !primary && (
            <div className="rounded-2xl border border-dashed border-line bg-panel/40 p-5 text-sm text-ink-soft">
              无粮源通过硬条件，请放宽品种、数量、等级或发运时间后重试。
            </div>
          )}
        </div>
      )}

      {/* 结论区：保存 / 交接 */}
      {compare && primary && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
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

      {/* 历史运行 */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">历史运行</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-ink-soft">暂无已保存的寻源任务</p>
        ) : (
          tasks.map((t) => <HistoryRow key={t.id} task={t} />)
        )}
      </div>
    </div>
  );
}
