import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  cancelActionTask,
  fetchMission,
  fetchMissions,
  submitDecision,
  terminateMission,
} from "../features/zhanggui/api";
import type { ActionTask, MissionSnapshot } from "../features/zhanggui/types";

const tabs = ["全部", "办理中", "待我确认", "已完成", "已终止"];
const PAGE_SIZE = 10;

type WorkItem =
  | { kind: "action"; task: ActionTask; mission: MissionSnapshot; bucket: number }
  | { kind: "mission"; mission: MissionSnapshot; bucket: number };

function actionBucket(task: ActionTask): number {
  if (task.status === "ready") return 1;
  if (task.status === "waiting_prerequisite") return 2;
  if (task.status === "completed") return 3;
  return 4;
}

function missionBucket(mission: MissionSnapshot): number {
  if (mission.status === "terminated") return 4;
  if (mission.status === "awaiting_goal_confirmation" || mission.status === "awaiting_team_confirmation" || mission.status === "awaiting_decision") return 2;
  return 1;
}

function missionStatusText(mission: MissionSnapshot): string {
  const pending = mission.decisions.find((item) => item.status === "pending");
  if (pending) return "待我确认";
  if (mission.status === "running") return "办理中";
  if (mission.status === "terminated") return "已终止";
  if (mission.status === "awaiting_goal_confirmation") return "待确认目标";
  return "待确认团队";
}

