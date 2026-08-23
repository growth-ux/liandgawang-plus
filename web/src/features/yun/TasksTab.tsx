import { useEffect, useState } from "react";
import { listTasks } from "./api";
import type { TransportTask } from "./types";

interface Props {
  onOpenTask: (taskId: number) => void;
}

/** 运输任务：任务台账 */
export default function TasksTab({ onOpenTask }: Props) {
  const [tasks, setTasks] = useState<TransportTask[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTasks()
      .then(setTasks)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  if (error) {
    return <div className="rounded-3xl border border-line bg-panel/60 p-6 text-sm text-red-400">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="text-base font-semibold">运输任务</h2>
        {tasks.length === 0 ? (
          <p className="mt-3 text-xs text-ink-soft">还没有运输任务。去「运输方案」发起第一笔。</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/60">
            {tasks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onOpenTask(t.id)}
                  className="flex w-full items-center justify-between py-3 text-left text-sm hover:text-brand-deep"
                >
                  <span>
                    {t.origin} → {t.destination} · {t.variety_name} {t.quantity_tons} 吨
                    {t.deadline_date ? ` · 最晚 ${t.deadline_date}` : ""}
                  </span>
                  <span className="shrink-0">
                    <span className="rounded-full bg-brand-faint px-2.5 py-0.5 text-xs text-brand-deep">
                      {t.status_label}
                    </span>
                    {t.blocked_note && (
                      <span className="ml-2 text-xs text-amber-300">{t.blocked_note}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
