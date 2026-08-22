import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getAgent, taskStatuses } from "../../data/agents";
import AgentAvatar from "../../components/AgentAvatar";
import AgentSwitcher from "../../components/AgentSwitcher";
import ZhanPage from "../../features/zhan/ZhanPage";

/** 七位小二共用的专业服务页模板（轻占位） */
export default function AgentServicePage() {
  const { id } = useParams();
  const agent = getAgent(id);
  const [activeTab, setActiveTab] = useState(0);

  if (!agent) return <Navigate to="/" replace />;
  if (agent.id === "zhan") return <ZhanPage />;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* 页面头部：当前小二身份与服务范围 + 切换小二 */}
      <div className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            <AgentAvatar agent={agent} size={48} />
            <div>
              <h1 className="text-lg font-semibold">
                {agent.name}｜{agent.action}
                <span className="ml-2.5 rounded-full bg-brand-faint px-2.5 py-0.5 text-xs font-normal text-brand-deep">
                  {agent.role}
                </span>
              </h1>
              <p className="mt-0.5 text-xs text-ink-soft">
                场景位置：{agent.zone} · 视觉符号：{agent.symbol}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled
              title="协作能力建设中"
              className="rounded-full border border-dashed border-line px-4 py-2 text-sm text-ink-soft opacity-70"
            >
              邀请其他小二协作
            </button>
            <AgentSwitcher currentId={agent.id} />
          </div>
        </div>

        {/* 页内 Tab */}
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

      {/* 占位正文 */}
      <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8">
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <AgentAvatar agent={agent} size={64} />
          <h2 className="mt-4 text-lg font-semibold">
            「{agent.name}｜{agent.action}」的 {agent.tabs[activeTab]} 正在建设中
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
            本页将提供{agent.role}的完整专业服务。当前为原型占位，
            功能按设计文档逐步落地。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 px-6">
            <span className="mr-1 text-xs text-ink-soft">共通任务状态：</span>
            {taskStatuses.map((s) => (
              <span
                key={s.label}
                title={s.desc}
                className={`rounded-full px-3 py-1 text-xs font-medium ${s.tone}`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 底部：面向当前小二的自然语言输入（占位，未接通） */}
      <div className="sticky bottom-0 border-t border-line bg-panel/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-6 py-3">
          <input
            type="text"
            disabled
            placeholder={`向${agent.name}描述你的${agent.action.replace("找", "").replace("看", "").replace("算", "").replace("查", "").replace("帮我", "")}需求…`}
            className="h-11 flex-1 rounded-full border border-line bg-rice px-5 text-sm text-ink placeholder:text-ink-soft/70"
          />
          <button
            type="button"
            disabled
            className="h-11 rounded-full bg-brand px-7 text-sm font-medium text-white opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
