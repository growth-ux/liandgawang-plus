// web/src/features/liang/ListingTable.tsx
import type { Listing } from "./types";
import { fmtInt, fmtQuality, fmtDate } from "./format";
import { useCandidates } from "./CandidateContext";

function QualityCell({ listing }: { listing: Listing }) {
  const parts = [
    listing.moisture_pct ? `水分${fmtQuality(listing.moisture_pct)}%` : null,
    listing.test_weight_g_l ? `容重${fmtQuality(listing.test_weight_g_l)}` : null,
  ].filter(Boolean);
  return <span className="text-xs text-ink-soft">{parts.length ? parts.join(" · ") : "--"}</span>;
}

export default function ListingTable({
  listings,
  onDetail,
  onAnalyze,
}: {
  listings: Listing[];
  onDetail: (l: Listing) => void;
  onAnalyze: (l: Listing) => void;
}) {
  const { add, remove, has } = useCandidates();
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-soft">
            <th className="px-4 py-3 font-normal">品种·等级</th>
            <th className="px-4 py-3 font-normal">产地</th>
            <th className="px-4 py-3 font-normal">供应方</th>
            <th className="px-4 py-3 font-normal">报价（口径）</th>
            <th className="px-4 py-3 font-normal">可用量</th>
            <th className="px-4 py-3 font-normal">交收</th>
            <th className="px-4 py-3 font-normal">最晚可发</th>
            <th className="px-4 py-3 font-normal">质检</th>
            <th className="px-4 py-3 font-normal">操作</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => {
            const added = has(l.id);
            return (
              <tr key={l.id} className="border-b border-line/60 last:border-0 hover:bg-rice-deep/40">
                <td className="px-4 py-3 font-medium text-ink">
                  {l.variety_name}·{l.grade}
                </td>
                <td className="px-4 py-3 text-ink">
                  {l.origin_province} {l.origin_city}
                </td>
                <td className="px-4 py-3 text-ink">{l.supplier_name}</td>
                <td className="px-4 py-3 tabular-nums text-ink">
                  {fmtInt(l.price)}
                  <span className="ml-1 text-xs text-ink-soft">{l.price_type}</span>
                </td>
                <td className="px-4 py-3 tabular-nums text-ink">
                  {fmtInt(l.available_quantity_tons)}吨
                </td>
                <td className="px-4 py-3 text-ink">{l.delivery_type}</td>
                <td className="px-4 py-3 text-ink">{fmtDate(l.latest_ship_at)}</td>
                <td className="px-4 py-3">
                  <QualityCell listing={l} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => (added ? remove(l.id) : add(l))}
                      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                        added
                          ? "bg-tech font-medium text-rice"
                          : "border border-line text-ink-soft hover:border-tech hover:text-ink"
                      }`}
                    >
                      {added ? "已加入" : "+ 候选"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        add(l);
                        onAnalyze(l);
                      }}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft hover:border-tech hover:text-ink"
                    >
                      分析
                    </button>
                    <button
                      type="button"
                      onClick={() => onDetail(l)}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft hover:border-tech hover:text-ink"
                    >
                      详情
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
