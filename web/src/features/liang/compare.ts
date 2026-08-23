// web/src/features/liang/compare.ts
import type {
  CompareResult,
  Elimination,
  Listing,
  NeedInput,
  NeedSummary,
  Pick,
} from "./types";

const GRADE_ORDER = ["一等", "二等", "三等", "四等"];
// mock 数据基准日期，与种子 PRICE_DATE（2026-08-23）一致，保证结果可复现
const BASE_DATE = "2026-08-23";

// 品种质量标准：水分 % / 容重 g/L（二等基准，用于质量折价）
const VARIETY_STD: Record<string, { moisture: number; testWeight: number }> = {
  玉米: { moisture: 14.0, testWeight: 685 },
  小麦: { moisture: 12.5, testWeight: 770 },
  大豆: { moisture: 13.0, testWeight: 680 },
};

// 价格口径 → 估算到厂运费（元/吨）：出厂价需全程运费，港口价需港到厂短驳，到库价视为已到厂
const FREIGHT_ADJUSTMENT: Record<string, number> = {
  出厂价: 90,
  港口价: 40,
  到库价: 0,
};

const FIXED_VERIFICATIONS = [
  "确认可锁定库存",
  "获取正式质检单",
  "确认报价有效期与含税口径",
  "确认装运窗口",
  "核验供应方主体与联系人",
];

function hasNeed(need: NeedInput | null): boolean {
  if (!need) return false;
  return !!(
    need.variety ||
    need.quantity_tons != null ||
    need.grade ||
    need.crop_year != null ||
    need.deadline_days != null ||
    need.budget_price != null
  );
}

/** ISO 日期相对基准日期的天数 */
function daysFromBase(iso: string): number {
  const base = Date.parse(`${BASE_DATE}T00:00:00Z`);
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - base) / 86400000);
}

