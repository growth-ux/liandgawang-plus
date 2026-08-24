import { useNavigate } from "react-router-dom";
import type { ActionTask } from "./types";

export interface ActionTaskListProps {
  tasks: ActionTask[];
  missionId: number;
}

const STATUS_LABELS: Record<ActionTask["status"], string> = {
  ready: "待办理",
  waiting_prerequisite: "等待风险核验",
  completed: "已完成",
  cancelled: "已终止",
};

/** 行动任务列表：可办理任务跳转到对应小二服务页并携带任务上下文。 */
export default function ActionTaskList({ tasks, missionId }: ActionTaskListProps) {
  const navigate = useNavigate();

  if (tasks.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-panel px-5 py-4">
      <h3 className="text-sm font-semibold text-tech">后续行动任务</h3>
      <ul className="mt-3 space-y-2">
        {tasks.map((task) => {
          const clickable = task.status === "ready";
          return (
            <li
              key={task.id}
              className={`flex items-center justify-between gap-3 rounded-xl border border-line bg-rice px-4 py-2.5 text-sm ${
                clickable ? "cursor-pointer transition-colors hover:border-tech/50" : ""
              }`}
              onClick={() =>
                clickable &&
                navigate(`/agent/${task.agent_id}?mission=${missionId}&action=${task.action_code}`)
              }
            >
              <span className="truncate">{task.title}</span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${
                  task.status === "ready"
                    ? "bg-tech/10 text-tech"
                    : task.status === "waiting_prerequisite"
                      ? "bg-amber-400/10 text-amber-300"
                      : task.status === "completed"
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-rice-deep text-ink-soft"
                }`}
              >
                {STATUS_LABELS[task.status]}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
