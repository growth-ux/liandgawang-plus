import type { MissionSnapshot } from "./types";
/** 采购阶段是驾驶舱唯一的业务状态，原分析任务可携带方案接续办理。 */
export const PURCHASE_STAGES = [
  "需求确认",
  "行情研判",
  "交易准入",
  "选粮点价",
  "提货安排",
  "下单履约",
  "复盘沉淀",
];
export const PURCHASE_STORAGE_KEY = "zhanggui-purchases-v1";

export interface PurchaseNeed {
  variety: "玉米" | "小麦";
  quantity: number;
  destination: string;
  days: number;
  budget: number;
  stockDays?: number;
}

export interface MarketDecision {
  action: "buy" | "adjust" | "watch" | "inherited";
  summary: string;
  decidedAt: string;
  assessedNeed: PurchaseNeed;
  suggestedNeed: PurchaseNeed;
}

export interface Purchase {
  flowVersion?: 2 | 3;
  marketDecision?: MarketDecision;
  id: string;
  createdAt: string;
  stage: number;
  need: PurchaseNeed;
  sourceId: string;
  transportId: string;
  documentName: string;
  qualified: boolean;
  payee: string;
  reviewed: boolean;
  ordered: boolean;
  deliveryStep: number;
  received: boolean;
  learned: boolean;
  qualificationChecked?: boolean;
  reviewAttempted?: boolean;
  originMission?: MissionSnapshot;
  additionalCostPerTon?: number;
  sourceOptions?: GrainSource[];
  transportOptions?: TransportOption[];
}

export interface GrainSource {
  id: string;
  name: string;
  depot: string;
  price: number;
  stock: number;
  moisture: string;
  reason: string;
}

export interface TransportOption {
  id: string;
  label: string;
  mode: string;
  price: number;
  days: number;
  description: string;
}

export function purchaseSources(purchase: Purchase) {
  return purchase.sourceOptions ?? grainSources(purchase.need.variety);
}

export function purchaseTransports(
  purchase: Purchase,
): readonly TransportOption[] {
  return purchase.transportOptions ?? TRANSPORTS;
}

export const TRANSPORTS = [
  {
    id: "road",
    label: "公路直达",
    mode: "delivery",
    price: 76,
    days: 3,
    description: "粮库装车后直达工厂，减少中转，适合近期补库。",
  },
  {
    id: "combined",
    label: "铁公联运",
    mode: "delivery",
    price: 59,
    days: 6,
    description: "铁路干线 + 末端短驳，费用更低，需预留中转时间。",
  },
  {
    id: "pickup",
    label: "自行提货",
    mode: "pickup",
    price: 68,
    days: 3,
    description: "自主安排车辆，按车次预约，含自组织运输费用估算。",
  },
] as const;

export function grainSources(variety: PurchaseNeed["variety"]): GrainSource[] {
  const base = variety === "玉米" ? 2320 : 2450;
  return [
    {
      id: "qingdao",
      name: "青岛港粮食供应中心",
      depot: "青岛港粮库",
      price: base,
      stock: 1200,
      moisture: "13.5%",
      reason: "库存充足，支持近期发运；与潍坊工厂距离较近。",
    },
    {
      id: "rizhao",
      name: "日照港粮食供应中心",
      depot: "日照港粮库",
      price: base + 25,
      stock: 860,
      moisture: "13.2%",
      reason: "同等级备选粮源，可用于主供库点排队时补充采购。",
    },
    {
      id: "weifang",
      name: "潍坊区域粮食仓储中心",
      depot: "潍坊周边库",
      price: base + 60,
      stock: 500,
      moisture: "13.4%",
      reason: "本地现货，采购单价较高，适合作为紧急补库备选。",
    },
  ];
}

