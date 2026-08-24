import { useState } from "react";
import { confirmTeam } from "./api";
import type { MissionSnapshot } from "./types";

interface TeamConfirmationProps {
  mission: MissionSnapshot;
  onConfirmed(next: MissionSnapshot): void;
}

/** 团队确认闸门：展示按需组队的六位小二与参与原因。 */
export default function TeamConfirmation({ mission, onConfirmed }: TeamConfirmationProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = mission.team.filter((member) => member.selected).length;

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await confirmTeam(mission.id, mission.team);
      onConfirmed(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "团队确认失败");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1080px] px-6 py-10">
      <p className="text-xs tracking-[0.3em] text-tech">HUMAN-IN-THE-LOOP · 闸门 2/3</p>
      <h1 className="mt-2 text-xl font-semibold">确认协作团队</h1>
      <p className="mt-2 text-sm text-ink-soft">
        粮掌柜按目标按需组队：本次邀请 {selectedCount} 位小二并行办理，未参与的小二会说明原因。
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {mission.team.map((member) => (
          <div
            key={member.agent_id}
            className={`rounded-2xl border px-4 py-4 ${
              member.selected ? "border-tech/30 bg-panel" : "border-line bg-panel/50 opacity-80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{member.name}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                  member.selected ? "bg-tech/10 text-tech" : "bg-rice-deep text-ink-soft"
                }`}
              >
                {member.selected ? "参与办理" : "保持待命"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-ink-soft">{member.reason}</p>
            {member.selected && member.expected_output && (
              <p className="mt-2 text-xs text-tech/80">预期产出：{member.expected_output}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
        >
          {busy ? "正在启动协作…" : `确认团队，开始并行办理（${selectedCount} 位）`}
        </button>
        {error && <span className="text-sm text-red-300">{error}</span>}
      </div>
    </div>
  );
}
