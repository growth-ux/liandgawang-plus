import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import AgentFlowSvg, {
  AGENT_POSITIONS,
  HUB_POSITION,
  STAGE_VIEW,
} from "./AgentFlowSvg";
import AgentPod from "./AgentPod";
import StageBackdrop, { IpPedestal, type StageFeedback } from "./StageBackdrop";
import IpPortrait from "./IpPortrait";
import { getAgent } from "../../data/agents";
import type { AgentRun, CollaborationSnapshot } from "./types";
import "./ip-stage.css";

export interface SpatialAgentStageProps {
  mission: CollaborationSnapshot;
  title?: string;
  subtitle?: string;
  hubSummary?: string;
  hubLabel?: string;
  purchaseMode?: boolean;
  liveRuns?: Record<string, AgentRun["status"]>;
  selectedAgentId: string | null;
  onSelectAgent(id: string): void;
  /** 任务或阶段身份变化时，建立新的状态基线，不播放历史回传。 */
  animationKey?: string | number;
  visible?: boolean;
  onSelectHub?(): void;
  hubAction?: string;
  agentActions?: Record<string, string>;
}

const FEEDBACK_DURATION = 2200;
type StageStatus = AgentRun["status"] | "standby";

export default function SpatialAgentStage({
  mission,
  liveRuns,
  selectedAgentId,
  onSelectAgent,
  title,
  subtitle,
  hubSummary,
  hubLabel,
  purchaseMode,
  animationKey = "stage",
  visible = true,
  onSelectHub,
  hubAction,
  agentActions,
}: SpatialAgentStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(STAGE_VIEW.width);
  const [pageVisible, setPageVisible] = useState(
    () => document.visibilityState === "visible",
  );
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [finePointer, setFinePointer] = useState(
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  const [feedback, setFeedback] = useState<Record<string, StageFeedback>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const previous = useRef<{
    key: string | number;
    enabled: boolean;
    statuses: Record<string, StageStatus>;
  } | null>(null);
  const narrow = width < 720;
  // 场景是核心内容，按可用宽度缩放，不受首屏剩余高度限制。
  const scale = Math.min(width / STAGE_VIEW.width, 0.8);
  const animationEnabled = visible && pageVisible && !reducedMotion;

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateVisibility = () =>
      setPageVisible(document.visibilityState === "visible");
    const updateMedia = () => {
      setReducedMotion(reduced.matches);
      setFinePointer(pointer.matches);
    };
    document.addEventListener("visibilitychange", updateVisibility);
    reduced.addEventListener("change", updateMedia);
    pointer.addEventListener("change", updateMedia);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      reduced.removeEventListener("change", updateMedia);
      pointer.removeEventListener("change", updateMedia);
    };
  }, []);

  const members = Object.keys(AGENT_POSITIONS).map(
    (id) =>
      mission.team.find((member) => member.agent_id === id) ?? {
        agent_id: id,
        name: getAgent(id)?.name ?? id,
        selected: false,
        reason: "按需加入专业协作",
      },
  );
  const statuses = Object.fromEntries(
    members.map((member) => [
      member.agent_id,
      member.selected
        ? (liveRuns?.[member.agent_id] ??
          mission.agent_runs.find((run) => run.agent_id === member.agent_id)
            ?.status ??
          "pending")
        : "standby",
    ]),
  ) as Record<string, StageStatus>;
  const statusSignature = JSON.stringify(statuses);

  useEffect(() => {
    const nextStatuses = JSON.parse(statusSignature) as Record<
      string,
      StageStatus
    >;
    const old = previous.current;
    const clearFeedback = () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
      setFeedback({});
    };
    if (
      !old ||
      old.key !== animationKey ||
      old.enabled !== animationEnabled ||
      !animationEnabled
    ) {
      clearFeedback();
    } else {
      for (const [id, status] of Object.entries(nextStatuses)) {
        const completed =
          status === "completed" || status === "completed_with_objection";
        const cue: StageFeedback | undefined =
          status === "running" && old.statuses[id] !== "running"
            ? "dispatch"
            : status === "completed_with_objection" &&
                old.statuses[id] !== status
              ? "conflict"
              : old.statuses[id] === "running" && completed
                ? "return"
                : undefined;
        if (cue) {
          const timer = timers.current.get(id);
          if (timer) clearTimeout(timer);
          setFeedback((current) => ({ ...current, [id]: cue }));
          timers.current.set(
            id,
            setTimeout(() => {
              timers.current.delete(id);
              setFeedback((current) => {
                const next = { ...current };
                delete next[id];
                return next;
              });
            }, FEEDBACK_DURATION),
          );
        } else if (old.statuses[id] !== status && timers.current.has(id)) {
          clearTimeout(timers.current.get(id));
          timers.current.delete(id);
          setFeedback((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
        }
      }
    }
    previous.current = {
      key: animationKey,
      enabled: animationEnabled,
      statuses: nextStatuses,
    };
  }, [statusSignature, animationKey, animationEnabled]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );
  const resetParallax = () => {
    sceneRef.current?.style.setProperty("--parallax-x", "0px");
    sceneRef.current?.style.setProperty("--parallax-y", "0px");
  };
  useEffect(() => {
    if (!animationEnabled || !finePointer || narrow) resetParallax();
  }, [animationEnabled, finePointer, narrow]);
  function moveParallax(event: PointerEvent<HTMLDivElement>) {
    if (
      !animationEnabled ||
      !finePointer ||
      narrow ||
      event.pointerType !== "mouse"
    )
      return;
    const box = event.currentTarget.getBoundingClientRect();
    sceneRef.current?.style.setProperty(
      "--parallax-x",
      `${((event.clientX - box.left) / box.width - 0.5) * 8}px`,
    );
    sceneRef.current?.style.setProperty(
      "--parallax-y",
      `${((event.clientY - box.top) / box.height - 0.5) * 4}px`,
    );
  }
  const Hub = onSelectHub ? "button" : "div";
  const selectedMembers = members.filter((member) => member.selected);
  const completedCount = selectedMembers.filter((member) =>
    ["completed", "completed_with_objection"].includes(
      statuses[member.agent_id],
    ),
  ).length;
  const centralSummary =
    hubSummary ??
    (mission.recommendation
      ? `主推方案 ${mission.recommendation.primary_scheme_id}`
      : mission.status === "running"
        ? "正在汇总各专业结果…"
        : "等待任务推进");
  const visibleFeedback =
    animationEnabled && previous.current?.key === animationKey ? feedback : {};
  const returningAgentIds = Object.keys(visibleFeedback).filter(
    (id) => visibleFeedback[id] !== "dispatch",
  );
  const dispatchingAgentIds = Object.keys(visibleFeedback).filter(
    (id) => visibleFeedback[id] === "dispatch",
  );

  return (
    <section
      className="zg-spatial-stage"
      ref={stageRef}
      data-paused={!animationEnabled || undefined}
      data-layout={narrow ? "grid" : "stage"}
      aria-label="粮掌柜 IP 协作舞台"
    >
      <header className="zg-stage-meta">
        <div className="zg-stage-heading">
          <p className="zg-stage-title">{title ?? "粮掌柜 · 专业协作舞台"}</p>
          <p className="zg-stage-subtitle">
            {subtitle ?? "专业小二独立研判，粮掌柜汇总冲突与行动条件"}
          </p>
        </div>
        <div className="zg-stage-stats" aria-label="协作状态">
          <span>
            {purchaseMode && selectedMembers.length === 0 ? (
              "粮掌柜主理 · 待确认需求"
            ) : (
              <>
                <strong>{selectedMembers.length}</strong> 位协作
              </>
            )}
          </span>
          {(!purchaseMode || selectedMembers.length > 0) && (
            <span>
              <strong>{completedCount}</strong> 位完成
            </span>
          )}
          <span data-alert={mission.conflicts.length > 0 || undefined}>
            <strong>{mission.conflicts.length}</strong> 项冲突
          </span>
        </div>
      </header>
      <div
        className="zg-stage-viewport"
        style={
          narrow ? undefined : { height: `${STAGE_VIEW.height * scale}px` }
        }
        onPointerMove={moveParallax}
        onPointerLeave={resetParallax}
      >
        <div
          className="zg-stage-canvas"
          style={{ "--stage-scale": scale } as CSSProperties}
        >
          <div className="zg-stage-scene" ref={sceneRef}>
            <StageBackdrop />
            <AgentFlowSvg
              mission={mission}
              liveRuns={liveRuns}
              returningAgentIds={returningAgentIds}
              dispatchingAgentIds={dispatchingAgentIds}
            />
            <Hub
              className="zg-stage-hub"
              type={onSelectHub ? "button" : undefined}
              onClick={onSelectHub}
              aria-label={onSelectHub ? `粮掌柜，${hubAction}` : undefined}
              aria-haspopup={onSelectHub ? "dialog" : undefined}
              data-interactive={Boolean(onSelectHub)}
              data-processing={mission.status === "running" || undefined}
              style={
                {
                  "--x": `${HUB_POSITION.x}px`,
                  "--y": `${HUB_POSITION.y}px`,
                  "--depth": HUB_POSITION.y,
                } as CSSProperties
              }
            >
              <span className="zg-ip-figure">
                <IpPedestal central feedback={visibleFeedback} />
                <IpPortrait
                  agentId="da"
                  name="商务男与粮掌柜协作"
                  image="/images/agents/liangdawang-plus-collaboration-duo-v1.png?v=zhanggui-tall-v2"
                />
              </span>
              <span className="zg-hub-caption">
                <strong>{hubLabel ?? "粮掌柜 · 中央编排"}</strong>
                <span className="zg-hub-summary" title={centralSummary}>
                  {centralSummary}
                </span>
                {hubAction && (
                  <span className="zg-pod-action">
                    {hubAction} <span aria-hidden="true">↗</span>
                  </span>
                )}
              </span>
            </Hub>
            {members.map((member) => (
              <AgentPod
                key={member.agent_id}
                agent={member}
                run={mission.agent_runs.find(
                  (run) => run.agent_id === member.agent_id,
                )}
                effectiveStatus={
                  statuses[member.agent_id] === "standby"
                    ? undefined
                    : (statuses[member.agent_id] as AgentRun["status"])
                }
                participating={member.selected}
                active={selectedAgentId === member.agent_id}
                feedback={visibleFeedback[member.agent_id]}
                x={AGENT_POSITIONS[member.agent_id].x}
                y={AGENT_POSITIONS[member.agent_id].y}
                onClick={() => onSelectAgent(member.agent_id)}
                standbyLabel={purchaseMode ? "本步待命" : "待命"}
                disabled={purchaseMode && !member.selected}
                actionLabel={
                  member.selected ? agentActions?.[member.agent_id] : undefined
                }
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
