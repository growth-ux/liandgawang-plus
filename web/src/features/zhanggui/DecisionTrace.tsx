import type { MissionSnapshot } from "./types";
import { getAgent } from "../../data/agents";

export interface DecisionTraceProps {
  mission: MissionSnapshot;
}

interface TraceItem {
  time: string;
  actor: string;
  text: string;
}

function normalizedIso(value: string) {
  return value.replace(/(\.\d{3})\d+/, "$1");
}

function timeValue(value: string) {
  const parsed = Date.parse(normalizedIso(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function timeText(value: string) {
  const parsed = new Date(normalizedIso(value));
  if (Number.isNaN(parsed.getTime())) return value.replace("T", " ").slice(11, 19);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
}

/** 决策轨迹：按时间还原目标确认、团队确认、办理、冲突、建议与用户选择。 */
export default function DecisionTrace({ mission }: DecisionTraceProps) {
  const items: TraceItem[] = [];

  const goalDecision = mission.decisions.find((decision) => decision.gate_type === "goal");
  if (goalDecision?.status === "confirmed") {
    items.push({ time: goalDecision.decided_at ?? "", actor: "用户", text: "确认采购目标口径" });
  }
  const teamDecision = mission.decisions.find((decision) => decision.gate_type === "team");
  if (teamDecision?.status === "confirmed") {
    const count = mission.team.filter((member) => member.selected).length;
    items.push({ time: teamDecision.decided_at ?? "", actor: "用户", text: `确认协作团队（${count} 位小二参与）` });
  }
  const planDecision = mission.decisions.find((decision) => decision.gate_type === "plan");
  for (const run of mission.agent_runs) {
    if (run.status === "completed" || run.status === "completed_with_objection") {
      const name = getAgent(run.agent_id)?.name ?? run.agent_id;
      items.push({
        time: run.finished_at ?? "",
        actor: name,
        text: run.status === "completed_with_objection" ? "完成办理并提出风险异议" : "完成专业办理",
      });
    } else if (run.status === "failed") {
      items.push({ time: run.finished_at ?? "", actor: getAgent(run.agent_id)?.name ?? run.agent_id, text: "办理失败，结果缺失" });
    }
  }
  for (const conflict of mission.conflicts) {
    items.push({
      time: conflict.occurred_at ?? planDecision?.created_at ?? "",
      actor: "粮掌柜",
      text: `发现冲突：${conflict.title}`,
    });
  }
  if (mission.recommendation) {
    items.push({
      time: mission.recommendation.generated_at ?? planDecision?.created_at ?? "",
      actor: "粮掌柜",
      text: `给出条件化建议：主推方案 ${mission.recommendation.primary_scheme_id}`,
    });
  }
  if (planDecision?.status === "confirmed") {
    const option = planDecision.options.find((item) => item.action === planDecision.selected_action);
    items.push({ time: planDecision.decided_at ?? "", actor: "用户", text: `选择：${option?.label ?? planDecision.selected_action}` });
  }
  if (mission.action_tasks.length > 0) {
    const taskCreatedAt = mission.action_tasks
      .map((task) => task.created_at ?? "")
      .filter(Boolean)
      .sort((a, b) => timeValue(a) - timeValue(b))[0];
    items.push({
      time: taskCreatedAt ?? planDecision?.decided_at ?? "",
      actor: "粮掌柜",
      text: `生成 ${mission.action_tasks.length} 项行动任务`,
    });
  }

  items.sort((a, b) => timeValue(a.time) - timeValue(b.time));

  return (
    <section className="rounded-2xl border border-line bg-panel px-5 py-4">
      <h3 className="text-sm font-semibold text-tech">决策轨迹</h3>
      <ol className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3 text-sm">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-tech/70" />
            <div className="min-w-0">
              <span className="font-medium">{item.actor}</span>
              <span className="ml-2 text-ink-soft">{item.text}</span>
              {item.time && (
                <span className="ml-2 text-xs text-ink-soft/70">{timeText(item.time)}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
