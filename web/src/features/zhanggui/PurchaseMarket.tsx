import { useState } from "react";
import type { MarketDecision, Purchase, PurchaseNeed } from "./purchaseModel";
import { assessPurchaseMarket } from "./marketAssessment";
import PurchaseMarketTrend from "./PurchaseMarketTrend";
import PurchaseAdvicePanel from "./PurchaseAdvicePanel";
import PurchaseMarketFacts, { MARKET_EVIDENCE_TABS, type MarketEvidenceTab } from "./PurchaseMarketFacts";
import type { MarketSelection, PurchaseAdvice } from "./purchaseAdvice";
import type { MarketOverview } from "../zhan/types";

const ACTION_LABELS = {
  buy: "继续采购",
  adjust: "调整需求",
  watch: "暂时观望",
  inherited: "沿用原方案研判",
};

export default function PurchaseMarket({
  purchase,
  need,
  readonly,
  onDecide,
}: {
  purchase: Purchase | null;
  need: PurchaseNeed;
  readonly: boolean;
  onDecide(action: "buy" | "adjust" | "watch", advice?: PurchaseAdvice): void;
}) {
  const [selection, setSelection] = useState<MarketSelection>("loading");
  const [advice, setAdvice] = useState<PurchaseAdvice | null>(null);
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [evidenceTab, setEvidenceTab] = useState<MarketEvidenceTab>("spot");
  const decision = purchase?.marketDecision;
  const assessedNeed = readonly && decision ? decision.assessedNeed : need;
  const assessment = assessPurchaseMarket(assessedNeed);
  const valid =
    Number.isInteger(assessedNeed.stockDays ?? 7) &&
    (assessedNeed.stockDays ?? 7) >= 1 &&
    (assessedNeed.stockDays ?? 7) <= 365;
  if (readonly && (!decision || decision.action === "inherited"))
    return (
      <div className="pw-info">
        <strong>
          {decision
            ? "本笔采购沿用原方案行情研判"
            : "历史采购未单独记录行情确认"}
        </strong>
        <p>
          {decision?.summary ??
            "这笔采购在新增行情阶段之前已经开始，原有进度已保留，未补记用户确认。"}
        </p>
      </div>
    );
  return (
    <>
      {decision && <DecisionRecord decision={decision} compact={!readonly} />}
      <section className="pw-market-layer pw-market-facts-layer" aria-labelledby="pw-market-facts-title">
        <header className="pw-market-layer-heading">
          <span>01</span>
          <div>
            <h2 id="pw-market-facts-title">市场事实</h2>
            <p>原始行情与公开事件，保留时间、区域和价格口径</p>
          </div>
        </header>
        <div className="pw-market-evidence-tabs" role="tablist" aria-label="行情证据类型">
          {MARKET_EVIDENCE_TABS.map((tab) => (
            <button key={tab.id} id={`pw-market-tab-${tab.id}`} type="button" role="tab"
              aria-selected={evidenceTab === tab.id} aria-controls="pw-market-evidence-panel"
              onClick={() => setEvidenceTab(tab.id)}>{tab.label}</button>
          ))}
        </div>
        <div id="pw-market-evidence-panel" role="tabpanel"
          aria-labelledby={`pw-market-tab-${evidenceTab}`} className="pw-market-evidence-panel">
          <div hidden={evidenceTab !== "spot"}>
            <PurchaseMarketTrend
              key={assessedNeed.variety}
              variety={assessedNeed.variety}
              asOf={readonly && decision ? decision.decidedAt.slice(0, 10) : undefined}
              onContextChange={setSelection}
              onOverviewChange={setOverview}
            />
          </div>
          <PurchaseMarketFacts overview={overview} need={assessedNeed}
            quoteLow={assessment.low} quoteHigh={assessment.high}
            selectedSpotCode={typeof selection === "object" ? selection.spot_code : undefined}
            activeTab={evidenceTab} />
        </div>
      </section>
      <section className="pw-market-layer pw-market-ai-layer" aria-labelledby="pw-market-ai-title">
        <header className="pw-market-layer-heading">
          <span>02</span>
          <div>
            <h2 id="pw-market-ai-title">AI 采购研判</h2>
            <p>结合市场事实与本单库存、交期、预算，形成可执行建议</p>
          </div>
        </header>
        {valid ? <PurchaseAdvicePanel need={assessedNeed} selection={selection} readonly={readonly}
          savedAdvice={decision?.advice} onAdvice={setAdvice} />
          : <p role="alert">请调整需求，库存天数需为 1–365 的整数。</p>}
        {!readonly && (
          <div className="pw-market-decisions">
            <div>
              <button
                className="pw-button pw-button-secondary"
                type="button"
                disabled={!valid || !advice}
                onClick={() => onDecide("watch", advice ?? undefined)}
              >
                暂时观望
              </button>
              <button
                className="pw-button pw-button-secondary"
                type="button"
                onClick={() => onDecide("adjust", advice ?? undefined)}
              >
                调整需求
              </button>
              <button
                className="pw-button"
                type="button"
                disabled={!valid || !advice}
                onClick={() => onDecide("buy", advice ?? undefined)}
              >
                继续采购
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export function DecisionRecord({
  decision,
  compact = false,
}: {
  decision: MarketDecision;
  compact?: boolean;
}) {
  return (
    <section className="pw-info pw-market-record">
      <strong>{ACTION_LABELS[decision.action]}</strong>
      {!compact && <p>{decision.summary}</p>}
      <small>
        {new Date(decision.decidedAt).toLocaleString("zh-CN")}
      </small>
    </section>
  );
}
