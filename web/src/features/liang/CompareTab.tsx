import { useEffect, useState } from "react";
import { interpretCandidateComparison } from "./api";
import { useCandidates } from "./CandidateContext";
import { fmtDate, fmtInt, fmtQuality } from "./format";
import type { ComparisonInterpretation, Listing } from "./types";

function CompareTable({ listings, onRemove }: { listings: Listing[]; onRemove: (id: number) => void }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel shadow-[0_16px_36px_rgba(0,0,0,0.12)]">
      <table className="w-full min-w-[1080px] text-sm">
        <thead>
          <tr className="border-b border-line bg-rice/40 text-left text-[11px] tracking-wide text-ink-soft">
            <th className="px-4 py-3 font-normal">品种·等级·年份</th>
            <th className="px-4 py-3 font-normal">产地</th>
            <th className="px-4 py-3 font-normal">供应方</th>
            <th className="px-4 py-3 font-normal">报价（口径）</th>
            <th className="px-4 py-3 font-normal">可用量</th>
            <th className="px-4 py-3 font-normal">交收方式</th>
            <th className="px-4 py-3 font-normal">发运窗口</th>
            <th className="px-4 py-3 font-normal">质检指标</th>
            <th className="px-4 py-3 font-normal">操作</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.id} className="border-b border-line/60 last:border-0 transition-colors hover:bg-rice-deep/45">
              <td className="px-4 py-3.5 font-medium text-ink">
                {listing.variety_name} · {listing.grade}
              </td>
              <td className="px-4 py-3 text-ink">{listing.origin_province} {listing.origin_city}</td>
              <td className="px-4 py-3 text-ink">{listing.supplier_name}</td>
              <td className="px-4 py-3.5 tabular-nums text-brand-deep">
                <span className="text-base font-semibold">{fmtInt(listing.price)}</span>
                <span className="ml-1 text-[11px] text-ink-soft">元/吨</span>
                <div className="mt-1 text-[11px] font-normal text-ink-soft">{listing.price_type}</div>
              </td>
              <td className="px-4 py-3 tabular-nums text-ink">{fmtInt(listing.available_quantity_tons)} 吨</td>
              <td className="px-4 py-3 text-ink">{listing.delivery_type}</td>
              <td className="px-4 py-3 text-ink">
                {fmtDate(listing.earliest_ship_at)}
                <span className="mx-1 text-ink-soft">~</span>
                {fmtDate(listing.latest_ship_at)}
              </td>
              <td className="px-4 py-3 text-xs leading-5 text-ink-soft">
                <div>水分 {fmtQuality(listing.moisture_pct)}%</div>
                <div>容重 {fmtQuality(listing.test_weight_g_l)} g/L</div>
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onRemove(listing.id)}
                  className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:border-red-400 hover:text-red-400"
                >
                  移出对比
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidateSelector({
  listings,
  selectedIds,
  onToggle,
}: {
  listings: Listing[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}) {
  const selected = new Set(selectedIds);
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line bg-rice/40 text-left text-[11px] tracking-wide text-ink-soft">
            <th className="w-14 px-4 py-3 text-center font-normal">选择</th>
            <th className="px-4 py-3 font-normal">粮源</th>
            <th className="px-4 py-3 font-normal">产地</th>
            <th className="px-4 py-3 font-normal">供应方</th>
            <th className="px-4 py-3 font-normal">报价</th>
            <th className="px-4 py-3 font-normal">可用量</th>
            <th className="px-4 py-3 font-normal">最晚可发</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.id} className={`border-b border-line/60 last:border-0 ${selected.has(listing.id) ? "bg-brand-faint/40" : ""}`}>
              <td className="px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={selected.has(listing.id)}
                  onChange={() => onToggle(listing.id)}
                  aria-label={`选择 ${listing.variety_name} ${listing.grade}，${listing.supplier_name}`}
                  className="h-4 w-4 cursor-pointer accent-brand"
                />
              </td>
              <td className="px-4 py-3 font-medium text-ink">
                {listing.variety_name} · {listing.grade}
                <span className="ml-1.5 text-xs font-normal text-ink-soft">{listing.crop_year} 年</span>
              </td>
              <td className="px-4 py-3 text-ink">{listing.origin_province} {listing.origin_city}</td>
              <td className="px-4 py-3 text-ink">{listing.supplier_name}</td>
              <td className="px-4 py-3 tabular-nums text-brand-deep">
                {fmtInt(listing.price)}<span className="ml-1 text-[11px] text-ink-soft">元/吨</span>
              </td>
              <td className="px-4 py-3 tabular-nums text-ink">{fmtInt(listing.available_quantity_tons)} 吨</td>
              <td className="px-4 py-3 text-ink">{fmtDate(listing.latest_ship_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiInterpretation({ interpretation, listings }: { interpretation: ComparisonInterpretation; listings: Listing[] }) {
  const listingName = (id: number) => {
    const listing = listings.find((item) => item.id === id);
    return listing ? `${listing.listing_code} · ${listing.supplier_name}` : "候选粮源";
  };
  return (
    <section className="rounded-2xl border border-brand/35 bg-brand-faint/35 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium tracking-[0.14em] text-brand-deep">AI COMPARISON INSIGHT</div>
          <h3 className="mt-1 text-base font-semibold text-ink">粮小二深度解读</h3>
        </div>
        <span className="rounded-full border border-brand/25 bg-panel px-2.5 py-1 text-[11px] text-brand-deep">{interpretation.source === "llm" ? "AI 生成" : "智能解读"}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink">{interpretation.summary}</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel/80 p-4">
          <div className="text-xs font-medium text-brand-deep">建议关注</div>
          <p className="mt-2 text-sm leading-6 text-ink">{interpretation.recommendation}</p>
        </div>
        <div className="rounded-xl border border-line bg-panel/80 p-4">
          <div className="text-xs font-medium text-brand-deep">关键差异</div>
          <ul className="mt-2 space-y-1.5">
            {interpretation.key_differences.map((item) => <li key={item} className="text-sm leading-5 text-ink">· {item}</li>)}
          </ul>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {interpretation.item_reviews.map((review) => (
          <div key={review.listing_id} className="rounded-xl border border-line bg-panel/80 p-4">
            <div className="text-sm font-medium text-ink">{listingName(review.listing_id)}</div>
            <div className="mt-2 text-xs font-medium text-tech">优势</div>
            <p className="mt-1 text-xs leading-5 text-ink-soft">{review.advantages.join("；")}</p>
            <div className="mt-2 text-xs font-medium text-amber-300">需核验</div>
            <p className="mt-1 text-xs leading-5 text-ink-soft">{review.risks.join("；")}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CompareTab({ onGoFind }: { onGoFind: () => void }) {
  const { candidates, clear, remove } = useCandidates();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [compared, setCompared] = useState(false);
  const [interpretation, setInterpretation] = useState<ComparisonInterpretation | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds((previous) => {
      const activeIds = new Set(candidates.map((candidate) => candidate.id));
      const retained = previous.filter((id) => activeIds.has(id));
      const additions = candidates.map((candidate) => candidate.id).filter((id) => !retained.includes(id));
      return [...retained, ...additions];
    });
    setCompared(false);
    setInterpretation(null);
  }, [candidates]);

  const selectedListings = candidates.filter((candidate) => selectedIds.includes(candidate.id));
  const toggle = (id: number) => {
    setSelectedIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
    setCompared(false);
    setInterpretation(null);
  };

  async function runComparison() {
    if (selectedListings.length < 2 || interpreting) return;
    setInterpreting(true);
    setInterpretError(null);
    setInterpretation(null);
    try {
      const result = await interpretCandidateComparison(selectedListings.map((listing) => listing.id));
      setInterpretation(result);
      setCompared(true);
    } catch (error) {
      setInterpretError(error instanceof Error ? error.message : "暂时无法生成对比解读");
    } finally {
      setInterpreting(false);
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 px-6 text-center">
        <span className="text-[11px] font-medium tracking-[0.16em] text-tech">CANDIDATE COMPARISON</span>
        <h2 className="mt-3 text-lg font-semibold text-ink">暂未选择粮源</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-ink-soft">
          前往「找粮源」勾选至少 2 条粮源，再从报价、可用量、发运和质检指标中进行横向比较。
        </p>
        <button
          type="button"
          onClick={onGoFind}
          className="mt-5 h-10 rounded-full bg-brand px-6 text-sm font-medium text-white"
        >
          去找粮源
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-5 py-4">
        <div>
          <div className="text-[11px] font-medium tracking-[0.14em] text-tech">CANDIDATE POOL</div>
          <h2 className="mt-1 text-base font-semibold text-ink">候选粮源 {candidates.length} 条</h2>
          <p className="mt-1 text-xs text-ink-soft">
            勾选本次需要比较的粮源，再生成横向对比结果。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onGoFind} className="h-9 rounded-full border border-line px-4 text-sm text-ink transition-colors hover:border-tech">
            继续找粮
          </button>
          <button type="button" onClick={clear} className="h-9 rounded-full px-3 text-sm text-ink-soft transition-colors hover:text-red-400">
            清空候选
          </button>
        </div>
      </div>
      <CandidateSelector listings={candidates} selectedIds={selectedIds} onToggle={toggle} />
      <div className="flex items-center justify-between rounded-2xl border border-line bg-rice/50 px-5 py-3.5">
        <span className="text-sm text-ink-soft">本次已勾选 <span className="font-semibold text-ink">{selectedListings.length}</span> 条粮源</span>
        <button
          type="button"
          disabled={selectedListings.length < 2}
          onClick={runComparison}
          className="h-10 rounded-full bg-brand px-6 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {interpreting ? "粮小二分析中…" : `一键对比 ${selectedListings.length > 0 ? `${selectedListings.length} 条` : ""}`}
        </button>
      </div>
      {interpretError && <p className="text-sm text-red-400">{interpretError}</p>}
      {compared && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <div className="text-[11px] font-medium tracking-[0.14em] text-tech">COMPARISON RESULT</div>
              <h3 className="mt-1 text-base font-semibold text-ink">横向对比结果</h3>
            </div>
            <span className="text-xs text-ink-soft">共 {selectedListings.length} 条</span>
          </div>
          {interpretation && <AiInterpretation interpretation={interpretation} listings={selectedListings} />}
          <CompareTable listings={selectedListings} onRemove={remove} />
        </div>
      )}
    </div>
  );
}
