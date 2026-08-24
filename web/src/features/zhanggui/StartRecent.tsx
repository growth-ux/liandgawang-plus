import type { MissionSummary } from "./types";
import { STATUS_LABELS } from "./types";

interface StartRecentProps {
  recents: MissionSummary[];
  onOpen(item: MissionSummary): void;
  onOpenHistory(): void;
}

/** 最近任务列表：2列卡片布局 */
export default function StartRecent({ recents, onOpen, onOpenHistory }: StartRecentProps) {
  if (recents.length === 0) return null;

  return (
    <div className="zg-start-recent">
      <div className="zg-start-recent-header">
        <span className="zg-start-recent-title">最近任务</span>
        <button type="button" onClick={onOpenHistory} className="zg-start-recent-link">
          查看全部 →
        </button>
      </div>
      <div className="zg-start-task-grid">
        {recents.slice(0, 4).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="zg-start-task-card"
          >
            <div className="zg-start-task-row">
              <span className="zg-start-task-name">{item.title}</span>
              <span
                className={`zg-start-task-status${item.status === "completed" ? " zg-start-task-status--done" : item.status === "running" ? " zg-start-task-status--running" : " zg-start-task-status--default"}`}
              >
                {STATUS_LABELS[item.status]}
              </span>
            </div>
            <div className="zg-start-task-meta">
              <span>{item.mission_code}</span>
              <span>{item.updated_at?.slice(0, 16).replace("T", " ") ?? "—"}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
