import type { MissionSummary } from "./types";

interface StartStatsProps {
  missions: MissionSummary[];
}

/** 效率数据条：从 missions 统计数据 + mock 补充 */
export default function StartStats({ missions }: StartStatsProps) {
  const total = missions.length || 48;
  const completed = missions.filter((m) => m.status === "completed").length || Math.round(total * 0.96);
  const rate = total > 0 ? Math.round((completed / total) * 100) : 96;
  const avgMinutes = "3.2";
  const agentCount = 6;

  return (
    <div className="zg-start-stats">
      <div className="zg-start-stat-item">
        <div className="zg-start-stat-value zg-start-stat-value--cyan">{total}</div>
        <div className="zg-start-stat-label">采购目标</div>
      </div>
      <div className="zg-start-stat-divider" />
      <div className="zg-start-stat-item">
        <div className="zg-start-stat-value zg-start-stat-value--brand">
          {avgMinutes}
          <span className="zg-start-stat-unit">min</span>
        </div>
        <div className="zg-start-stat-label">平均拆解时间</div>
      </div>
      <div className="zg-start-stat-divider" />
      <div className="zg-start-stat-item">
        <div className="zg-start-stat-value zg-start-stat-value--green">{rate}%</div>
        <div className="zg-start-stat-label">方案通过率</div>
      </div>
      <div className="zg-start-stat-divider" />
      <div className="zg-start-stat-item">
        <div className="zg-start-stat-value zg-start-stat-value--white">{agentCount}</div>
        <div className="zg-start-stat-label">专业小二协作</div>
      </div>
    </div>
  );
}
