import { useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import AgentSwitcher from "../../components/AgentSwitcher";
import AgentPortrait from "../../components/AgentPortrait";
import { getAgent } from "../../data/agents";
import type { CostingRecord, SuanHandoff } from "./types";
import CostingTab from "./CostingTab";
import ProfitTab from "./ProfitTab";
import RecordsTab from "./RecordsTab";
import { acceptHandoff, fetchHandoff, ignoreHandoff, type AgentHandoff } from "../handoff/api";

const agent = getAgent("suan")!;
const TABS = ["成本测算", "盈亏推演", "测算记录"] as const;

export default function SuanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(0);
  const [currentRecord, setCurrentRecord] = useState<CostingRecord | null>(null);
  const [pendingHandoff, setPendingHandoff] = useState<SuanHandoff | null>(null);
  const [incoming, setIncoming] = useState<AgentHandoff | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("suan_pending_handoff");
    if (raw) {
      sessionStorage.removeItem("suan_pending_handoff");
      try {
        setPendingHandoff(JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const id = Number(searchParams.get("handoff"));
    if (!id) return;
    fetchHandoff(id).then((handoff) => {
      if (handoff.target_agent === "suan" && handoff.status === "pending") setIncoming(handoff);
    }).catch(() => {});
  }, [searchParams]);

  const acceptIncoming = async () => {
    if (!incoming) return;
    const accepted = await acceptHandoff(incoming.id);
    const payload = accepted.payload as unknown as SuanHandoff;
    setPendingHandoff(payload);
    setIncoming(null);
    setActiveTab(0);
    setSearchParams({}, { replace: true });
  };

  const onRecordSaved = (record: CostingRecord) => {
    setCurrentRecord(record);
  };

  const onOpenProfit = (record: CostingRecord) => {
    setCurrentRecord(record);
    setActiveTab(1);
  };

  const onRecordUpdated = (record: CostingRecord) => {
    setCurrentRecord(record);
  };

  const onBackToCosting = () => {
    setActiveTab(0);
  };

  const onOpenRecord = (record: CostingRecord) => {
    setCurrentRecord(record);
    setActiveTab(0);
  };

  const onClearHandoff = () => {
    setPendingHandoff(null);
  };

  return (
    <div className="agent-theme-page flex min-h-[calc(100vh-4rem)] flex-col" style={{ "--agent-accent": agent.accent } as CSSProperties}>
      {/* 头部 */}
      <div className="agent-theme-header border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            <AgentPortrait agent={agent} />
            <div>
              <h1 className="text-lg font-semibold tracking-wide">
                {agent.name}｜{agent.action}
                <span className="agent-theme-tag ml-2.5 rounded-full px-2.5 py-0.5 text-xs font-normal">
                  {agent.role}
                </span>
              </h1>
              <p className="mt-0.5 text-xs text-ink-soft">汇总粮源、物流与资金报价 · 测算到厂成本与单笔业务盈亏</p>
            </div>
          </div>
          <AgentSwitcher currentId={agent.id} />
        </div>
        <div className="mx-auto flex max-w-[1280px] items-end justify-between px-6">
          <nav className="flex gap-7" aria-label="算小二功能">
            {TABS.map((tab, i) => (
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
                  <span className="agent-theme-tab-line absolute inset-x-1 -bottom-px h-0.5 rounded-full" />
                )}
              </button>
            ))}
          </nav>
          <div className="mb-3 hidden items-center gap-2 text-xs text-ink-soft md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            成本模型运行正常
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6">
        {incoming && <section className="mb-4 rounded-2xl border border-violet-400/30 bg-violet-400/[0.06] px-5 py-4"><p className="text-xs tracking-[0.18em] text-violet-300">INCOMING HANDOFF · {incoming.handoff_code}</p><h2 className="mt-1 text-sm font-semibold">{incoming.title}</h2><p className="mt-1 text-xs text-ink-soft">{incoming.summary}</p><div className="mt-3 flex gap-2"><button type="button" onClick={acceptIncoming} className="rounded-full bg-violet-500 px-4 py-1.5 text-xs font-medium text-white">确认接收</button><button type="button" onClick={async () => { await ignoreHandoff(incoming.id); setIncoming(null); setSearchParams({}, { replace: true }); }} className="rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft">忽略</button></div></section>}
        {activeTab === 0 && (
          <CostingTab
            pendingHandoff={pendingHandoff}
            onClearHandoff={onClearHandoff}
            currentRecord={currentRecord}
            onRecordSaved={onRecordSaved}
            onOpenProfit={onOpenProfit}
          />
        )}
        {activeTab === 1 && (
          currentRecord ? (
            <ProfitTab
              record={currentRecord}
              onRecordUpdated={onRecordUpdated}
              onBackToCosting={onBackToCosting}
            />
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
              <p className="text-sm text-ink-soft">请先在「成本测算」中保存记录并选择方案</p>
            </div>
          )
        )}
        {activeTab === 2 && (
          <RecordsTab
            onOpenRecord={onOpenRecord}
            onOpenProfit={onOpenProfit}
          />
        )}
      </div>
    </div>
  );
}
