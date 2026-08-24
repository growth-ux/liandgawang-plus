import type { MissionSnapshot } from "./types";

const STAGES = ["目标确认", "智能组队", "并行办理", "冲突会商", "方案确认", "执行分派"];

interface MissionRailProps {
  phase: string;
  status: string;
  mission: MissionSnapshot;
}

/** 顶部任务推进轨：释放横向空间，只定位进度，不要求用户逐页操作。 */
export default function MissionRail({ phase, status, mission }: MissionRailProps) {
  const hasConflicts = mission.conflicts.length > 0;
  const doneCount = (() => {
    if (phase === "goal_confirmation") return 0;
    if (phase === "team_confirmation") return 1;
    if (phase === "parallel_execution") return 2;
    if (phase === "decision") return hasConflicts ? 4 : 3;
    return 6;
  })();
  const activeIndex = (() => {
    if (phase === "goal_confirmation") return 0;
    if (phase === "team_confirmation") return 1;
    if (phase === "parallel_execution") return 2;
    if (phase === "decision") return 4;
    return 5;
  })();

  return (
    <aside className="zg-rail" aria-label="任务推进阶段">
      <p className="zg-rail-title">任务进程</p>
      <div className="zg-rail-track">
        {STAGES.map((stage, index) => {
          const state = index < doneCount ? "done" : index === activeIndex && status !== "completed" ? "active" : index < 6 && status === "completed" ? "done" : "pending";
          return (
            <div key={stage} className="zg-rail-item" data-state={state}>
              <span className="zg-rail-dot" />
              <div className="min-w-0">
                <p className={`zg-rail-label ${state === "active" ? "font-medium text-tech" : state === "done" ? "text-ink" : "text-ink-soft"}`}>
                  <span className="zg-rail-index">{String(index + 1).padStart(2, "0")}</span>
                  {stage}
                </p>
                {stage === "冲突会商" && hasConflicts && (
                  <p className="zg-rail-note">{mission.conflicts.length} 项冲突</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