function addDays(days: number): string {
  const d = new Date(`${BASE_DATE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function gradeRank(g: string): number {
  const i = GRADE_ORDER.indexOf(g);
  return i < 0 ? 99 : i;
}

function fieldMissingCount(l: Listing): number {
  let n = 0;
  if (!l.earliest_ship_at || !l.latest_ship_at) n += 1;
  if (l.test_weight_g_l == null) n += 1;
  if (l.moisture_pct == null) n += 1;
  return n;
}

function hardFail(
  l: Listing,
  need: NeedInput,
  deadlineDays: number | null,
): string | null {
  if (need.variety && l.variety_name !== need.variety) return "VARIETY_MISMATCH";
  if (need.quantity_tons != null && l.available_quantity_tons < need.quantity_tons) {
    return "QUANTITY_INSUFFICIENT";
  }
  if (need.grade && gradeRank(l.grade) > gradeRank(need.grade)) {
    return "GRADE_BELOW_REQUIREMENT";
  }
  if (need.crop_year != null && l.crop_year !== need.crop_year) {
    return "CROP_YEAR_MISMATCH";
  }
  if (need.budget_price != null && Number(l.price) > need.budget_price) {
    return "PRICE_OVER_BUDGET";
  }
  if (deadlineDays != null) {
    if (!l.latest_ship_at) return "REQUIRED_FIELD_MISSING";
    if (daysFromBase(l.latest_ship_at) > deadlineDays) return "SHIP_WINDOW_MISSED";
  }
  return null;
}

const REASON_TEXT: Record<string, (l: Listing, need: NeedInput) => string> = {
  VARIETY_MISMATCH: (l, need) => `品种为${l.variety_name}，与需求的${need.variety}不符`,
  QUANTITY_INSUFFICIENT: (l, need) =>
    `可用量 ${l.available_quantity_tons} 吨，不足需求的 ${need.quantity_tons} 吨`,
  GRADE_BELOW_REQUIREMENT: (l, need) => `等级为${l.grade}，低于需求的${need.grade}`,
  CROP_YEAR_MISMATCH: (l, need) => `年份为${l.crop_year}，与需求的${need.crop_year}不符`,
  PRICE_OVER_BUDGET: (l, need) =>
    `报价 ${l.price} 元/吨，超过预算 ${need.budget_price} 元/吨`,
  SHIP_WINDOW_MISSED: (l) => `最晚可发 ${l.latest_ship_at}，晚于需求期限`,
  REQUIRED_FIELD_MISSING: () => `缺少发运窗口，无法确认能否按时交付`,
};

function shipPenalty(l: Listing): number {
  if (!l.latest_ship_at) return 999;
  return daysFromBase(l.latest_ship_at);
}

/** 折算到厂价（元/吨）：挂牌价 + 口径运费 */
function deliveredPrice(l: Listing): number {
  return Number(l.price) + (FREIGHT_ADJUSTMENT[l.price_type] ?? 0);
}

/** 质量折价（元/吨，正=扣款）：水分/杂质超标、容重偏低 */
function qualityPenalty(l: Listing): number {
  const std = VARIETY_STD[l.variety_name] ?? { moisture: 14.0, testWeight: 685 };
  let penalty = 0;
  if (l.moisture_pct != null) {
    const over = Number(l.moisture_pct) - std.moisture;
    if (over > 0) penalty += over * 10 * 3; // 每超 0.1% 扣 3 元/吨
  }
  if (l.impurity_pct != null) {
    const over = Number(l.impurity_pct) - 1.0;
    if (over > 0) penalty += over * 10 * 2; // 每超 0.1% 扣 2 元/吨
  }
  if (l.test_weight_g_l != null) {
    const under = std.testWeight - Number(l.test_weight_g_l);
    if (under > 0) penalty += under; // 每低 1 g/L 扣 1 元/吨
  }
  return Math.round(penalty);
}

/** 综合到厂成本（元/吨）= 到厂价 + 质量折价，排序以它为准 */
function totalDeliveredCost(l: Listing): number {
  return deliveredPrice(l) + qualityPenalty(l);
}

function sortKey(l: Listing): [number, number, number, number, number] {
  return [
    fieldMissingCount(l),
    -l.crop_year, // 新粮优先（降序）
    totalDeliveredCost(l), // 综合到厂成本越低越好
    shipPenalty(l),
    l.id,
  ];
}

function buildPick(l: Listing): Pick {
  const missing = fieldMissingCount(l);
  const std = VARIETY_STD[l.variety_name];
  const penalty = qualityPenalty(l);

  const reasons: string[] = [`${l.crop_year} 年新粮，${l.grade}，${l.origin_province}产区`];
  if (std && l.moisture_pct != null && Number(l.moisture_pct) <= std.moisture) {
    reasons.push(`水分 ${l.moisture_pct}% 优于标准 ${std.moisture}%`);
  }
  if (std && l.test_weight_g_l != null && Number(l.test_weight_g_l) >= std.testWeight) {
    reasons.push(`容重 ${l.test_weight_g_l} g/L 达标`);
  }
  if (penalty > 0) reasons.push(`质量折价 ${penalty} 元/吨已计入`);

  const risks: string[] = [];
  if (missing > 0) risks.push("部分关键字段待核验");
  if (std && l.moisture_pct != null && Number(l.moisture_pct) > std.moisture) {
    risks.push(`水分 ${l.moisture_pct}% 超标（标准 ${std.moisture}%）`);
  }
  if (std && l.test_weight_g_l != null && Number(l.test_weight_g_l) < std.testWeight) {
    risks.push(`容重 ${l.test_weight_g_l} g/L 偏低`);
  }
  if (l.test_weight_g_l == null) risks.push("容重未提供");

  return {
    listing: l,
    reasons,
    risks,
    verification_count: FIXED_VERIFICATIONS.length,
    delivered_price: totalDeliveredCost(l).toFixed(2),
    quality_penalty: String(penalty),
  };
}

export function compareListings(
  allListings: Listing[],
  candidates: Listing[],
  need: NeedInput | null,
): CompareResult {
  const scope = candidates.length > 0 ? candidates : allListings;
  const has = hasNeed(need);

  if (!has || !need) {
    return {
      has_need: false,
      scope,
      primary: null,
      backup: null,
      eliminated: [],
      verifications: [],
      need_summary: null,
    };
  }

  const deadlineDays = need.deadline_days ?? null;
  const passed: Listing[] = [];
  const eliminated: Elimination[] = [];

  for (const l of scope) {
    const code = hardFail(l, need, deadlineDays);
    if (code) {
      eliminated.push({
        listing: l,
        reason_code: code,
        reason_text: REASON_TEXT[code](l, need),
      });
    } else {
      passed.push(l);
    }
  }

  passed.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  });

  const needSummary: NeedSummary = {
    variety: need.variety,
    quantity_tons: need.quantity_tons,
    grade: need.grade,
    crop_year: need.crop_year,
    deadline: need.deadline_days != null ? addDays(need.deadline_days) : undefined,
    budget_price: need.budget_price,
  };

  return {
    has_need: true,
    scope,
    primary: passed.length > 0 ? buildPick(passed[0]) : null,
    backup: passed.length > 1 ? buildPick(passed[1]) : null,
    eliminated,
    verifications: FIXED_VERIFICATIONS,
    need_summary: needSummary,
  };
}
