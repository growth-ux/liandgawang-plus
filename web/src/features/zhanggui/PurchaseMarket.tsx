import type { MarketDecision, Purchase, PurchaseNeed } from "./purchaseModel";
import { formatMoney } from "./purchaseModel";
import { assessPurchaseMarket } from "./marketAssessment";

const ACTION_LABELS = {
  buy: "按建议采购",
  adjust: "调整采购计划",
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
  onDecide(action: "buy" | "adjust" | "watch"): void;
}) {
  const decision = purchase?.marketDecision;
  const assessment = assessPurchaseMarket(
    readonly && decision ? decision.assessedNeed : need,
  );
  const valid =
    Number.isInteger(need.stockDays ?? 7) &&
    (need.stockDays ?? 7) >= 1 &&
    (need.stockDays ?? 7) <= 365;
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
      {decision && <DecisionRecord decision={decision} />}
      <div className="pw-market-context">
        <div>
          <span>已确认粮种</span>
          <strong>{need.variety}</strong>
        </div>
        <div>
          <span>库存可用天数</span>
          <strong>{need.stockDays ?? 7} 天</strong>
        </div>
        <div>
          <span>已确认采购需求</span>
          <strong>
            {need.quantity} 吨 · {need.destination}
          </strong>
          <small>
            预算 ≤ {formatMoney(need.budget)} 元/吨 · 最晚 {need.days} 天到货
          </small>
        </div>
      </div>
      <p className="pw-muted">
        分析范围：本次收货地为 {need.destination}
        ，当前区域采购比较山东港口与本地库点的{need.variety}
        报价；到厂成本将在提货安排时结合运费核算。
      </p>
      <section className="pw-market-overview">
        <div>
          <p className="pw-eyebrow">瞻小二 · 山东区域{need.variety}</p>
          <div className="pw-market-price">
            {formatMoney(assessment.low)}–{formatMoney(assessment.high)}{" "}
            <small>元/吨</small>
          </div>
          <p className="pw-muted">二等粮 · 山东库点出库报价参考，不含运费</p>
          <span className="pw-market-movement">
            参考报价小幅回落 · 采购交期仍需优先保障
          </span>
        </div>
        <div
          className="pw-market-trend"
          role="img"
          aria-label={`近五个交易日参考报价依次为${assessment.series.join("、")}元每吨`}
        >
          {assessment.series.map((price, i) => (
            <div key={i}>
              <strong>{formatMoney(price)}</strong>
              <span
                style={{ height: `${28 + (price - assessment.low) * 1.4}px` }}
              />
              <small>{i === 4 ? "最近" : `前 ${4 - i} 日`}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="pw-market-judgment">
        <div className="pw-section-top">
          <h3>结合行情，这笔粮现在怎么买？</h3>
          <span className="pw-tag">瞻小二研判 → 粮掌柜建议</span>
        </div>
        <p>
          {valid
            ? assessment.summary
            : "请返回调整采购计划，填写 1–365 的整数库存天数。"}
        </p>
        <dl>
          <div>
            <dt>时机</dt>
            <dd>提前落实补库，避免临近断粮再找货</dd>
          </div>
          <div>
            <dt>本次建议</dt>
            <dd>
              {need.quantity} 吨 · {valid ? assessment.suggestedNeed.days : "—"}{" "}
              天内到货
            </dd>
          </div>
          <div>
            <dt>后续关注</dt>
            <dd>点价变化、可供库存、库区发运与天气</dd>
          </div>
        </dl>
        <small>
          行情参考不代表后续价格保证；具体质量、库存和报价将在选粮点价阶段重新确认。
        </small>
      </section>
      {!readonly && (
        <div className="pw-market-decisions">
          <p>
            {decision?.action === "watch"
              ? "研判已保存为观望，尚未启动交易准入；决定采购时可继续同一笔任务。"
              : "请确认采购时机和安排；按建议采购后进入交易准入，调整计划将返回需求确认。"}
          </p>
          <div>
            <button
              className="pw-button pw-button-secondary"
              type="button"
              disabled={!valid}
              onClick={() => onDecide("watch")}
            >
              暂时观望
            </button>
            <button
              className="pw-button pw-button-secondary"
              type="button"
              onClick={() => onDecide("adjust")}
            >
              调整采购计划
            </button>
            <button
              className="pw-button"
              type="button"
              disabled={!valid}
              onClick={() => onDecide("buy")}
            >
              按建议采购 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function DecisionRecord({ decision }: { decision: MarketDecision }) {
  return (
    <section className="pw-info pw-market-record">
      <strong>行情决策 · {ACTION_LABELS[decision.action]}</strong>
      <p>{decision.summary}</p>
      <small>
        {new Date(decision.decidedAt).toLocaleString("zh-CN")} · 研判时库存{" "}
        {decision.assessedNeed.stockDays ?? 7} 天 · 采购意向{" "}
        {decision.assessedNeed.quantity} 吨
      </small>
    </section>
  );
}
