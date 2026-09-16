import { useState } from "react";
import type { MarketDecision, Purchase, PurchaseNeed } from "./purchaseModel";
import { formatMoney } from "./purchaseModel";
import { assessPurchaseMarket } from "./marketAssessment";
import PurchaseMarketTrend from "./PurchaseMarketTrend";
import PurchaseAdvicePanel from "./PurchaseAdvicePanel";
import type { MarketSelection, PurchaseAdvice } from "./purchaseAdvice";

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
      <PurchaseMarketTrend
        key={assessedNeed.variety}
        variety={assessedNeed.variety}
        asOf={readonly && decision ? decision.decidedAt.slice(0, 10) : undefined}
        onContextChange={setSelection}
      />
      <section className="pw-market-overview" aria-label="区域行情">
        <div>
          <h3>候选粮源报价</h3>
          <div className="pw-market-price">
            {formatMoney(assessment.low)}–{formatMoney(assessment.high)}{" "}
            <small>元/吨</small>
          </div>
          <p className="pw-market-basis">二等粮 · 库点出库参考价，不含运费</p>
        </div>
        <dl className="pw-market-quotes" aria-label="库点报价">
          {assessment.sources.map((source) => (
            <div key={source.id}>
              <dt>{source.depot}</dt>
              <dd>{formatMoney(source.price)} <span>元/吨</span></dd>
            </div>
          ))}
        </dl>
      </section>
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
