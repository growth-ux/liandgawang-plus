import { useEffect, useState } from "react";
import AgentSwitcher from "../../components/AgentSwitcher";
import { getAgent } from "../../data/agents";
import type { CostingRecord, SuanHandoff } from "./types";
import CostingTab from "./CostingTab";
import ProfitTab from "./ProfitTab";
import RecordsTab from "./RecordsTab";

const agent = getAgent("suan")!;
const TABS = ["成本测算", "盈亏推演", "测算记录"] as const;

export default function SuanPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [currentRecord, setCurrentRecord] = useState<CostingRecord | null>(null);
  const [pendingHandoff, setPendingHandoff] = useState<SuanHandoff | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("suan_pending_handoff");
    if (raw) {
      sessionStorage.removeItem("suan_pending_handoff");
      try {
        setPendingHandoff(JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }, []);

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
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* 头部 */}
      <div className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            <img
              src={agent.image}
              alt={agent.name}
              className="h-12 w-auto drop-shadow-[0_0_10px_rgba(122,107,192,0.35)]"
            />
            <div>
              <h1 className="text-lg font-semibold">
                {agent.name}｜{agent.action}
                <span className="ml-2.5 rounded-full bg-violet-400/15 px-2.5 py-0.5 text-xs font-normal text-violet-300">
                  {agent.role}
                </span>
              </h1>
            </div>
          </div>
          <AgentSwitcher currentId={agent.id} />
        </div>
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="flex gap-6">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`relative pb-3 pt-1 text-sm transition-colors ${
                  i === activeTab ? "font-semibold text-violet-300" : "text-ink-soft hover:text-ink"
                }`}
              >
                {tab}
                {i === activeTab && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6">
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
