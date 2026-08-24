import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchMission } from "./api";
import type { MissionSnapshot } from "./types";
import MissionStart from "./MissionStart";
import GoalConfirmation from "./GoalConfirmation";
import TeamConfirmation from "./TeamConfirmation";
import MissionCockpit from "./MissionCockpit";
import HistoryView from "./HistoryView";
import "./zhanggui.css";

/** 粮掌柜独立服务页：按任务状态路由到目标确认 / 团队确认 / 指挥舱。 */
export default function ZhangguiPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mission, setMission] = useState<MissionSnapshot | null>(null);
  const [view, setView] = useState<"start" | "history">("start");
  const [loading, setLoading] = useState(true);

  const missionParam = searchParams.get("mission");

  useEffect(() => {
    if (!missionParam) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchMission(Number(missionParam))
      .then((snapshot) => {
        if (cancelled) return;
        setMission(snapshot);
      })
      .catch(() => {
        if (cancelled) return;
        setMission(null);
        setSearchParams({}, { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [missionParam, setSearchParams]);

  const openMission = useCallback(
    (snapshot: MissionSnapshot) => {
      setMission(snapshot);
      setView("start");
      setSearchParams({ mission: String(snapshot.id) });
    },
    [setSearchParams],
  );

  const backToStart = useCallback(() => {
    setMission(null);
    setView("start");
    setSearchParams({});
  }, [setSearchParams]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-ink-soft">
        正在恢复任务现场…
      </div>
    );
  }

  if (!mission && view === "history") {
    return <HistoryView onOpen={openMission} onBack={backToStart} />;
  }

  if (!mission) {
    return (
      <MissionStart
        onCreated={openMission}
        onOpenMission={openMission}
        onOpenHistory={() => setView("history")}
      />
    );
  }
  if (mission.status === "awaiting_goal_confirmation") {
    return <GoalConfirmation mission={mission} onConfirmed={setMission} />;
  }
  if (mission.status === "awaiting_team_confirmation") {
    return <TeamConfirmation mission={mission} onConfirmed={setMission} />;
  }
  return <MissionCockpit mission={mission} onMissionChange={setMission} onBack={backToStart} />;
}