export function newPurchase(need: PurchaseNeed): Purchase {
  return {
    flowVersion: 3,
    id: `CG-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    stage: 2,
    need,
    sourceId: "qingdao",
    transportId: "road",
    documentName: "",
    qualified: false,
    payee: "",
    reviewed: false,
    ordered: false,
    deliveryStep: 0,
    received: false,
    learned: false,
  };
}

export function purchaseTotals(purchase: Purchase) {
  const source = purchaseSources(purchase).find(
    (item) => item.id === purchase.sourceId,
  )!;
  const transport = purchaseTransports(purchase).find(
    (item) => item.id === purchase.transportId,
  )!;
  // 本地区域仓的短驳距离较短，联运仅适用于港口库点。
  const freight =
    purchase.sourceId === "weifang"
      ? transport.id === "pickup"
        ? 25
        : 32
      : transport.price;
  const days = purchase.sourceId === "weifang" ? 1 : transport.days;
  const goods = source.price * purchase.need.quantity;
  const logistics = freight * purchase.need.quantity;
  const additional =
    (purchase.additionalCostPerTon ?? 0) * purchase.need.quantity;
  return {
    source,
    transport,
    freight,
    days,
    goods,
    logistics,
    additional,
    total: goods + logistics + additional,
    unit: source.price + freight + (purchase.additionalCostPerTon ?? 0),
  };
}

export function orderProblems(purchase: Purchase): string[] {
  const { source, unit, days } = purchaseTotals(purchase);
  const problems: string[] = [];
  if (!purchase.qualified) problems.push("企业资质或资金账户尚未完成核验");
  if (purchase.need.quantity * purchase.need.budget * 0.1 > 800000)
    problems.push("本笔保证金预留金额超过账户可用额度，请调整采购计划");
  if (purchase.payee.trim() !== source.name)
    problems.push("收款主体与合同卖方不一致，请使用合同约定的对公收款账户");
  if (unit > purchase.need.budget)
    problems.push("到厂单价超出本次采购预算，请返回调整粮源或运输方案");
  if (days > purchase.need.days)
    problems.push("预计到货时间超过采购交期，请选择更快的运输方案");
  if (purchase.need.quantity > source.stock)
    problems.push("采购数量超过当前粮源可供数量，请重新选择粮源");
  return problems;
}

export function readPurchases(): Purchase[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(PURCHASE_STORAGE_KEY) || "[]",
    );
    if (!Array.isArray(value)) return [];
    const migrated = value.map((item) => {
      if (!item || typeof item !== "object" || item.flowVersion === 3)
        return item;
      if (item.flowVersion === 2) {
        // 旧七步版先看行情，前两步尚未完成的采购先重新确认需求。
        return {
          ...item,
          stage: item.stage < 2 ? 0 : item.stage,
          flowVersion: 3,
        };
      }
      if (
        item.flowVersion === undefined &&
        Number.isInteger(item.stage) &&
        item.stage >= 0 &&
        item.stage <= 5
      ) {
        return {
          ...item,
          stage: item.stage === 0 ? 0 : item.stage + 1,
          flowVersion: 3,
        };
      }
      return item;
    });
    return migrated.filter((item): item is Purchase => {
      if (!item || typeof item !== "object") return false;
      const p = item as Purchase;
      return (
        typeof p.id === "string" &&
        Number.isInteger(p.stage) &&
        p.stage >= 0 &&
        p.stage <= 6 &&
        p.need &&
        ["玉米", "小麦"].includes(p.need.variety) &&
        Number.isFinite(p.need.quantity) &&
        p.need.quantity > 0 &&
        Number.isFinite(p.need.days) &&
        p.need.days > 0 &&
        Number.isFinite(p.need.budget) &&
        p.need.budget > 0 &&
        typeof p.need.destination === "string" &&
        typeof p.payee === "string" &&
        typeof p.createdAt === "string" &&
        typeof p.documentName === "string" &&
        [p.qualified, p.reviewed, p.ordered, p.received, p.learned].every(
          (value) => typeof value === "boolean",
        ) &&
        Number.isInteger(p.deliveryStep) &&
        p.deliveryStep >= 0 &&
        p.deliveryStep <= 2 &&
        purchaseSources(p).some(
          (s) =>
            s.id === p.sourceId &&
            Number.isFinite(s.price) &&
            Number.isFinite(s.stock),
        ) &&
        purchaseTransports(p).some(
          (t) =>
            t.id === p.transportId &&
            Number.isFinite(t.price) &&
            Number.isFinite(t.days),
        )
      );
    });
  } catch {
    return [];
  }
}

export const formatMoney = (amount: number) =>
  amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 });

export function purchaseMemory(purchase: Purchase) {
  const { source, transport, unit, days } = purchaseTotals(purchase);
  return `${purchase.need.quantity} 吨${purchase.need.variety}采购采用${source.depot} + ${transport.label}，订单到厂单价 ${unit} 元/吨，计划运输 ${days} 天。后续同区域采购可优先复核此组合，价格、库存和运力需重新确认。`;
}
