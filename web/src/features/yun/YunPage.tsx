import { useEffect, useState, type CSSProperties } from "react";
import AgentSwitcher from "../../components/AgentSwitcher";
import AgentPortrait from "../../components/AgentPortrait";
import { getAgent } from "../../data/agents";
import FindLogisticsTab from "./FindLogisticsTab";
import PlansTab from "./PlansTab";
import InquiryTab from "./InquiryTab";
import TasksTab from "./TasksTab";

const agent = getAgent("yun")!;

/** 运小二：找物流市场浏览 + 运输方案智能决策 + 运输任务 + 询运对接 */
export default function YunPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [taskId, setTaskIdRaw] = useState<number | null>(() => {
    const stored = localStorage.getItem("yun_active_task");
    return stored ? Number(stored) : null;
  });
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
        {activeTab === 0 && <FindLogisticsTab />}
        {activeTab === 1 && (
          <PlansTab
            taskId={taskId}
            prefill={null}
            onPrefillConsumed={() => {}}
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
