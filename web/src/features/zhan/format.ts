/** 价格字符串（如 "2310.00"）转整数展示 */
export function fmtInt(v: string): string {
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(0);
}

/** 涨跌字符串（如 "1.20" / "-0.30"）转带符号百分比 */
export function fmtPct(v: string): string {
  const n = Number(v);
  return `${n > 0 ? "+" : ""}${n}%`;
}

/** 去掉省份前缀："黑龙江·绥化" -> "绥化"；"天津" -> "天津" */
export function shortName(regionName: string): string {
  const idx = regionName.indexOf("·");
  return idx >= 0 ? regionName.slice(idx + 1) : regionName;
}

/** ISO 日期转短日期（含两位年份）："2026-08-22" -> "26-08" */
export function fmtDate(iso: string): string {
  return iso.slice(2, 7);
}
