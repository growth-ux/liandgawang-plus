import { useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import AgentSwitcher from "../../components/AgentSwitcher";
import AgentPortrait from "../../components/AgentPortrait";
import { getAgent } from "../../data/agents";
import FindLogisticsTab from "./FindLogisticsTab";
import PlansTab from "./PlansTab";
import InquiryTab from "./InquiryTab";
import TasksTab from "./TasksTab";
import type { TransportPlanPrefill } from "./types";
import { acceptHandoff, fetchHandoff, ignoreHandoff, type AgentHandoff } from "../handoff/api";

const agent = getAgent("yun")!;

/** 运小二：物流市场浏览 + 运输方案智能决策 + 运输任务 + 询运对接 */
export default function YunPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(0);
  const [taskId, setTaskIdRaw] = useState<number | null>(() => {
    const stored = localStorage.getItem("yun_active_task");
    return stored ? Number(stored) : null;
  });
  const [pendingHandoff, setPendingHandoff] = useState<AgentHandoff | null>(null);
  const [prefill, setPrefill] = useState<TransportPlanPrefill | null>(null);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const setTaskId = (id: number | null) => {
    setTaskIdRaw(id);
    if (id != null) {
      localStorage.setItem("yun_active_task", String(id));
    } else {
      localStorage.removeItem("yun_active_task");
    }
  };

  // 页面加载时校验 taskId 是否仍存在，不存在则清除
  useEffect(() => {
    if (taskId == null) return;
    fetch(`/api/logistics/tasks/${taskId}`).then((r) => {
      if (!r.ok) {
        setTaskId(null);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = Number(searchParams.get("handoff"));
    if (!id) return;
    fetchHandoff(id).then((handoff) => {
      if (handoff.target_agent === "yun" && handoff.status === "pending") setPendingHandoff(handoff);
    }).catch(() => {});
  }, [searchParams]);

  const acceptIncoming = async () => {
    if (!pendingHandoff) return;
    setHandoffBusy(true);
    try {
      const accepted = await acceptHandoff(pendingHandoff.id);
      const payload = accepted.payload;
      setPrefill({
        origin: typeof payload.origin === "string" ? payload.origin : "",
        destination: typeof payload.destination === "string" ? payload.destination : "",
        variety_code: typeof payload.variety_code === "string" ? payload.variety_code : "corn",
        quantity_tons: typeof payload.quantity_tons === "number" ? payload.quantity_tons : 0,
        deadline_date: typeof payload.deadline_date === "string" ? payload.deadline_date : null,
      });
      setTaskId(null);
      setActiveTab(1);
      setPendingHandoff(null);
      setSearchParams({}, { replace: true });
    } finally { setHandoffBusy(false); }
  };

  return (
    <div className="agent-theme-page flex min-h-[calc(100vh-4rem)] flex-col" style={{ "--agent-accent": agent.accent } as CSSProperties}>
      {/* 头部：身份 + tab 条 */}
      <div className="agent-theme-header border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            <AgentPortrait agent={agent} />
            <h1 className="text-lg font-semibold">
              {agent.name}｜{agent.action}
              <span className="agent-theme-tag ml-2.5 rounded-full px-2.5 py-0.5 text-xs font-normal">
                {agent.role}
              </span>
            </h1>
          </div>
          <AgentSwitcher currentId={agent.id} />
        </div>
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="flex gap-6">
            {agent.tabs.map((tab, i) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`relative pb-3 pt-1 text-sm transition-colors ${
                  i === activeTab ? "agent-theme-tab-active font-semibold" : "text-ink-soft hover:text-ink"
                }`}
              >
                {tab}
                {i === activeTab && (
                  <span className="agent-theme-tab-line absolute inset-x-2 -bottom-px h-0.5 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容：跨 tab 保留当前任务上下文 */}
      <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6">
        {pendingHandoff && (
          <section className="mb-4 rounded-2xl border border-tech/30 bg-tech/[0.06] px-5 py-4">
            <p className="text-xs tracking-[0.18em] text-tech">INCOMING HANDOFF · {pendingHandoff.handoff_code}</p>
            <h2 className="mt-1 text-sm font-semibold">来自粮小二：{pendingHandoff.title}</h2>
            <p className="mt-1 text-xs leading-5 text-ink-soft">{pendingHandoff.summary}</p>
            <div className="mt-3 flex gap-2"><button type="button" disabled={handoffBusy} onClick={acceptIncoming} className="rounded-full bg-tech px-4 py-1.5 text-xs font-medium text-slate-950 disabled:opacity-50">确认接收并生成运输需求</button><button type="button" disabled={handoffBusy} onClick={async () => { await ignoreHandoff(pendingHandoff.id); setPendingHandoff(null); setSearchParams({}, { replace: true }); }} className="rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft">忽略</button></div>
          </section>
        )}
        {activeTab === 0 && <FindLogisticsTab />}
        {activeTab === 1 && (
          <PlansTab
            taskId={taskId}
            prefill={prefill}
            onPrefillConsumed={() => setPrefill(null)}
            onTaskCreated={(id) => setTaskId(id)}
            onNewTask={() => setTaskId(null)}
            onInquiryCreated={() => setActiveTab(3)}
          />
        )}
        {activeTab === 2 && (
          <TasksTab
            onOpenTask={(id) => {
              setTaskId(id);
              setActiveTab(1);
            }}
          />
        )}
        {activeTab === 3 && <InquiryTab />}
      </div>
    </div>
  );
}
