import { ACCOUNT_FROZEN, ACCOUNT_TOTAL } from "./qualificationData";
import type { MissionSnapshot } from "./types";
import type { PurchaseAdvice } from "./purchaseAdvice";
/** 采购阶段是驾驶舱唯一的业务状态，原分析任务可携带方案接续办理。 */
export const PURCHASE_STAGES = [
  "需求确认",
  "行情研判",
  "交易准入",
  "选粮点价",
  "成本测算",
  "下单交付",
  "到厂核算",
  "履约复盘",
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

export interface PurchaseCostEstimate {
  handlingPerTon: number;
  insurancePerTon: number;
  otherPerTon: number;
  lossRatePct: number;
}

export interface MarketDecision {
  advice?: PurchaseAdvice;
  action: "buy" | "adjust" | "watch" | "inherited";
  summary: string;
  decidedAt: string;
  assessedNeed: PurchaseNeed;
  suggestedNeed: PurchaseNeed;
}

export interface Purchase {
  flowVersion?: 2 | 3 | 4;
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
  costEstimateAssumptions?: PurchaseCostEstimate;
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
  evidence?: {
    quoteNo: string;
    updatedAt: string;
    priceBasis: string;
    stockCheckedAt: string;
    impurities: string;
    bulkDensity: string;
    moldyKernels: string;
    inspectionReportNo: string;
    inspectedAt: string;
    fulfilledOrders: number;
    fulfillmentRate: string;
    disputes: number;
    benchmarkPrice: number;
    benchmarkLow: number;
    benchmarkHigh: number;
    sampleSize: number;
    risk: string;
  };
}

export interface TransportOption {
  id: string;
  label: string;
  mode: string;
  price: number;
  days: number;
  description: string;
  loadCapacity?: number;
  loadUnit?: string;
  dispatchWindow?: string;
  priceBasis?: string;
  quoteUpdatedAt?: string;
  quoteNo?: string;
  onTimeRate?: string;
  completedOrders?: number;
  complianceNote?: string;
  protectionNote?: string;
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
    loadCapacity: 30,
    loadUnit: "车次",
    dispatchWindow: "24 小时内可调度",
    priceBasis: "含油费、路桥费，不含异常压车费",
    quoteUpdatedAt: "今日 10:35",
    quoteNo: "YX-GL-0916-0142",
    onTimeRate: "98.1%",
    completedOrders: 126,
    complianceNote: "承运商准入已核验，派车后复核车辆与司机资质",
    protectionNote: "平台承担承运责任，运输轨迹全程留痕",
  },
  {
    id: "combined",
    label: "铁公联运",
    mode: "delivery",
    price: 59,
    days: 6,
    description: "铁路干线 + 末端短驳，费用更低，需预留中转时间。",
    loadCapacity: 60,
    loadUnit: "车皮",
    dispatchWindow: "48 小时内完成配载",
    priceBasis: "含铁路干线及末端短驳，不含异常滞箱费",
    quoteUpdatedAt: "今日 10:28",
    quoteNo: "YX-LY-0916-0087",
    onTimeRate: "97.3%",
    completedOrders: 84,
    complianceNote: "干线及短驳承运主体均已完成平台准入",
    protectionNote: "分段运单关联，中转与交付节点留痕",
  },
  {
    id: "pickup",
    label: "自行提货",
    mode: "pickup",
    price: 0,
    days: 3,
    description: "自主安排车辆，按车次预约，含自组织运输费用估算。",
    loadCapacity: 30,
    loadUnit: "车次",
    dispatchWindow: "按自备车辆预约时间",
    priceBasis: "平台不计运费，车辆及相关费用由采购方承担",
    quoteUpdatedAt: "无需平台报价",
  },
] as const;

export type LogisticsFilterReason =
  | "承运资质未通过"
  | "不适配散粮运输"
  | "线路不覆盖"
  | "可调运力不足"
  | "预计交期超限";

interface LogisticsCandidate {
  id: string;
  mode: "road" | "combined";
  carrierQualified: boolean;
  grainCapable: boolean;
  routeCovered: boolean;
  capacity: number;
  leadDays: number;
  quoteUpdatedToday: boolean;
}

