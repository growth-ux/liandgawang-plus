import type { MissionSnapshot } from "./types";

const STAGES = ["目标确认", "智能组队", "并行办理", "冲突会商", "方案确认", "执行分派"];

interface MissionRailProps {
  phase: string;
  status: string;
  mission: MissionSnapshot;
}

/** 左侧任务推进轨：只定位进度，不要求用户逐页操作。 */
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
    <aside className="zg-rail">
      <p className="text-xs tracking-[0.25em] text-tech">MISSION RAIL</p>
      <div className="mt-4">
        {STAGES.map((stage, index) => {
          const state = index < doneCount ? "done" : index === activeIndex && status !== "completed" ? "active" : index < 6 && status === "completed" ? "done" : "pending";
          return (
            <div key={stage} className="zg-rail-item" data-state={state}>
              <span className="zg-rail-dot" />
              <div>
                <p className={`text-sm ${state === "active" ? "font-medium text-tech" : state === "done" ? "text-ink" : "text-ink-soft"}`}>
                  {index + 1}. {stage}
                </p>
                {stage === "冲突会商" && hasConflicts && (
                  <p className="mt-0.5 text-[11px] text-brand-deep">发现 {mission.conflicts.length} 项专业冲突</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
