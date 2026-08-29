import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import AgentSwitcher from "../../components/AgentSwitcher";
import AgentPortrait from "../../components/AgentPortrait";
import { getAgent } from "../../data/agents";
import { initialVerifications, partners, reviewRecords } from "./data";
import RiskCheckTab from "./RiskCheckTab";
import ReviewRecordsTab from "./ReviewRecordsTab";
import VerificationTab from "./VerificationTab";
import NewRiskReviewDialog from "./NewRiskReviewDialog";
import { partnerFromHandoff, readRiskHandoff } from "./handoff";
import { reviewPartnerSummary } from "./api";
import type { Partner, RiskItem, VerificationItem, VerificationStatus } from "./types";
import type { RiskHandoffDraft } from "./handoff";
import { acceptHandoff, fetchHandoff, ignoreHandoff, type AgentHandoff } from "../handoff/api";

const agent = getAgent("an")!;
const TABS = ["合作方体检", "待办核验", "风控记录"] as const;

/** 安小二：三类合作方统一风控，形成体检、核验、经验沉淀闭环。 */
export default function AnPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [handoffDraft, setHandoffDraft] = useState<RiskHandoffDraft | null>(() => (
    new URLSearchParams(window.location.search).get("from") === "handoff" ? readRiskHandoff() : null
  ));
  const [incoming, setIncoming] = useState<AgentHandoff | null>(null);
  useEffect(() => {
    const id = Number(searchParams.get("handoff"));
    if (!id) return;
    fetchHandoff(id).then((handoff) => {
      if (handoff.target_agent === "an" && handoff.status === "pending") setIncoming(handoff);
    }).catch(() => {});
  }, [searchParams]);
  const acceptIncoming = async () => {
    if (!incoming) return;
    const accepted = await acceptHandoff(incoming.id);
    const payload = accepted.payload.draft as RiskHandoffDraft | undefined;
    if (payload) setHandoffDraft(payload);
    setIncoming(null);
    setSearchParams({}, { replace: true });
  };
  const [independentPartner, setIndependentPartner] = useState<Partner | null>(null);
  const partnerList = useMemo(() => {
    const result = [...partners];
    if (independentPartner) result.unshift(independentPartner);
    if (handoffDraft) result.unshift(partnerFromHandoff(handoffDraft));
    return result;
  }, [handoffDraft, independentPartner]);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedPartnerId, setSelectedPartnerId] = useState(() => handoffDraft ? `H-${handoffDraft.id}` : partners[0].id);
  const [verifications, setVerifications] = useState<VerificationItem[]>(initialVerifications);
  const [newReviewOpen, setNewReviewOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  /** 独立发起体检：先展示确定性风险项，体检结论由大模型现场生成。 */
  const startIndependentReview = (partnerId: string) => {
    // 容错：传入的是体检副本 id（I-前缀）时回退到基础合作方，避免点击无响应
    const baseId = partnerId.startsWith("I-") ? partnerId.slice(2) : partnerId;
    const base = partners.find((partner) => partner.id === baseId);
    if (!base) return;
    const independent: Partner = {
      ...base,
      id: `I-${base.id}`,
      sourceAgent: "系统合作方资料",
      sourceTask: "独立发起 · 未关联业务任务",
      summary: "本次未关联具体业务方案。以下判断基于合作方基础资料和企业历史经验；进入实际交易前，仍需结合本次价格、数量和交付条件重新核验。",
    };
    setIndependentPartner(independent);
    setSelectedPartnerId(independent.id);
    setActiveTab(0);
    setNewReviewOpen(false);
    setSummaryLoading(true);
    reviewPartnerSummary(independent)
      .then((result) => setIndependentPartner(
        (current) => (current && current.id === independent.id ? { ...current, summary: result.summary } : current),
      ))
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  };

  const addVerification = (partnerId: string, risk: RiskItem) => {
    if (verifications.some((item) => item.riskId === risk.id)) {
      setActiveTab(1);
      return;
    }
    const partner = partnerList.find((item) => item.id === partnerId)!;
    setVerifications((items) => [
      ...items,
      {
        id: `V-${String(items.length + 84).padStart(3, "0")}`,
        partnerId,
        partnerName: partner.name,
        riskId: risk.id,
        title: risk.action,
        level: risk.level,
        request: risk.description,
        sourceAgent: partner.sourceAgent,
        status: "pending",
      },
    ]);
  };

  const updateVerification = (id: string, status: VerificationStatus, note?: string) => {
    setVerifications((items) => items.map((item) => (
      item.id === id ? { ...item, status, note: note || item.note } : item
    )));
  };

  return (
    <div className="agent-theme-page flex min-h-[calc(100vh-4rem)] flex-col" style={{ "--agent-accent": agent.accent } as CSSProperties}>
      <header className="agent-theme-header relative z-30 border-b border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            <AgentPortrait agent={agent} />
            <div>
              <h1 className="text-lg font-semibold tracking-wide">
                {agent.name}｜{agent.action}
                <span className="agent-theme-tag ml-2.5 rounded-full px-2.5 py-0.5 text-xs font-normal">
                  合作方风控
                </span>
              </h1>
              <p className="mt-0.5 text-xs text-ink-soft">独立核验粮源、物流与资金服务方 · 结论均附判断依据</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setNewReviewOpen(true)} className="agent-theme-action rounded-full border px-4 py-2 text-xs">＋ 新建体检</button>
            <AgentSwitcher currentId={agent.id} />
          </div>
        </div>

        <div className="mx-auto flex max-w-[1280px] items-end justify-between px-6">
          <nav className="flex gap-7" aria-label="安小二功能">
            {TABS.map((tab, index) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(index)}
                className={`relative pb-3 pt-1 text-sm transition-colors ${
                  index === activeTab ? "agent-theme-tab-active font-semibold" : "text-ink-soft hover:text-ink"
                }`}
              >
                {tab}
                {tab === "待办核验" && verifications.some((item) => item.status === "pending") && (
                  <span className="ml-1.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                    {verifications.filter((item) => item.status === "pending").length}
                  </span>
                )}
                {index === activeTab && <span className="agent-theme-tab-line absolute inset-x-1 -bottom-px h-0.5" />}
              </button>
            ))}
          </nav>
          <div className="mb-3 hidden items-center gap-2 text-[11px] text-ink-soft md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            风控规则运行正常
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6">
        {incoming && <section className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] px-5 py-4"><p className="text-xs tracking-[0.18em] text-emerald-300">INCOMING HANDOFF · {incoming.handoff_code}</p><h2 className="mt-1 text-sm font-semibold">{incoming.title}</h2><p className="mt-1 text-xs text-ink-soft">{incoming.summary}</p><div className="mt-3 flex gap-2"><button type="button" onClick={acceptIncoming} className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-medium text-slate-950">确认接收并开始核验</button><button type="button" onClick={async () => { await ignoreHandoff(incoming.id); setIncoming(null); setSearchParams({}, { replace: true }); }} className="rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft">忽略</button></div></section>}
        {handoffDraft && activeTab === 0 && selectedPartnerId === `H-${handoffDraft.id}` && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tech/20 bg-tech/[0.06] px-4 py-3 text-xs">
            <div><span className="font-medium text-tech">已接收{handoffDraft.sourceAgent}交接</span><span className="ml-2 text-ink-soft">当前页面数据来自“{handoffDraft.sourceTask}”的业务结果快照。</span></div>
            <span className="rounded-full bg-tech/10 px-2.5 py-1 text-[10px] text-tech">业务结果已带入</span>
          </div>
        )}
        {activeTab === 0 && (
          <RiskCheckTab
            partners={partnerList}
            selectedPartnerId={selectedPartnerId}
            onSelectPartner={setSelectedPartnerId}
            addedRiskIds={new Set(verifications.map((item) => item.riskId))}
            onAddVerification={addVerification}
            onOpenVerifications={() => setActiveTab(1)}
            onNewReview={() => setNewReviewOpen(true)}
            summaryLoading={summaryLoading}
          />
        )}
        {activeTab === 1 && (
          <VerificationTab items={verifications} onUpdate={updateVerification} />
        )}
        {activeTab === 2 && (
          <ReviewRecordsTab
            records={reviewRecords}
            onRecheck={(partnerId) => {
              setSelectedPartnerId(partnerId);
              setActiveTab(0);
            }}
          />
        )}
      </main>
      {newReviewOpen && (
        <NewRiskReviewDialog
          partners={partnerList}
          onClose={() => setNewReviewOpen(false)}
          onConfirm={startIndependentReview}
        />
      )}
    </div>
  );
}