const LOGISTICS_POOL: LogisticsCandidate[] = [
  { id: "road-01", mode: "road", carrierQualified: true, grainCapable: true, routeCovered: true, capacity: 600, leadDays: 3, quoteUpdatedToday: true },
  { id: "road-02", mode: "road", carrierQualified: true, grainCapable: true, routeCovered: true, capacity: 450, leadDays: 4, quoteUpdatedToday: true },
  { id: "road-03", mode: "road", carrierQualified: true, grainCapable: true, routeCovered: true, capacity: 300, leadDays: 3, quoteUpdatedToday: true },
  { id: "road-04", mode: "road", carrierQualified: true, grainCapable: true, routeCovered: true, capacity: 800, leadDays: 5, quoteUpdatedToday: false },
  { id: "road-05", mode: "road", carrierQualified: false, grainCapable: true, routeCovered: true, capacity: 500, leadDays: 3, quoteUpdatedToday: true },
  { id: "road-06", mode: "road", carrierQualified: true, grainCapable: false, routeCovered: true, capacity: 500, leadDays: 3, quoteUpdatedToday: true },
  { id: "road-07", mode: "road", carrierQualified: true, grainCapable: true, routeCovered: false, capacity: 600, leadDays: 4, quoteUpdatedToday: true },
  { id: "road-08", mode: "road", carrierQualified: true, grainCapable: true, routeCovered: true, capacity: 180, leadDays: 3, quoteUpdatedToday: true },
  { id: "rail-01", mode: "combined", carrierQualified: true, grainCapable: true, routeCovered: true, capacity: 600, leadDays: 6, quoteUpdatedToday: true },
  { id: "rail-02", mode: "combined", carrierQualified: true, grainCapable: true, routeCovered: true, capacity: 900, leadDays: 7, quoteUpdatedToday: true },
  { id: "rail-03", mode: "combined", carrierQualified: true, grainCapable: true, routeCovered: true, capacity: 500, leadDays: 8, quoteUpdatedToday: true },
  { id: "rail-04", mode: "combined", carrierQualified: false, grainCapable: true, routeCovered: true, capacity: 700, leadDays: 6, quoteUpdatedToday: true },
];

export function logisticsSearchResult(purchase: Purchase) {
  function rejection(candidate: LogisticsCandidate): LogisticsFilterReason | null {
    if (!candidate.carrierQualified) return "承运资质未通过";
    if (!candidate.grainCapable) return "不适配散粮运输";
    if (!candidate.routeCovered) return "线路不覆盖";
    if (candidate.capacity < purchase.need.quantity) return "可调运力不足";
    if (candidate.leadDays > purchase.need.days) return "预计交期超限";
    return null;
  }

  const evaluated = LOGISTICS_POOL.map((candidate) => ({
    candidate,
    reason: rejection(candidate),
  }));
  const qualified = evaluated
    .filter((item) => item.reason === null)
    .map((item) => item.candidate);
  const responded = qualified.filter((item) => item.quoteUpdatedToday);
  const reasonOrder: LogisticsFilterReason[] = [
    "承运资质未通过",
    "不适配散粮运输",
    "线路不覆盖",
    "可调运力不足",
    "预计交期超限",
  ];

  return {
    records: LOGISTICS_POOL,
    qualified,
    responded,
    reasons: reasonOrder.map((reason) => ({
      reason,
      count: evaluated.filter((item) => item.reason === reason).length,
    })),
  };
}

