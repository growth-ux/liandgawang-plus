import { grainSources, type PurchaseNeed } from "./purchaseModel";

/** 区域行情页面的统一参考口径，同时用于研判面板和瞻小二节点。 */
export function assessPurchaseMarket(need: PurchaseNeed) {
  const sources = grainSources(need.variety);
  const low = Math.min(...sources.map((source) => source.price));
  const high = Math.max(...sources.map((source) => source.price));
  const stockDays = need.stockDays ?? 7;
  const bufferDays = stockDays - need.days;
  const urgent = stockDays <= 3 || bufferDays <= 2;
  const title = bufferDays <= 0
    ? "先确认首批到货时间"
    : urgent ? "先核实发运与到货时间" : "先比较粮源与到厂成本";
  const timing = bufferDays < 0
    ? `库存可用 ${stockDays} 天，计划 ${need.days} 天内到货；若到期才到货，可能出现 ${-bufferDays} 天的用粮缺口。建议提前到货或安排分批补库。`
    : bufferDays === 0
      ? `库存和到货期限均为 ${stockDays} 天，没有时间缓冲。建议确认更早的到货安排。`
      : `库存可用 ${stockDays} 天，计划 ${need.days} 天内到货，按期到货可留出 ${bufferDays} 天缓冲。${urgent ? "时间较紧，先核实可发运库存与运力。" : "是否提前采购，还需结合报价和发运条件判断。"}`;
  const cost = need.budget <= low
    ? `到厂预算 ${need.budget} 元/吨，${need.budget === low ? "与最低出库参考价相同，尚未留出运费" : "低于最低出库参考价"}，建议调整预算或寻找其他粮源。`
    : `到厂预算 ${need.budget} 元/吨，需加入运费及其他费用后再判断是否满足预算。`;
  const summary = `${title}。${timing}${cost}`;
  return {
    low,
    high,
    sources,
    title,
    timing,
    cost,
    stockDays,
    // 继续采购沿用已确认条件，交期调整由用户在需求页完成。
    suggestedNeed: { ...need },
    summary,
    urgent,
  };
}