/** 我的办事：统一承接人工决策、办理进度和后续行动。 */
export default function MyTasks() {
  const [active, setActive] = useState(0);
  const [page, setPage] = useState(1);
  const [missions, setMissions] = useState<MissionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminating, setTerminating] = useState<MissionSnapshot | null>(null);
  const [reason, setReason] = useState("");
  const navigate = useNavigate();

  function replaceMission(next: MissionSnapshot) {
    setMissions((current) => current.map((mission) => (mission.id === next.id ? next : mission)));
  }

  useEffect(() => {
    let cancelled = false;
    fetchMissions()
      .then((summaries) => Promise.all(summaries.map((item) => fetchMission(item.id))))
      .then((items) => {
        if (!cancelled) setMissions(items);
      })
      .catch(() => {
        if (!cancelled) setError("办事记录加载失败，请稍后重试");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo<WorkItem[]>(() => {
    const rows: WorkItem[] = [];
    missions.forEach((mission) => {
      if (["awaiting_goal_confirmation", "awaiting_team_confirmation", "running", "awaiting_decision", "terminated"].includes(mission.status)) {
        rows.push({ kind: "mission", mission, bucket: missionBucket(mission) });
      }
      mission.action_tasks.forEach((task) => rows.push({ kind: "action", task, mission, bucket: actionBucket(task) }));
    });
    return rows;
  }, [missions]);

  const filtered = useMemo(() => items.filter((item) => active === 0 || item.bucket === active), [items, active]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filtered],
  );

  async function resolveDecision(mission: MissionSnapshot, decisionId: number, action: string) {
    const key = `decision-${decisionId}`;
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      replaceMission(await submitDecision(mission.id, decisionId, action));
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认失败，请重试");
    } finally {
      setBusyKey(null);
    }
  }

  async function cancelTask(mission: MissionSnapshot, task: ActionTask) {
    if (!window.confirm(`确认终止“${task.title}”？其他行动不会受影响。`)) return;
    const key = `action-${task.id}`;
    setBusyKey(key);
    setError(null);
    try {
      replaceMission(await cancelActionTask(mission.id, task.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "终止失败，请重试");
    } finally {
      setBusyKey(null);
    }
  }

  async function confirmTerminate() {
    if (!terminating || busyKey) return;
    setBusyKey(`mission-${terminating.id}`);
    setError(null);
    try {
      replaceMission(await terminateMission(terminating.id, reason.trim()));
      setTerminating(null);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "终止失败，请重试");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8">
      <h1 className="text-xl font-semibold">我的办事</h1>
      <p className="mt-1 text-sm text-ink-soft">集中处理 AI 提交的关键确认，跟进办理进展与历史结果</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((tab, index) => (
          <button key={tab} type="button" onClick={() => { setActive(index); setPage(1); }} className={`rounded-full px-4 py-1.5 text-sm transition-colors ${index === active ? "bg-brand font-medium text-white" : "border border-line bg-panel text-ink-soft hover:text-ink"}`}>
            {tab}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-300">{error}</p>}

      {!loading && filtered.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {paged.map((item) => {
            if (item.kind === "action") {
              const { task, mission } = item;
              const canOpen = task.status === "ready";
              const canCancel = task.status === "ready" || task.status === "waiting_prerequisite";
              return (
                <li key={`action-${task.id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="mt-1 truncate text-xs text-ink-soft">来源办事：{mission.title} · {mission.mission_code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${item.bucket === 1 ? "bg-tech/10 text-tech" : item.bucket === 2 ? "bg-amber-400/15 text-amber-300" : item.bucket === 3 ? "bg-emerald-400/15 text-emerald-300" : "bg-rice-deep text-ink-soft"}`}>{tabs[item.bucket]}</span>
                    {canOpen && <button type="button" onClick={() => navigate(`/agent/${task.agent_id}?mission=${mission.id}&action=${task.action_code}`)} className="rounded-full bg-tech/10 px-3 py-1.5 text-xs font-medium text-tech hover:bg-tech/20">去办理</button>}
                    {canCancel && <button type="button" disabled={busyKey === `action-${task.id}`} onClick={() => cancelTask(mission, task)} className="rounded-full border border-red-400/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/10 disabled:opacity-50">终止</button>}
                  </div>
                </li>
              );
            }

            const { mission } = item;
            const pending = mission.decisions.find((decision) => decision.status === "pending");
            const activeMission = mission.status !== "terminated";
            return (
              <li key={`mission-${mission.id}`} className="rounded-2xl border border-line bg-panel px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{pending?.prompt ?? mission.title}</p>
                    <p className="mt-1 text-xs text-ink-soft">{mission.title} · {mission.mission_code}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.bucket === 1 ? "bg-tech/10 text-tech" : item.bucket === 2 ? "bg-amber-400/15 text-amber-300" : "bg-rice-deep text-ink-soft"}`}>{missionStatusText(mission)}</span>
                </div>
                {pending ? (
                  <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
                    <p className="text-xs leading-5 text-ink-soft">{pending.ai_recommendation}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pending.options.map((option) => <button key={option.action} type="button" disabled={busyKey === `decision-${pending.id}`} onClick={() => resolveDecision(mission, pending.id, option.action)} className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-white hover:bg-brand-deep disabled:opacity-50">{busyKey === `decision-${pending.id}` ? "正在确认…" : option.label}</button>)}
                      <button type="button" onClick={() => { setReason(""); setTerminating(mission); }} className="rounded-full border border-red-400/30 px-3.5 py-1.5 text-xs text-red-300 hover:bg-red-400/10">终止办事</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeMission && <button type="button" onClick={() => navigate(`/agent/da?mission=${mission.id}`)} className="rounded-full border border-tech/30 bg-tech/10 px-3.5 py-1.5 text-xs font-medium text-tech hover:bg-tech/20">{mission.status === "running" ? "查看进展" : "继续确认"}</button>}
                    {activeMission && <button type="button" onClick={() => { setReason(""); setTerminating(mission); }} className="rounded-full border border-red-400/30 px-3.5 py-1.5 text-xs text-red-300 hover:bg-red-400/10">终止办事</button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-6 flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-faint text-2xl">📋</span>
          <h2 className="mt-4 text-base font-semibold">{loading ? "正在加载…" : `暂无${tabs[active]}的办事事项`}</h2>
          <p className="mt-2 text-sm text-ink-soft">从粮掌柜找一位小二开始办事后，任务会出现在这里</p>
          <Link to="/agent/da" className="mt-6 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep">去粮掌柜找小二</Link>
        </div>
      )}

      {!loading && filtered.length > PAGE_SIZE && (
        <nav aria-label="办事列表分页" className="mt-6 flex items-center justify-between gap-3 text-sm text-ink-soft">
          <span>共 {filtered.length} 条，第 {currentPage} / {pageCount} 页</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-full border border-line px-4 py-1.5 text-xs hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">上一页</button>
            <button type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-full border border-line px-4 py-1.5 text-xs hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">下一页</button>
          </div>
        </nav>
      )}

      {terminating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5">
          <section role="dialog" aria-modal="true" aria-label="终止办事" className="w-full max-w-md rounded-2xl border border-red-400/25 bg-panel p-6 shadow-2xl">
            <p className="text-xs tracking-[0.2em] text-red-300">TERMINATE MISSION</p>
            <h2 className="mt-2 text-lg font-semibold">终止这项办事？</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">已生成的分析、确认记录与行动任务会被保留，但该办事不会再继续推进。</p>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="终止原因（可选）" className="mt-4 min-h-24 w-full rounded-xl border border-line bg-rice px-3 py-2 text-sm outline-none placeholder:text-ink-soft/60 focus:border-red-400/50" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTerminating(null)} className="rounded-full border border-line px-4 py-2 text-xs text-ink-soft hover:text-ink">返回</button>
              <button type="button" disabled={busyKey === `mission-${terminating.id}`} onClick={confirmTerminate} className="rounded-full bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-400 disabled:opacity-50">{busyKey === `mission-${terminating.id}` ? "正在终止…" : "确认终止"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