export function grainSources(variety: PurchaseNeed["variety"]): GrainSource[] {
  const base = variety === "玉米" ? 2320 : 2450;
  const quoteDate = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return [
    {
      id: "qingdao",
      name: "青岛港粮食供应中心",
      depot: "青岛港粮库",
      price: base,
      stock: 1200,
      moisture: "13.5%",
      reason: "库存充足，支持近期发运；与潍坊工厂距离较近。",
      evidence: {
        quoteNo: `BJ-${quoteDate}-QD-0371`,
        updatedAt: "今日 10:20",
        priceBasis: "含税出库价 · 含装车费",
        stockCheckedAt: "今日 10:18",
        impurities: "0.8%",
        bulkDensity: "718 g/L",
        moldyKernels: "1.2%",
        inspectionReportNo: `ZJ-${quoteDate}-1186`,
        inspectedAt: "2日前",
        fulfilledOrders: 47,
        fulfillmentRate: "98.2%",
        disputes: 0,
        benchmarkPrice: base + 18,
        benchmarkLow: base - 10,
        benchmarkHigh: base + 55,
        sampleSize: 18,
        risk: "港区午后装车较集中，建议锁价后提前预约装车时段。",
      },
    },
    {
      id: "rizhao",
      name: "日照港粮食供应中心",
      depot: "日照港粮库",
      price: base + 25,
      stock: 860,
      moisture: "13.2%",
      reason: "同等级备选粮源，可用于主供库点排队时补充采购。",
      evidence: {
        quoteNo: `BJ-${quoteDate}-RZ-0248`,
        updatedAt: "今日 09:45",
        priceBasis: "含税出库价 · 含装车费",
        stockCheckedAt: "今日 09:41",
        impurities: "0.7%",
        bulkDensity: "724 g/L",
        moldyKernels: "1.0%",
        inspectionReportNo: `ZJ-${quoteDate}-0924`,
        inspectedAt: "1日前",
        fulfilledOrders: 38,
        fulfillmentRate: "96.8%",
        disputes: 1,
        benchmarkPrice: base + 18,
        benchmarkLow: base - 10,
        benchmarkHigh: base + 55,
        sampleSize: 18,
        risk: "日照港午后可供量波动较快，确认前需复核当日剩余可供量。",
      },
    },
    {
      id: "weifang",
      name: "潍坊区域粮食仓储中心",
      depot: "潍坊周边库",
      price: base + 60,
      stock: 500,
      moisture: "13.4%",
      reason: "本地现货，采购单价较高，适合作为紧急补库备选。",
      evidence: {
        quoteNo: `BJ-${quoteDate}-WF-0159`,
        updatedAt: "今日 10:05",
        priceBasis: "含税出库价 · 含装车费",
        stockCheckedAt: "今日 10:02",
        impurities: "0.9%",
        bulkDensity: "712 g/L",
        moldyKernels: "1.3%",
        inspectionReportNo: `ZJ-${quoteDate}-0762`,
        inspectedAt: "3日前",
        fulfilledOrders: 29,
        fulfillmentRate: "99.1%",
        disputes: 0,
        benchmarkPrice: base + 18,
        benchmarkLow: base - 10,
        benchmarkHigh: base + 55,
        sampleSize: 18,
        risk: "本地库存响应快，但出库报价高于区域可比成交中位价。",
      },
    },
  ];
}

export type SourceFilterReason =
  | "品种或等级不符"
  | "可供数量不足"
  | "报价未更新"
  | "不支持目标区域发运"
  | "预计交期超限";

export interface SourceSearchRecord {
  id: string;
  depot: string;
  channel: "平台在售" | "合作库点" | "历史供应商";
  variety: PurchaseNeed["variety"];
  grade: "一等" | "二等" | "三等";
  stock: number;
  quoteUpdatedToday: boolean;
  supportsDestination: boolean;
  leadDays: number;
}

