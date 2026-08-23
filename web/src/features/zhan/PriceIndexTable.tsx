import type { SpotPrice } from "./types";
import { fmtInt, fmtPct, shortName } from "./format";

/** 涨跌着色遵循国内行情习惯：红涨绿跌 */
function chgTone(chg: number): string {
  return chg > 0 ? "text-red-400" : chg < 0 ? "text-emerald-400" : "text-ink-soft";
}

/** 价格指数表 */
export default function PriceIndexTable({ spots }: { spots: SpotPrice[] }) {
  return (
    <div>
      {/* 固定表头 */}
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-[20%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col className="w-[20%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line text-left text-ink-soft">
            <th className="pb-2 pr-2 font-normal">地点</th>
            <th className="pb-2 pr-2 text-right font-normal">价格</th>
            <th className="pb-2 pr-2 text-right font-normal">涨跌</th>
            <th className="pb-2 pl-4 pr-2 font-normal">口径</th>
            <th className="pb-2 pl-4 pr-2 font-normal">备注</th>
            <th className="pb-2 text-right font-normal">去年同期</th>
          </tr>
        </thead>
      </table>

      {/* 可滚动数据区 */}
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[20%]" />
            <col className="w-[18%]" />
          </colgroup>
          <tbody>
            {spots.map((s) => {
              const chg = Number(s.change_pct);
              const arrow = chg > 0 ? "▲ " : chg < 0 ? "▼ " : "";
              return (
                <tr
                  key={s.spot_code}
                  className="border-t border-line hover:bg-rice-deep/40"
                >
                  <td className="py-2 pr-2 text-ink">
                    {shortName(s.region_name)}
                  </td>
                  <td className="py-2 pr-2 text-right font-semibold tabular-nums text-ink">
                    {fmtInt(s.price)}
                  </td>
                  <td
                    className={`py-2 pr-2 text-right font-medium tabular-nums ${chgTone(chg)}`}
                  >
                    {arrow}
                    {fmtPct(s.change_pct)}
                  </td>
                  <td className="py-2 pl-4 pr-2 text-ink-soft">
                    {s.quote_type}
                  </td>
                  <td className="py-2 pl-4 pr-2 text-ink-soft">
                    {s.remark}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-soft">
                    {fmtInt(s.last_year_price)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
