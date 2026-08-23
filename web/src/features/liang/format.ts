// web/src/features/liang/format.ts
export function fmtInt(v: string | number): string {
  return Number(v).toLocaleString("zh-CN");
}

/** 质检/日期等可空字段：空则显示 -- */
export function fmtQuality(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "--";
  return v;
}

/** ISO 日期 → MM-DD */
export function fmtDate(v: string | null | undefined): string {
  if (!v) return "--";
  return v.slice(5);
}

/** ISO 时间 → YYYY-MM-DD HH:mm */
export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return "--";
  return v.slice(0, 16).replace("T", " ");
}