/** 竞赛场景的完整检索池：先执行硬性条件过滤，再进入多维比选。 */
export function sourceSearchResult(need: PurchaseNeed) {
  const otherVariety: PurchaseNeed["variety"] =
    need.variety === "玉米" ? "小麦" : "玉米";
  const depots = [
    "青岛港粮库",
    "日照港粮库",
    "潍坊周边库",
    "胶州中心库",
    "诸城粮食储运库",
    "高密区域库",
    "昌邑粮食储备库",
    "寿光粮食物流库",
    "济宁直属库",
    "菏泽粮食储备库",
    "烟台港粮库",
    "威海区域库",
    "临沂粮食中心库",
    "枣庄储运库",
    "泰安粮食供应库",
    "淄博粮食周转库",
    "东营中心库",
    "滨州粮食物流库",
    "德州直属库",
    "聊城粮食储备库",
    "莱州港区库",
    "平度粮食中心库",
    "章丘区域库",
    "莱芜粮食储运库",
    "滕州粮食供应库",
    "莒县粮食中心库",
  ];
  const passingStocks = [1200, 860, 500, 760, 680, 420, 350, 310];
  const stockRatios = [0.45, 0.6, 0.72, 0.8, 0.9];
  const recordId = (index: number) =>
    ["qingdao", "rizhao", "weifang"][index] ?? `source-${index + 1}`;
  const records: SourceSearchRecord[] = depots.map((depot, index) => {
    const channel: SourceSearchRecord["channel"] =
      index < 17 ? "平台在售" : index < 23 ? "合作库点" : "历史供应商";
    if (index < 8) {
      return {
        id: recordId(index),
        depot,
        channel,
        variety: need.variety,
        grade: index % 3 === 0 ? "一等" : "二等",
        stock: passingStocks[index],
        quoteUpdatedToday: true,
        supportsDestination: true,
        leadDays: Math.min(need.days, 3 + (index % 4)),
      };
    }
    if (index < 10) {
      return {
        id: recordId(index),
        depot,
        channel,
        variety: need.variety,
        grade: "二等",
        stock: Math.max(need.quantity + 100, 500),
        quoteUpdatedToday: true,
        supportsDestination: true,
        leadDays: need.days + 2 + (index - 8),
      };
    }
    if (index < 12) {
      return {
        id: recordId(index),
        depot,
        channel,
        variety: need.variety,
        grade: "二等",
        stock: Math.max(need.quantity + 80, 420),
        quoteUpdatedToday: true,
        supportsDestination: false,
        leadDays: Math.min(need.days, 5),
      };
    }
    if (index < 15) {
      return {
        id: recordId(index),
        depot,
        channel,
        variety: need.variety,
        grade: "二等",
        stock: Math.max(need.quantity + 60, 380),
        quoteUpdatedToday: false,
        supportsDestination: true,
        leadDays: Math.min(need.days, 5),
      };
    }
    if (index < 20) {
      return {
        id: recordId(index),
        depot,
        channel,
        variety: need.variety,
        grade: "二等",
        stock: Math.max(20, Math.floor(need.quantity * stockRatios[index - 15])),
        quoteUpdatedToday: true,
        supportsDestination: true,
        leadDays: Math.min(need.days, 4),
      };
    }
    return {
      id: recordId(index),
      depot,
      channel,
      variety: otherVariety,
      grade: index % 2 === 0 ? "三等" : "二等",
      stock: Math.max(need.quantity + 50, 360),
      quoteUpdatedToday: true,
      supportsDestination: true,
      leadDays: Math.min(need.days, 5),
    };
  });

  function rejection(record: SourceSearchRecord): SourceFilterReason | null {
    if (record.variety !== need.variety || record.grade === "三等")
      return "品种或等级不符";
    if (record.stock < need.quantity) return "可供数量不足";
    if (!record.quoteUpdatedToday) return "报价未更新";
    if (!record.supportsDestination) return "不支持目标区域发运";
    if (record.leadDays > need.days) return "预计交期超限";
    return null;
  }

  const evaluated = records.map((record) => ({
    record,
    reason: rejection(record),
  }));
  const reasonOrder: SourceFilterReason[] = [
    "品种或等级不符",
    "可供数量不足",
    "报价未更新",
    "不支持目标区域发运",
    "预计交期超限",
  ];
  const rejected = evaluated.filter(
    (item): item is { record: SourceSearchRecord; reason: SourceFilterReason } =>
      item.reason !== null,
  );
  const examples = ["可供数量不足", "报价未更新", "预计交期超限"]
    .map((reason) => rejected.find((item) => item.reason === reason))
    .filter(
      (item): item is { record: SourceSearchRecord; reason: SourceFilterReason } =>
        Boolean(item),
    );

  return {
    records,
    eligible: evaluated.filter((item) => item.reason === null).map((item) => item.record),
    rejected,
    reasons: reasonOrder.map((reason) => ({
      reason,
      count: rejected.filter((item) => item.reason === reason).length,
    })),
    examples,
    channels: (["平台在售", "合作库点", "历史供应商"] as const).map(
      (channel) => ({
        channel,
        count: records.filter((record) => record.channel === channel).length,
      }),
    ),
  };
}

