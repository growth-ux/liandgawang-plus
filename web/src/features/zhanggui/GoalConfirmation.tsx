import { useState } from "react";
import { confirmGoal } from "./api";
import type { MissionSnapshot } from "./types";
import KnowledgeReferencePanel from "../knowledge/KnowledgeReferencePanel";

interface GoalConfirmationProps {
  mission: MissionSnapshot;
  onConfirmed(next: MissionSnapshot): void;
}

const SOURCE_LABELS = { user: "用户输入", memory: "企业过往经验", estimated: "暂按估算" } as const;

const EDITABLE_KEYS = ["quantity_tons", "deadline_date", "destination", "budget_yuan_per_ton"] as const;

/** 目标确认闸门：确认高影响字段，标明每个字段的来源。 */
export default function GoalConfirmation({ mission, onConfirmed }: GoalConfirmationProps) {
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const goal = mission.goal;
    return {
      quantity_tons: goal.quantity_tons ?? "",
      deadline_date: goal.deadline_date ?? "",
      destination: goal.destination ?? "",
      budget_yuan_per_ton: goal.budget_yuan_per_ton ?? "",
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questions = questionsFromGoal(mission);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const goal = {
        ...mission.goal,
        quantity_tons: draft.quantity_tons || null,
        deadline_date: draft.deadline_date || null,
        destination: draft.destination || null,
        budget_yuan_per_ton: draft.budget_yuan_per_ton || null,
      };
      const next = await confirmGoal(mission.id, goal);
      onConfirmed(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "目标确认失败");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 py-10">
      <p className="text-xs tracking-[0.3em] text-tech">HUMAN-IN-THE-LOOP · 闸门 1/3</p>
      <h1 className="mt-2 text-xl font-semibold">确认采购目标</h1>
      <p className="mt-2 text-sm text-ink-soft">
        粮掌柜已从你的描述中提取关键条件。确认后会按目标组建专业小二团队；非关键缺失项按暂估处理，不做无休止追问。
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {mission.goal && fieldRows(mission).map((field) => {
          const editable = (EDITABLE_KEYS as readonly string[]).includes(field.key);
          return (
            <div key={field.key} className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-ink-soft">{field.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${sourceTone(field.source)}`}>
                  {SOURCE_LABELS[field.source]}
                </span>
              </div>
              {editable ? (
                <input
                  value={draft[field.key] ?? ""}
                  type={field.key === "deadline_date" ? "date" : "text"}
                  onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-line bg-rice px-3 py-1.5 text-sm text-ink focus:border-tech/60 focus:outline-none"
                />
              ) : (
                <p className="mt-2 text-sm">
                  {field.value ?? <span className="text-ink-soft">{field.note || "—"}</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {mission.goal.hard_constraints.length > 0 && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-faint px-4 py-3 text-sm">
          <span className="font-medium text-brand-deep">硬性底线：</span>
          {mission.goal.hard_constraints.join("；")}
        </div>
      )}

      {questions.length > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-panel/70 px-4 py-3">
          <p className="text-sm font-medium">粮掌柜还想确认：</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <KnowledgeReferencePanel
          references={mission.memory_references}
          effect="用于补充默认采购优先级；用户本次明确输入始终优先。"
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
        >
          {busy ? "正在生成组队建议…" : "确认目标，生成组队建议"}
        </button>
        {error && <span className="text-sm text-red-300">{error}</span>}
      </div>
    </div>
  );
}

function sourceTone(source: "user" | "memory" | "estimated") {
  if (source === "user") return "bg-tech/10 text-tech";
  if (source === "memory") return "bg-violet-400/10 text-violet-300";
  return "bg-amber-400/10 text-amber-300";
}

function fieldRows(mission: MissionSnapshot) {
  const goal = mission.goal;
  return [
    { key: "variety_name", label: "品种", value: `${goal.variety_name}${goal.grade ? ` · ${goal.grade}` : ""}`, source: "user" as const, note: "" },
    { key: "quantity_tons", label: "数量（吨）", value: goal.quantity_tons, source: (goal.quantity_tons ? "user" : "estimated") as "user" | "estimated", note: "待确认" },
    { key: "deadline_date", label: "最晚到货日期", value: goal.deadline_date, source: (goal.deadline_date ? "user" : "estimated") as "user" | "estimated", note: "待确认" },
    { key: "destination", label: "到货地点", value: goal.destination, source: (goal.destination ? "user" : "estimated") as "user" | "estimated", note: "待确认" },
    { key: "budget_yuan_per_ton", label: "综合成本预算（元/吨）", value: goal.budget_yuan_per_ton, source: (goal.budget_yuan_per_ton ? "user" : "estimated") as "user" | "estimated", note: "暂按估算，建议确认" },
    {
      key: "priority",
      label: "采购优先级",
      value:
        goal.priority === "supply"
          ? "优先保供，再比较综合成本"
          : goal.priority === "cost"
            ? "成本优先"
            : "保供与成本平衡",
      source: (mission.memory_references.some((m) => m.content.includes("保供")) && goal.priority === "supply"
        ? "memory"
        : "user") as "memory" | "user",
      note: "",
    },
  ];
}

function questionsFromGoal(mission: MissionSnapshot): string[] {
  const goal = mission.goal;
  const questions: string[] = [];
  if (!goal.budget_yuan_per_ton) questions.push("本次采购的预算大约是多少元/吨？");
  if (!goal.deadline_date) questions.push("这批粮最晚需要在什么时间到厂？");
  if (!goal.destination) questions.push("请确认到货地点（到厂城市）。");
  if (!goal.quantity_tons) questions.push("请确认本次采购数量（吨）。");
  return questions.slice(0, 2);
}
