// web/src/features/liang/ListingDetailDrawer.tsx
import type { Listing } from "./types";
import { fmtInt, fmtQuality, fmtDate } from "./format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

export default function ListingDetailDrawer({
  listing,
  onClose,
}: {
  listing: Listing;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {listing.variety_name} · {listing.grade} · {listing.crop_year}
          </h3>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink">
            ✕
          </button>
        </div>
        <div className="rounded-xl border border-line bg-rice p-4">
          <div className="text-[11px] text-ink-soft">报价</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-tech">
            {fmtInt(listing.price)}
            <span className="ml-1 text-xs font-normal text-ink-soft">
              元/吨 · {listing.price_type}
            </span>
          </div>
        </div>
        <div className="mt-4 divide-y divide-line/60 rounded-xl border border-line px-4">
          <Row label="标的号" value={listing.listing_code} />
          <Row label="供应方" value={listing.supplier_name} />
          <Row label="供应方地区" value={listing.supplier_region} />
          <Row label="产地" value={`${listing.origin_province} ${listing.origin_city}`} />
          <Row label="可用量" value={`${fmtInt(listing.available_quantity_tons)} 吨`} />
          <Row label="交收方式" value={listing.delivery_type} />
          <Row label="发运窗口" value={`${fmtDate(listing.earliest_ship_at)} ~ ${fmtDate(listing.latest_ship_at)}`} />
          <Row label="水分" value={`${fmtQuality(listing.moisture_pct)}%`} />
          <Row label="容重" value={`${fmtQuality(listing.test_weight_g_l)} g/L`} />
          <Row label="杂质" value={`${fmtQuality(listing.impurity_pct)}%`} />
        </div>
      </div>
    </div>
  );
}
