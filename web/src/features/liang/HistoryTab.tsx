// web/src/features/liang/HistoryTab.tsx
import { useCallback, useEffect, useState } from "react";
import { deleteTask, fetchTasks } from "./api";
import { fmtDate, fmtDateTime, fmtInt, fmtQuality } from "./format";
import type { SourcingTask, TaskPick } from "./types";

type Filter = "all" | "completed" | "handed_off";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "completed", label: "已出方案" },
  { key: "handed_off", label: "已交接" },
];

function statusLabel(status: SourcingTask["status"]): string {
  return status === "handed_off" ? "已交接" : "已出方案";
}

function PickCard({ pick, label }: { pick: TaskPick; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-brand-deep">{label}</span>
        <span className="text-xs text-ink-soft">{pick.listing_code}</span>
      </div>
      <div className="mt-2 text-base font-semibold text-ink">
        {pick.variety_name} · {pick.grade} · {pick.crop_year}
        <span className="ml-2 text-sm font-normal text-ink-soft">{pick.origin}</span>
      </div>
      {pick.delivered_price ? (
        <>
          <div className="mt-1 text-xl font-semibold tabular-nums text-tech">
            {fmtInt(pick.delivered_price)}
            <span className="ml-1 text-xs font-normal text-ink-soft">元/吨（到厂价）</span>
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">
            挂牌 {fmtInt(pick.price)} 元/吨 · {pick.price_type}
            {Number(pick.quality_penalty) > 0 && ` · 质量折价 ${pick.quality_penalty} 元/吨`}
          </div>
        </>
      ) : (
        <div className="mt-1 text-xl font-semibold tabular-nums text-tech">
          {fmtInt(pick.price)}
          <span className="ml-1 text-xs font-normal text-ink-soft">元/吨 · {pick.price_type}</span>
        </div>
      )}
      <div className="mt-1.5 text-sm text-ink">
        水分 {fmtQuality(pick.moisture_pct)}% · 容重 {fmtQuality(pick.test_weight_g_l)} g/L · 杂质{" "}
        {fmtQuality(pick.impurity_pct)}%
      </div>
      <div className="mt-2 space-y-0.5 text-sm text-ink">
        <div>供应方：{pick.supplier_name}</div>
        <div>
          可用量：{fmtInt(pick.available_quantity_tons)} 吨 · 最晚可发 {fmtDate(pick.latest_ship_at)}
        </div>
      </div>
      {pick.reasons.length > 0 && (
        <div className="mt-2 rounded-lg bg-rice px-3 py-2 text-xs text-ink">
          <span className="text-ink-soft">入选理由：</span>
          {pick.reasons.join("；")}
        </div>
      )}
      {pick.risks.length > 0 && (
        <div className="mt-1.5 text-xs text-amber-300">风险：{pick.risks.join("；")}</div>
      )}
    </div>
  );
}

function HistoryRow({
  task,
  onDelete,
}: {
  task: SourcingTask;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const need = task.need;
  const primary = task.plan?.primary ?? null;
  const backup = task.plan?.backup ?? null;

  return (
    <div className="rounded-2xl border border-line bg-panel">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center justify-between px-5 py-3 text-left"
        >
          <span className="text-sm font-medium text-ink">{task.task_code}</span>
          <span className="flex items-center gap-4 text-xs text-ink-soft">
            <span className="hidden sm:inline">{fmtDateTime(task.created_at)}</span>
            <span>{need?.variety ?? "—"}</span>
            <span>{need?.quantity_tons != null ? `${need.quantity_tons} 吨` : "—"}</span>
            <span>{primary ? primary.supplier_name : "—"}</span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                task.status === "handed_off"
                  ? "bg-tech/15 text-tech"
                  : "bg-brand-faint text-brand-deep"
              }`}
            >
              {statusLabel(task.status)}
            </span>
          </span>
        </button>
        {confirming ? (
          <div className="mr-4 flex items-center gap-1">
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs text-red-400"
            >
              确认
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg px-2 py-1.5 text-xs text-ink-soft hover:bg-rice"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mr-4 rounded-lg px-3 py-1.5 text-xs text-ink-soft hover:bg-rice hover:text-red-400"
          >
            删除
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-line px-5 py-4">
          {/* 需求 */}
          <div className="text-sm text-ink">
            <span className="text-ink-soft">需求：</span>
            {[
              need?.variety,
              need?.grade,
              need?.quantity_tons != null ? `${need.quantity_tons} 吨` : null,
              need?.crop_year != null ? `${need.crop_year} 年` : null,
              need?.deadline ? `最晚 ${need.deadline} 发运` : null,
              need?.budget_price != null ? `预算 ≤ ${need.budget_price} 元/吨` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>

          {/* 主推 / 备选 */}
          {(primary || backup) && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {primary && <PickCard pick={primary} label="主推粮源" />}
              {backup && <PickCard pick={backup} label="备选粮源" />}
            </div>
          )}

          {/* 未入选 */}
          {task.plan?.eliminated && task.plan.eliminated.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold text-ink-soft">
                未入选原因（{task.plan.eliminated.length}）
              </div>
              <ul className="space-y-1.5">
                {task.plan.eliminated.map((e) => (
                  <li
                    key={e.listing_code}
                    className="flex items-start justify-between gap-4 text-sm"
                  >
                    <span className="shrink-0 text-ink">
                      {e.variety_name}·{e.grade} · {e.supplier_name}
                    </span>
                    <span className="text-right text-ink-soft">{e.reason_text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 待核验 */}
          {task.plan?.verifications && task.plan.verifications.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold text-ink-soft">
                交易前待核验清单（{task.plan.verifications.length}）
              </div>
              <ol className="space-y-1">
                {task.plan.verifications.map((v, i) => (
                  <li key={v} className="text-sm text-ink">
                    <span className="mr-2 text-ink-soft">{i + 1}.</span>
                    {v}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 交接信息 */}
          {task.handoff && (
            <div className="mt-3 rounded-xl bg-rice px-4 py-2.5 text-xs text-ink">
              <div className="font-medium">
                交接单 {task.handoff.handoff_code} · 已交接于{" "}
                {fmtDateTime(task.handoff.handed_off_at)}
              </div>
              <div className="mt-1 text-ink-soft">
                {task.handoff.summary.origin ?? "—"} → {task.handoff.summary.destination ?? "—"}
                {task.handoff.summary.latest_ship_at
                  ? ` · 最晚可发 ${fmtDate(task.handoff.summary.latest_ship_at)}`
                  : ""}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HistoryTab({ refreshKey = 0 }: { refreshKey?: number }) {
  const [tasks, setTasks] = useState<SourcingTask[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setError(null);
    fetchTasks()
      .then(setTasks)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  async function onDelete(id: number) {
    try {
      await deleteTask(id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  }

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">历史记录</h2>
        <span className="text-xs text-ink-soft">共 {filtered.length} 条</span>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              filter === f.key
                ? "bg-brand text-white"
                : "border border-line bg-panel text-ink-soft hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-ink-soft">加载中…</p>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <p className="text-sm text-ink-soft">
            {tasks.length === 0
              ? "暂无寻源任务，去「寻源任务」页开始一次寻源吧"
              : "该状态下暂无记录"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((t) => (
            <HistoryRow key={t.id} task={t} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
