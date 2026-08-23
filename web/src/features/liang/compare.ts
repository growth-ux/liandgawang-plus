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

function sortKey(l: Listing): [number, number, number, number, number] {
  return [
    fieldMissingCount(l),
    -l.crop_year, // 新粮优先（降序）
    Number(l.price),
    shipPenalty(l),
    l.id,
  ];
}

function buildPick(l: Listing): Pick {
  const missing = fieldMissingCount(l);
  return {
    listing: l,
    reasons: [`${l.crop_year} 年新粮，${l.grade}，${l.origin_province}产区`],
    risks: missing > 0 ? ["部分关键字段待核验"] : [],
    verification_count: FIXED_VERIFICATIONS.length,
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
