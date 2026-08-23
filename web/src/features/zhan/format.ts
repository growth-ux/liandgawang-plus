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

/** 数字转带符号百分比（保留 1 位小数），用于均价环比等统计 */
export function fmtSignedPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

/** 去掉省份前缀："黑龙江·绥化" -> "绥化"；"天津" -> "天津" */
export function shortName(regionName: string): string {
  const idx = regionName.indexOf("·");
  return idx >= 0 ? regionName.slice(idx + 1) : regionName;
}
