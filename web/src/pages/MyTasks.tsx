import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchMissions, fetchMission } from "../features/zhanggui/api";
import type { ActionTask, MissionSnapshot } from "../features/zhanggui/types";

const tabs = ["全部", "办理中", "待我确认", "已完成", "已终止"];

interface TaskRow {
  task: ActionTask;
  mission: MissionSnapshot;
}

function bucketOf(task: ActionTask): number {
  if (task.status === "ready") return 1;
  if (task.status === "waiting_prerequisite") return 2;
  if (task.status === "completed") return 3;
  return 4;
}

/** 我的办事：集中查看粮掌柜生成的行动任务与待确认内容。 */
export default function MyTasks() {
  const [active, setActive] = useState(0);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    fetchMissions()
      .then((summaries) =>
        Promise.all(
          summaries
            .filter((item) => item.status === "completed" || item.status === "awaiting_decision" || item.status === "partially_completed")
            .slice(0, 20)
            .map((item) => fetchMission(item.id)),
        ),
      )
      .then((missions) => {
        if (cancelled) return;
        setRows(
          missions.flatMap((mission) =>
            mission.action_tasks.map((task) => ({ task, mission })),
          ),
        );
      })
      .catch(() => setRows([]))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => rows.filter((row) => active === 0 || bucketOf(row.task) === active),
    [rows, active],
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8">
      <h1 className="text-xl font-semibold">我的办事</h1>
      <p className="mt-1 text-sm text-ink-soft">
        集中查看小二正在办理的事项、待确认内容和历史结果
      </p>

      <div className="mt-5 flex gap-2">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              i === active
                ? "bg-brand font-medium text-white"
                : "border border-line bg-panel text-ink-soft hover:text-ink"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {!loading && filtered.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {filtered.map(({ task, mission }) => {
            const bucket = bucketOf(task);
            const clickable = task.status === "ready";
            return (
              <li
                key={task.id}
                className={`flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel px-5 py-4 ${
                  clickable ? "cursor-pointer transition-colors hover:border-tech/40" : ""
                }`}
                onClick={() =>
                  clickable &&
                  navigate(`/agent/${task.agent_id}?mission=${mission.id}&action=${task.action_code}`)
                }
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="mt-1 truncate text-xs text-ink-soft">
                    来源任务：{mission.title} · {mission.mission_code}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    bucket === 1
                      ? "bg-tech/10 text-tech"
                      : bucket === 2
                        ? "bg-amber-400/15 text-amber-300"
                        : bucket === 3
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-rice-deep text-ink-soft"
                  }`}
                >
                  {tabs[bucket]}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-6 flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-faint text-2xl">
            📋
          </span>
          <h2 className="mt-4 text-base font-semibold">
            {loading ? "正在加载…" : `暂无${tabs[active]}的办事事项`}
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            从粮掌柜找一位小二开始办事后，任务会出现在这里
          </p>
          <Link
            to="/agent/da"
            className="mt-6 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep"
          >
            去粮掌柜找小二
          </Link>
        </div>
      )}
    </div>
  );
}
