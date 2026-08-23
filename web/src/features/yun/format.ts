// web/src/features/yun/format.ts
export function fmtInt(v: string | number): string {
  return Number(v).toLocaleString("zh-CN");
}