export function newPurchase(need: PurchaseNeed): Purchase {
  return {
    flowVersion: 4,
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
    transport.id === "pickup"
      ? 0
      : purchase.sourceId === "weifang"
        ? 32
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

/**
 * 算小二的结案口径：不重新评价粮源与运力，只把已发生的交易数据
 * 统一折算为“实际合格入库吨成本”，并单独揭示运输损耗造成的摊增。
 */
export function purchaseSettlement(purchase: Purchase) {
  const totals = purchaseTotals(purchase);
  const quantity = purchase.need.quantity;
  const isPickup = totals.transport.id === "pickup";
  const lossRate = isPickup
    ? 0.0012
    : totals.transport.id === "combined"
      ? 0.006
      : purchase.sourceId === "weifang"
        ? 0.0008
        : 0.0018;
  const lossAllowanceRate = totals.transport.id === "combined" ? 0.004 : 0.003;
  const receivedQuantity = Math.round(quantity * (1 - lossRate) * 100) / 100;
  const lossQuantity = Math.round((quantity - receivedQuantity) * 100) / 100;
  // 超出合同允差的损耗由承运方赔付；允差内的损耗仍由买方承担。
  const allowanceQuantity = Math.round(quantity * lossAllowanceRate * 100) / 100;
  const overAllowanceQuantity = isPickup
    ? 0
    : Math.round(Math.max(0, lossQuantity - allowanceQuantity) * 100) / 100;

  // 外部任务已携带的到厂附加费用优先沿用；普通采购按已确认的运输方式结算。
  const recordedAdditionalPerTon = purchase.additionalCostPerTon ?? 0;
  const handlingPerTon = isPickup
    ? 0
    : recordedAdditionalPerTon > 0
      ? Math.round(recordedAdditionalPerTon * 0.65 * 100) / 100
      : totals.transport.id === "combined"
        ? 11.6
        : 5.8;
  const insurancePerTon = isPickup
    ? 0
    : recordedAdditionalPerTon > 0
      ? Math.round(recordedAdditionalPerTon * 0.1 * 100) / 100
      : totals.transport.id === "combined"
        ? 1.8
        : 1.2;
  const otherPerTon = isPickup
    ? 0
    : Math.max(
        0,
        Math.round(
          (recordedAdditionalPerTon - handlingPerTon - insurancePerTon) * 100,
        ) / 100,
      );
  const handling = handlingPerTon * quantity;
  const insurance = insurancePerTon * quantity;
  const other = otherPerTon * quantity;
  const settledTotal = totals.goods + totals.logistics + handling + insurance + other;
  const baseUnit = settledTotal / quantity;
  // 超允差损耗按到厂单价向承运方赔付，从到厂总成本中扣回。
  const carrierCompensation = Math.round(overAllowanceQuantity * baseUnit * 100) / 100;
  const compensationPerTon = receivedQuantity > 0 ? carrierCompensation / receivedQuantity : 0;
  // 到厂总成本是扣回赔付后的净额；结算合计仍是各费用行之和。
  const netTotal = Math.round((settledTotal - carrierCompensation) * 100) / 100;
  // 损耗摊增只描述损耗本身的摊薄效应（不含赔付），赔付在结算调整里单列。
  const lossImpactPerTon = isPickup ? null : settledTotal / receivedQuantity - baseUnit;
  const landedUnit = isPickup ? null : (settledTotal - carrierCompensation) / receivedQuantity;

  return {
    ...totals,
    isComplete: !isPickup,
    shippedQuantity: quantity,
    receivedQuantity,
    lossQuantity,
    lossRate,
    lossAllowanceRate,
    allowanceQuantity,
    overAllowanceQuantity,
    carrierCompensation,
    compensationPerTon,
    netTotal,
    handlingPerTon,
    insurancePerTon,
    otherPerTon,
    handling,
    insurance,
    other,
    settledTotal,
    baseUnit,
    landedUnit,
    lossImpactPerTon,
    settlementBasis: "出库净重结算",
    lossResponsibility: isPickup
      ? "采购方自行承担"
      : overAllowanceQuantity > 0
        ? `超允差 ${overAllowanceQuantity} 吨 · 向承运方追赔`
        : "合同允差内由买方承担",
  };
}

export function orderProblems(purchase: Purchase): string[] {
  const { source, unit, days } = purchaseTotals(purchase);
  const problems: string[] = [];
  if (!purchase.qualified) problems.push("交易准入或资金账户尚未完成核验");
  if (purchase.need.quantity * purchase.need.budget * 0.1 > ACCOUNT_TOTAL - ACCOUNT_FROZEN)
    problems.push("本笔保证金预留金额超过账户可用额度，请调整采购计划");
  if (purchase.payee.trim() !== source.name)
    problems.push("收款主体与合同卖方不一致，请使用合同约定的对公收款账户");
  if (unit > purchase.need.budget)
    problems.push(
      purchase.transportId === "pickup"
        ? "粮款单价已超过到厂预算上限，自提费用尚未计入"
        : "到厂单价超出本次采购预算，请返回调整粮源或运输方案",
    );
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
      if (!item || typeof item !== "object" || item.flowVersion === 4)
        return item;
      if (item.flowVersion === 3) {
        return {
          ...item,
          // 旧版最后一步已同时完成核算与复盘，迁移后直接进入新的最终步骤。
          stage: item.stage === 6 ? 7 : item.stage,
          flowVersion: 4,
        };
      }
      if (item.flowVersion === 2) {
        // 旧七步版先看行情，前两步尚未完成的采购先重新确认需求。
        return {
          ...item,
          stage: item.stage < 2 ? 0 : item.stage === 6 ? 7 : item.stage,
          flowVersion: 4,
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
          stage: item.received ? 7 : item.stage === 0 ? 0 : item.stage + 1,
          flowVersion: 4,
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
        p.stage <= 7 &&
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
  const settlement = purchaseSettlement(purchase);
  return purchase.transportId === "pickup"
    ? `${settlement.source.depot}自行提货；平台粮款 ${formatMoney(settlement.baseUnit)} 元/吨，自提费用未纳入到厂成本。`
    : `${settlement.source.depot} + ${settlement.transport.label}；合格入库吨成本 ${formatMoney(settlement.landedUnit!)} 元，运输损耗 ${(settlement.lossRate * 100).toFixed(2)}%，${settlement.days} 天到货。`;
}
