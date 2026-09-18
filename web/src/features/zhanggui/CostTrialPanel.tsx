import { useMemo, useState } from "react";
import ComposerSelect from "./ComposerSelect";
import {
  formatMoney,
  purchaseSources,
  purchaseTotals,
  purchaseTransports,
  type Purchase,
  type PurchaseCostEstimate,
} from "./purchaseModel";

interface CostTrialPanelProps {
  purchase: Purchase;
  readonly: boolean;
  onAdopt(
    sourceId: string,
    transportId: string,
    assumptions: PurchaseCostEstimate,
  ): void;
}

type CostAssumptions = PurchaseCostEstimate;

interface TrialPlan extends CostAssumptions {
  id: string;
  sourceId: string;
  transportId: string;
}

interface TrialEstimate extends TrialPlan {
  sourceName: string;
  supplierName: string;
  transportName: string;
  grainPrice: number;
  freightPerTon: number;
  deliveredCost: number;
  totalCost: number;
  receivedQuantity: number;
  lossImpactPerTon: number;
  days: number;
  withinBudget: boolean;
  onTime: boolean;
}

function defaultAssumptions(sourceId: string, transportId: string): CostAssumptions {
  if (sourceId === "weifang") {
    return {
      handlingPerTon: 3.6,
      insurancePerTon: 0.8,
      otherPerTon: 0,
      lossRatePct: 0.08,
    };
  }
  if (transportId === "combined") {
    return {
      handlingPerTon: 11.6,
      insurancePerTon: 1.8,
      otherPerTon: 0,
      lossRatePct: 0.28,
    };
  }
  return {
    handlingPerTon: 5.8,
    insurancePerTon: 1.2,
    otherPerTon: 0,
    lossRatePct: 0.18,
  };
}

function estimatePlan(purchase: Purchase, plan: TrialPlan): TrialEstimate {
  const simulated = {
    ...purchase,
    sourceId: plan.sourceId,
    transportId: plan.transportId,
    additionalCostPerTon: 0,
  };
  const totals = purchaseTotals(simulated);
  const quantity = purchase.need.quantity;
  const estimatedFeesPerTon =
    plan.handlingPerTon + plan.insurancePerTon + plan.otherPerTon;
  const totalCost = totals.goods + totals.logistics + estimatedFeesPerTon * quantity;
  const receivedQuantity = Math.max(0.01, quantity * (1 - plan.lossRatePct / 100));
  const deliveredCost = totalCost / receivedQuantity;
  const beforeLossCost = totalCost / quantity;

  return {
    ...plan,
    sourceName: totals.source.depot,
    supplierName: totals.source.name,
    transportName: totals.transport.label,
    grainPrice: totals.source.price,
    freightPerTon: totals.freight,
    deliveredCost,
    totalCost,
    receivedQuantity,
    lossImpactPerTon: deliveredCost - beforeLossCost,
    days: totals.days,
    withinBudget: deliveredCost <= purchase.need.budget,
    onTime: totals.days <= purchase.need.days,
  };
}

function planLabel(index: number) {
  return `自选方案 ${String.fromCharCode(66 + index)}`;
}

