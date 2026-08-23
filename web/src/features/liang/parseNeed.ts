// web/src/features/liang/parseNeed.ts
import type { NeedInput } from "./types";

const VARIETY_KEYWORDS: [string, string][] = [
  ["玉米", "玉米"],
  ["小麦", "小麦"],
  ["大豆", "大豆"],
  ["稻谷", "稻谷"],
];

/** 从自然语言中确定性提取采购需求字段，可复现、不接 LLM。 */
export function parseNeed(text: string): NeedInput {
  const need: NeedInput = {};
  const qty = text.match(/(\d+(?:\.\d+)?)\s*(?:吨|t|T)/);
  if (qty) need.quantity_tons = Number(qty[1]);
  const grade = text.match(/(一等|二等|三等|四等)/);
  if (grade) need.grade = grade[1];
  for (const [kw, name] of VARIETY_KEYWORDS) {
    if (text.includes(kw)) {
      need.variety = name;
      break;
    }
  }
  const days = text.match(/(\d+)\s*天/);
  if (days) need.deadline_days = Number(days[1]);
  const price = text.match(/(\d+(?:\.\d+)?)\s*元/);
  if (price) need.budget_price = Number(price[1]);
  const year = text.match(/(20\d{2})\s*年/);
  if (year) need.crop_year = Number(year[1]);
  return need;
}
