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
}: {
  listings: Listing[];
  onDetail: (l: Listing) => void;
}) {
  const { add, remove, has } = useCandidates();
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel shadow-[0_16px_36px_rgba(0,0,0,0.12)]">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-line bg-rice/40 text-left text-[11px] tracking-wide text-ink-soft">
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
              <tr key={l.id} className="border-b border-line/60 last:border-0 transition-colors hover:bg-rice-deep/45">
                <td className="px-4 py-3.5 font-medium text-ink">
                  <div>{l.variety_name}<span className="mx-1 text-ink-soft">·</span>{l.grade}</div>
                  <div className="mt-1 text-[11px] font-normal text-ink-soft">{l.listing_code} · {l.crop_year}年</div>
                </td>
                <td className="px-4 py-3 text-ink">
                  {l.origin_province} {l.origin_city}
                </td>
                <td className="px-4 py-3 text-ink">{l.supplier_name}</td>
                <td className="px-4 py-3.5 tabular-nums text-brand-deep">
                  <span className="text-base font-semibold">{fmtInt(l.price)}</span>
                  <span className="ml-1 text-[11px] text-ink-soft">元/吨</span>
                  <div className="mt-1 text-[11px] text-ink-soft">{l.price_type}</div>
                </td>
                <td className="px-4 py-3 tabular-nums text-ink">
                  {fmtInt(l.available_quantity_tons)}吨
                </td>
                <td className="px-4 py-3.5 text-ink">{l.delivery_type}</td>
                <td className="px-4 py-3.5 text-ink">{fmtDate(l.latest_ship_at)}</td>
                <td className="px-4 py-3.5">
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
