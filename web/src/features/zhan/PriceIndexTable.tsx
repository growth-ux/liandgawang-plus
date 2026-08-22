import type { SpotPrice } from "./types";
import { fmtInt, fmtPct, shortName } from "./format";

export default function PriceIndexTable({ spots }: { spots: SpotPrice[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-xs">
      <colgroup>
        <col className="w-[20%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
        <col className="w-[15%]" />
        <col className="w-[23%]" />
        <col className="w-[12%]" />
      </colgroup>
      <tbody>
        {spots.map((s) => {
          const up = Number(s.change_pct) > 0;
          const down = Number(s.change_pct) < 0;
          const isProducing = s.region_type === "产区";
          return (
            <tr key={s.spot_code} className="border-t border-line">
              <td className="py-2 pr-2 text-ink">{shortName(s.region_name)}</td>
              <td
                className={`py-2 pr-2 text-right font-semibold ${
                  isProducing ? "text-tech" : "text-brand"
                }`}
              >
                {fmtInt(s.price)}
              </td>
              <td
                className={`py-2 pr-2 text-right font-medium ${
                  up ? "text-emerald-400" : down ? "text-red-400" : "text-ink-soft"
                }`}
              >
                {fmtPct(s.change_pct)}
              </td>
              <td className="py-2 pl-6 pr-2 text-ink-soft">{s.quote_type}</td>
              <td className="py-2 pl-6 pr-2 text-ink-soft">{s.remark}</td>
              <td className="py-2 text-right text-ink-soft">{fmtInt(s.last_year_price)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
