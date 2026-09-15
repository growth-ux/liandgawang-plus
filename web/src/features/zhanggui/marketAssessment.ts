import { grainSources, type PurchaseNeed } from "./purchaseModel";

/** 区域行情页面的统一参考口径，同时用于研判面板和瞻小二节点。 */
export function assessPurchaseMarket(need: PurchaseNeed) {
  const sources = grainSources(need.variety);
  const low = sources[0].price;
  const stockDays = need.stockDays ?? 7;
  const days = Math.max(1, Math.min(need.days, stockDays - 1));
  const suggestedNeed = { ...need, stockDays, days };
  const urgent = stockDays <= 3;
  const summary = `${need.variety}区域参考报价近期小幅回落。现有库存预计覆盖 ${stockDays} 天，建议落实本次 ${need.quantity} 吨补库，争取 ${days} 天内到货，预留用粮缓冲。${urgent ? "库存时间较紧，应优先核对本地粮源或加急运力。" : "先锁定供应与交期，点价时再次核对价格。"}`;
  return {
    low,
    high: sources[sources.length - 1].price,
    series: [low + 25, low + 20, low + 10, low + 5, low],
    stockDays,
    suggestedNeed,
    summary,
    urgent,
  };
}
