import { useEffect, useState } from "react";
import { createTask, extractRequirements, fetchLogisticsMeta, matchTask } from "./api";
import type {
  DecisionPreference,
  LogisticsMeta,
  RequirementFields,
  TransportPlanPrefill,
} from "./types";
import RequirementConfirmCard, { type RequirementDraft } from "./RequirementConfirmCard";

interface Props {
  prefill: TransportPlanPrefill | null;
  onPrefillConsumed: () => void;
  onTaskCreated: (taskId: number) => void;
}

const EMPTY_DRAFT: RequirementDraft = {
  origin: "",
  destination: "",
  variety_code: "corn",
  quantity_tons: "",
  deadline_date: "",
};

const PREFERENCES: Array<{ value: DecisionPreference; label: string; hint: string }> = [
  { value: "on_time", label: "准时优先", hint: "先比时效" },
  { value: "cost", label: "成本优先", hint: "先比费用" },
  { value: "balanced", label: "均衡决策", hint: "费用与时效兼顾" },
];

function mergeExtractedFields(
  current: RequirementDraft,
  fields: Partial<RequirementFields>
): RequirementDraft {
  const next = { ...current };
  if (fields.origin?.trim()) next.origin = fields.origin;
  if (fields.destination?.trim()) next.destination = fields.destination;
  if (fields.variety_code?.trim()) next.variety_code = fields.variety_code;
  if (fields.quantity_tons != null) next.quantity_tons = String(fields.quantity_tons);
  if (fields.deadline_date) next.deadline_date = fields.deadline_date;
  return next;
}

export default function TransportPlanComposer({
  prefill,
  onPrefillConsumed,
  onTaskCreated,
}: Props) {
  const [text, setText] = useState("");
  const [preference, setPreference] = useState<DecisionPreference>("balanced");
  const [preferenceTouched, setPreferenceTouched] = useState(false);
  const [draft, setDraft] = useState<RequirementDraft>(EMPTY_DRAFT);
  const [confirming, setConfirming] = useState(false);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<LogisticsMeta | null>(null);
  const [metaFailed, setMetaFailed] = useState(false);

  useEffect(() => {
    fetchLogisticsMeta()
      .then(setMeta)
      .catch(() => setMetaFailed(true));
  }, []);

  useEffect(() => {
    if (!prefill) return;
    setDraft((current) => ({
      origin: prefill.origin ?? current.origin,
      destination: prefill.destination ?? current.destination,
      variety_code: prefill.variety_code ?? current.variety_code,
      quantity_tons:
        typeof prefill.quantity_tons === "number"
          ? String(prefill.quantity_tons)
          : current.quantity_tons,
      deadline_date: prefill.deadline_date ?? current.deadline_date,
    }));
    setConfirming(true);
    onPrefillConsumed();
  }, [prefill, onPrefillConsumed]);

  const generate = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await extractRequirements(trimmed);
      if (result.llm_available && result.fields) {
        const fields = result.fields;
        setDraft((current) => mergeExtractedFields(current, fields));
        setAssumptions(result.assumptions ?? []);
        if (!preferenceTouched && result.decision_preference) {
          setPreference(result.decision_preference);
        }
      } else {
        setError("智能理解暂不可用，请确认下方运输条件后继续。");
      }
    } catch (e) {
      setError("智能理解暂不可用，请确认下方运输条件后继续。");
    } finally {
      setConfirming(true);
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (metaFailed) return;
    setBusy(true);
    setError(null);
    try {
      const task = await createTask({
        origin: draft.origin,
        destination: draft.destination,
        variety_code: draft.variety_code,
        quantity_tons: Number(draft.quantity_tons),
        deadline_date: draft.deadline_date || null,
        decision_preference: preference,
      });
      await matchTask(task.id, preference);
      onTaskCreated(task.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "匹配失败");
    } finally {
      setBusy(false);
    }
  };

  const missing = (["origin", "destination", "quantity_tons"] as const).filter(
    (k) => !draft[k].trim()
  );

  return (
    <section className="rounded-3xl border border-line bg-panel p-6">
      <h2 className="text-base font-semibold">这批粮，怎么运最合适？</h2>

      {metaFailed && (
        <p className="mt-3 rounded-xl border border-amber-400/70 bg-brand-faint px-4 py-2 text-sm text-amber-300">
          线路基础数据未就绪
        </p>
      )}

      {!confirming ? (
        <div className="mt-4 flex flex-col gap-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例如：120 吨东北二等玉米，白城运到深圳港，8 月 30 日前到，稳妥一点"
            className="h-11 w-full rounded-full border border-line bg-rice px-5 text-sm text-ink placeholder:text-ink-soft/70"
          />
          <div className="flex flex-wrap items-center gap-2">
            {PREFERENCES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  setPreference(p.value);
                  setPreferenceTouched(true);
                }}
                className={`rounded-full border px-4 py-2 text-xs transition-colors ${
                  preference === p.value
                    ? "border-tech/40 bg-tech/10 text-tech"
                    : "border-line text-ink-soft hover:border-tech hover:text-ink"
                }`}
              >
                {p.label}
                <span className="ml-1.5 opacity-70">{p.hint}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={generate}
              disabled={!text.trim() || busy || metaFailed}
              className="ml-auto rounded-full bg-brand px-6 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {busy ? "理解需求中…" : "智能生成方案"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <RequirementConfirmCard
            draft={draft}
            nodes={meta?.nodes ?? []}
            varieties={meta?.varieties ?? []}
            missing={missing}
            onChange={setDraft}
            onConfirm={confirm}
            busy={busy}
            disabled={metaFailed}
          />
          {assumptions.length > 0 && (
            <ul className="space-y-1 text-xs text-ink-soft">
              {assumptions.map((a) => (
                <li key={a}>运小二理解：{a}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="self-start rounded-full border border-line px-5 py-2 text-xs text-ink-soft hover:border-tech hover:text-ink"
          >
            返回修改
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
