import { useEffect, useState } from "react";
import { createMission, fetchMission, fetchMissions, previewGoal } from "./api";
import type { MissionSnapshot, MissionSummary } from "./types";
import StartHero from "./StartHero";
import StartInput from "./StartInput";
import StartCapabilities from "./StartCapabilities";
import StartWorkflow from "./StartWorkflow";
import StartExamples from "./StartExamples";
import StartRecent from "./StartRecent";
import StartStats from "./StartStats";

const DEMO_EXAMPLE = "未来15天采购200吨二等玉米到潍坊，预算不超过2680元/吨，不能影响生产";

interface MissionStartProps {
  onCreated(next: MissionSnapshot): void;
  onOpenMission(next: MissionSnapshot): void;
  onOpenHistory(): void;
}

/** 粮掌柜入口页：AI对话式工作台，聚焦目标输入 + 能力展示 + 场景引导。 */
export default function MissionStart({ onCreated, onOpenMission, onOpenHistory }: MissionStartProps) {
  const [text, setText] = useState(DEMO_EXAMPLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missions, setMissions] = useState<MissionSummary[]>([]);

  useEffect(() => {
    fetchMissions()
      .then(setMissions)
      .catch(() => setMissions([]));
  }, []);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const preview = await previewGoal(trimmed);
      const mission = await createMission(trimmed, preview.goal, preview.memory_references);
      onCreated(mission);
    } catch (err) {
      setError(err instanceof Error ? err.message : "目标解析失败，请稍后重试");
      setBusy(false);
    }
  }

  function openRecent(item: MissionSummary) {
    fetchMission(item.id).then(onOpenMission).catch(() => setError("任务打开失败"));
  }

  return (
    <div className="zg-start-page">
      <StartHero />
      <StartInput
        text={text}
        onChange={setText}
        onSubmit={handleSubmit}
        busy={busy}
        error={error}
        onFillExample={() => setText(DEMO_EXAMPLE)}
      />
      <StartCapabilities />
      <StartWorkflow />
      <StartExamples onSelect={setText} />
      <div className="zg-start-divider" />
      <StartRecent recents={missions.slice(0, 4)} onOpen={openRecent} onOpenHistory={onOpenHistory} />
      <StartStats missions={missions} />
    </div>
  );
}
