import { useState } from "react";
import AgentSwitcher from "../../components/AgentSwitcher";
import { getAgent } from "../../data/agents";
import FindLogisticsTab from "./FindLogisticsTab";
import PlansTab from "./PlansTab";
import InquiryTab from "./InquiryTab";
import TasksTab from "./TasksTab";
import type { QuickEstimateRecord } from "./types";

const agent = getAgent("yun")!;

/** 运小二｜找物流：智能受理 + 即时测算 + 运输方案 + 询运对接 + 运输任务 */
export default function YunPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [reuse, setReuse] = useState<QuickEstimateRecord | null>(null);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* 头部：身份 + tab 条 */}
      <div className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            <img
              src={agent.image}
              alt={agent.name}
              className="h-12 w-auto drop-shadow-[0_0_10px_rgba(63,157,110,0.35)]"
            />
            <h1 className="text-lg font-semibold">
              {agent.name}｜{agent.action}
              <span className="ml-2.5 rounded-full bg-brand-faint px-2.5 py-0.5 text-xs font-normal text-brand-deep">
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
                  i === activeTab ? "font-semibold text-brand-deep" : "text-ink-soft hover:text-ink"
                }`}
              >
                {tab}
                {i === activeTab && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容：跨 tab 保留当前任务上下文 */}
      <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6">
        {activeTab === 0 && (
          <FindLogisticsTab
            prefill={reuse}
            onPrefillConsumed={() => setReuse(null)}
            onTaskCreated={(id) => {
              setTaskId(id);
              setActiveTab(1);
            }}
          />
        )}
        {activeTab === 1 && (
          <PlansTab taskId={taskId} onInquiryCreated={() => setActiveTab(2)} />
        )}
        {activeTab === 2 && <InquiryTab taskId={taskId} />}
        {activeTab === 3 && (
          <TasksTab
            onOpenTask={(id) => {
              setTaskId(id);
              setActiveTab(1);
            }}
            onReuseEstimate={(rec) => {
              setReuse(rec);
              setActiveTab(0);
            }}
          />
        )}
      </div>
    </div>
  );
}