function money(value: number, digits = 0) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function CostTrialPanel({
  purchase,
  readonly,
  onAdopt,
}: CostTrialPanelProps) {
  const sources = purchaseSources(purchase).filter(
    (source) => source.stock >= purchase.need.quantity,
  );
  const deliveryTransports = purchaseTransports(purchase).filter(
    (transport) => transport.mode === "delivery",
  );
  const alternativeSource =
    sources.find((source) => source.id !== purchase.sourceId) ?? sources[0];
  const alternativeTransport =
    deliveryTransports.find((transport) => transport.id !== purchase.transportId) ??
    deliveryTransports[0];
  const initialSourceId = alternativeSource?.id ?? purchase.sourceId;
  const initialTransportId =
    initialSourceId === "weifang" && alternativeTransport?.id === "combined"
      ? "road"
      : alternativeTransport?.id ?? purchase.transportId;
  const initialAssumptions = defaultAssumptions(
    initialSourceId,
    initialTransportId,
  );

  const [composerOpen, setComposerOpen] = useState(false);
  const [plans, setPlans] = useState<TrialPlan[]>([]);
  const [draftSourceId, setDraftSourceId] = useState(initialSourceId);
  const [draftTransportId, setDraftTransportId] = useState(initialTransportId);
  const [draftAssumptions, setDraftAssumptions] =
    useState<CostAssumptions>(initialAssumptions);

  const currentPlan = useMemo<TrialPlan>(() => {
    const assumptions =
      purchase.costEstimateAssumptions ??
      defaultAssumptions(purchase.sourceId, purchase.transportId);
    return {
      id: "current",
      sourceId: purchase.sourceId,
      transportId: purchase.transportId,
      ...assumptions,
    };
  }, [
    purchase.costEstimateAssumptions,
    purchase.sourceId,
    purchase.transportId,
  ]);

  const estimates = useMemo(
    () => [currentPlan, ...plans].map((plan) => estimatePlan(purchase, plan)),
    [currentPlan, plans, purchase],
  );
  const best = estimates
    .filter((estimate) => estimate.onTime && estimate.withinBudget)
    .sort((a, b) => a.deliveredCost - b.deliveredCost)[0] ?? estimates[0];
  const currentEstimate = estimates[0];
  const nextPlanIndex = plans.length;

  const availableDraftTransports = deliveryTransports.filter(
    (transport) => !(draftSourceId === "weifang" && transport.id === "combined"),
  );

  function resetAssumptions(sourceId: string, transportId: string) {
    setDraftAssumptions(defaultAssumptions(sourceId, transportId));
  }

  function changeSource(sourceId: string) {
    const transportId =
      sourceId === "weifang" && draftTransportId === "combined"
        ? "road"
        : draftTransportId;
    setDraftSourceId(sourceId);
    setDraftTransportId(transportId);
    resetAssumptions(sourceId, transportId);
  }

  function changeTransport(transportId: string) {
    setDraftTransportId(transportId);
    resetAssumptions(draftSourceId, transportId);
  }

  function updateAssumption(
    key: keyof CostAssumptions,
    value: string,
  ) {
    const parsed = Number.parseFloat(value);
    setDraftAssumptions((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
    }));
  }

  function addPlan() {
    if (plans.length >= 2) return;
    setPlans((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        sourceId: draftSourceId,
        transportId: draftTransportId,
        ...draftAssumptions,
      },
    ]);
    setComposerOpen(false);
  }

  function removePlan(id: string) {
    setPlans((current) => current.filter((plan) => plan.id !== id));
  }

  const bestIndex = estimates.findIndex((estimate) => estimate.id === best.id);
  const currentDelta = currentEstimate.deliveredCost - best.deliveredCost;

  return (
    <section className="pw-cost-trial" aria-labelledby="cost-trial-title">
      <div className="pw-cost-trial-head">
        <div className="pw-cost-trial-agent" aria-hidden="true">
          <span>算</span>
          <i />
        </div>
        <div className="pw-cost-trial-title">
          <span>算小二 · 下单前测算</span>
          <h3 id="cost-trial-title">到厂成本试算</h3>
          <p>把粮源、物流和预计损耗放到同一口径，比较后再决定采用哪个组合。</p>
        </div>
        <div className="pw-cost-trial-current">
          <span>当前组合预计到厂</span>
          <strong>{money(currentEstimate.deliveredCost, 2)}<small>元/吨</small></strong>
          <em>含估算项</em>
        </div>
        {!readonly && (
          <button
            type="button"
            className="pw-cost-trial-add"
            disabled={plans.length >= 2}
            onClick={() => setComposerOpen((open) => !open)}
          >
            {composerOpen ? "收起自选" : plans.length >= 2 ? "已达 3 个方案" : "+ 加入自选方案"}
          </button>
        )}
      </div>

      {composerOpen && !readonly && (
        <div className="pw-cost-composer">
          <div className="pw-cost-composer-heading">
            <div>
              <span>{planLabel(nextPlanIndex)}</span>
              <strong>组合一个想比较的方案</strong>
            </div>
            <small>报价自动带入，估算参数可按实际情况调整</small>
          </div>
          <div className="pw-cost-composer-grid">
            <label>
              <span>自选粮源</span>
              <ComposerSelect
                ariaLabel="自选粮源"
                value={draftSourceId}
                onChange={changeSource}
                options={sources.map((source) => ({
                  value: source.id,
                  label: `${source.depot} · ${formatMoney(source.price)} 元/吨`,
                }))}
              />
            </label>
            <label>
              <span>自选物流</span>
              <ComposerSelect
                ariaLabel="自选物流"
                value={draftTransportId}
                onChange={changeTransport}
                options={availableDraftTransports.map((transport) => ({
                  value: transport.id,
                  label: `${transport.label} · ${formatMoney(transport.price)} 元/吨`,
                }))}
              />
            </label>
            <label>
              <span>装卸中转</span>
              <div className="pw-cost-input">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={draftAssumptions.handlingPerTon}
                  onChange={(event) =>
                    updateAssumption("handlingPerTon", event.target.value)
                  }
                />
                <small>元/吨</small>
              </div>
            </label>
            <label>
              <span>保险杂费</span>
              <div className="pw-cost-input">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={draftAssumptions.insurancePerTon}
                  onChange={(event) =>
                    updateAssumption("insurancePerTon", event.target.value)
                  }
                />
                <small>元/吨</small>
              </div>
            </label>
            <label>
              <span>其他费用</span>
              <div className="pw-cost-input">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={draftAssumptions.otherPerTon}
                  onChange={(event) =>
                    updateAssumption("otherPerTon", event.target.value)
                  }
                />
                <small>元/吨</small>
              </div>
            </label>
            <label>
              <span>预计损耗率</span>
              <div className="pw-cost-input">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.01"
                  value={draftAssumptions.lossRatePct}
                  onChange={(event) =>
                    updateAssumption("lossRatePct", event.target.value)
                  }
                />
                <small>%</small>
              </div>
            </label>
          </div>
          <div className="pw-cost-composer-actions">
            <p>测算结果仅用于下单决策，到厂后将按真实磅单和结算单重新核算。</p>
            <button type="button" onClick={addPlan}>加入对比</button>
          </div>
        </div>
      )}

      <div className="pw-cost-trial-grid" aria-live="polite">
        {estimates.map((estimate, index) => {
          const selected = estimate.id === "current";
          const recommended = estimate.id === best.id;
          const difference = estimate.deliveredCost - best.deliveredCost;
          return (
            <article
              key={estimate.id}
              className="pw-cost-plan"
              data-current={selected}
              data-recommended={recommended}
            >
              <div className="pw-cost-plan-head">
                <div>
                  <span>{selected ? "当前已选组合" : planLabel(index - 1)}</span>
                  <h4>{estimate.sourceName} × {estimate.transportName}</h4>
                  <p>{estimate.supplierName}</p>
                </div>
                <div className="pw-cost-plan-badges">
                  {recommended && <b>综合成本优选</b>}
                  {!selected && (
                    <button
                      type="button"
                      aria-label={`移除${planLabel(index - 1)}`}
                      onClick={() => removePlan(estimate.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div className="pw-cost-plan-price">
                <span>预计综合到厂成本</span>
                <strong>{money(estimate.deliveredCost, 2)}<small>元/吨</small></strong>
                {difference > 0.005 ? (
                  <em>比优选高 {money(difference, 2)} 元/吨</em>
                ) : (
                  <em data-best="true">当前最低</em>
                )}
              </div>

              <dl className="pw-cost-breakdown">
                <div><dt>粮价</dt><dd>{money(estimate.grainPrice, 0)}</dd></div>
                <div><dt>运费</dt><dd>{money(estimate.freightPerTon, 0)}</dd></div>
                <div><dt>装卸及杂费</dt><dd>{money(estimate.handlingPerTon + estimate.insurancePerTon + estimate.otherPerTon, 1)}</dd></div>
                <div><dt>损耗摊增</dt><dd>{money(estimate.lossImpactPerTon, 2)}</dd></div>
              </dl>

              <div className="pw-cost-plan-foot">
                <div>
                  <span>预计总成本 <b>¥ {money(estimate.totalCost, 0)}</b></span>
                  <span>预计入库 <b>{money(estimate.receivedQuantity, 2)} 吨</b></span>
                </div>
                <div>
                  <i data-ok={estimate.withinBudget}>{estimate.withinBudget ? `低于预算 ${money(purchase.need.budget - estimate.deliveredCost, 2)}` : "超出预算"}</i>
                  <i data-ok={estimate.onTime}>{estimate.onTime ? `${estimate.days} 天到货` : "超过交期"}</i>
                </div>
              </div>

              {!selected && !readonly && (
                <button
                  type="button"
                  className="pw-cost-plan-adopt"
                  onClick={() => {
                    onAdopt(estimate.sourceId, estimate.transportId, {
                      handlingPerTon: estimate.handlingPerTon,
                      insurancePerTon: estimate.insurancePerTon,
                      otherPerTon: estimate.otherPerTon,
                      lossRatePct: estimate.lossRatePct,
                    });
                    removePlan(estimate.id);
                  }}
                >
                  采用此组合
                </button>
              )}
            </article>
          );
        })}

        {plans.length < 2 && !composerOpen && !readonly && (
          <button
            type="button"
            className="pw-cost-plan-empty"
            onClick={() => setComposerOpen(true)}
          >
            <span>＋</span>
            <strong>加入一个自选组合</strong>
            <small>换粮源、换物流，或调整损耗与杂费</small>
          </button>
        )}
      </div>

      <div className="pw-cost-insight">
        <span>AI 比选结论</span>
        <p>
          {estimates.length === 1
            ? `当前组合预计到厂 ${money(currentEstimate.deliveredCost, 2)} 元/吨，仍可加入自选方案验证决策。`
            : best.id === "current"
              ? `当前组合综合成本最低，且满足 ${purchase.need.days} 天交期；相比最接近的自选方案，每吨至少少 ${money(Math.min(...estimates.slice(1).map((item) => item.deliveredCost - best.deliveredCost)), 2)} 元。`
              : `${planLabel(bestIndex - 1)}综合成本更优，预计每吨比当前组合少 ${money(currentDelta, 2)} 元，可采用后继续下单。`}
        </p>
        <small>粮价和运价来自当前报价；装卸、保险及损耗为历史履约估算。</small>
      </div>
    </section>
  );
}
