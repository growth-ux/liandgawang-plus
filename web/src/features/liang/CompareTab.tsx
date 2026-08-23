// web/src/features/liang/CompareTab.tsx
import { useEffect, useState } from "react";
import { fetchListings } from "./api";
import { useCandidates } from "./CandidateContext";
import { compareListings } from "./compare";
import NeedInputBar from "./NeedInputBar";
import { fmtInt, fmtQuality, fmtDate } from "./format";
import type { CompareResult, Listing, NeedInput, NeedSummary, Pick } from "./types";

function NeedSummaryCard({ summary }: { summary: NeedSummary }) {
  const parts: string[] = [];
  if (summary.variety) parts.push(summary.variety);
  if (summary.grade) parts.push(summary.grade);
  if (summary.crop_year) parts.push(`${summary.crop_year} 年`);
  if (summary.quantity_tons != null) parts.push(`${summary.quantity_tons} 吨`);
  if (summary.deadline) parts.push(`最晚 ${summary.deadline} 发运`);
  if (summary.budget_price != null) parts.push(`预算 ≤ ${summary.budget_price} 元/吨`);
  return (
    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
      <span className="text-xs text-ink-soft">当前需求</span>
      <div className="mt-1 text-sm font-medium text-ink">
        {parts.length ? parts.join(" · ") : "未指定条件"}
      </div>
    </div>
  );
}

function PickCard({ pick, label }: { pick: Pick; label: string }) {
  const l = pick.listing;
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-brand-deep">{label}</span>
        <span className="text-xs text-ink-soft">{l.listing_code}</span>
      </div>
      <div className="mt-2 text-lg font-semibold text-ink">
        {l.variety_name} · {l.grade} · {l.crop_year}
        <span className="ml-2 text-sm font-normal text-ink-soft">
          {l.origin_province} {l.origin_city}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-tech">
        {fmtInt(pick.delivered_price)}
        <span className="ml-1 text-xs font-normal text-ink-soft">元/吨（到厂价）</span>
      </div>
      <div className="mt-1 text-xs text-ink-soft">
        挂牌 {fmtInt(l.price)} 元/吨 · {l.price_type}
        {Number(pick.quality_penalty) > 0 && ` · 质量折价 ${pick.quality_penalty} 元/吨`}
      </div>
      <div className="mt-3 space-y-1 text-sm text-ink">
        <div>供应方：{l.supplier_name}</div>
        <div>可用量：{fmtInt(l.available_quantity_tons)} 吨 · {l.delivery_type}</div>
        <div>发运：{fmtDate(l.earliest_ship_at)} ~ {fmtDate(l.latest_ship_at)}</div>
        <div>
          质检：水分 {fmtQuality(l.moisture_pct)}% · 容重 {fmtQuality(l.test_weight_g_l)} g/L · 杂质{" "}
          {fmtQuality(l.impurity_pct)}%
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-rice px-4 py-2.5">
        <div className="text-xs text-ink-soft">入选理由</div>
        <div className="mt-1 text-sm text-ink">{pick.reasons.join("；")}</div>
      </div>
      {pick.risks.length > 0 && (
        <div className="mt-2 text-xs text-amber-300">风险：{pick.risks.join("；")}</div>
      )}
      <div className="mt-2 text-xs text-ink-soft">待核验 {pick.verification_count} 项</div>
    </div>
  );
}

function EliminatedList({ eliminated }: { eliminated: CompareResult["eliminated"] }) {
  if (eliminated.length === 0) return null;
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 text-sm font-semibold">未入选原因</div>
      <ul className="space-y-2">
        {eliminated.map((e) => (
          <li key={e.listing.id} className="flex items-start justify-between gap-4 text-sm">
            <span className="shrink-0 text-ink">
              {e.listing.variety_name}·{e.listing.grade} · {e.listing.supplier_name}
            </span>
            <span className="text-right text-ink-soft">{e.reason_text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VerificationList({ verifications }: { verifications: string[] }) {
  if (verifications.length === 0) return null;
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 text-sm font-semibold">交易前待核验清单</div>
      <ol className="space-y-1.5">
        {verifications.map((v, i) => (
          <li key={v} className="text-sm text-ink">
            <span className="mr-2 text-ink-soft">{i + 1}.</span>
            {v}
          </li>
        ))}
      </ol>
    </div>
  );
}

function CompareTable({ result }: { result: CompareResult }) {
  const reasonOf = (id: number) =>
    result.eliminated.find((e) => e.listing.id === id)?.reason_code;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-soft">
            <th className="px-4 py-3 font-normal">品种·等级·年份</th>
            <th className="px-4 py-3 font-normal">产地</th>
            <th className="px-4 py-3 font-normal">供应方</th>
            <th className="px-4 py-3 font-normal">报价（口径）</th>
            <th className="px-4 py-3 font-normal">可用量</th>
            <th className="px-4 py-3 font-normal">发运</th>
            <th className="px-4 py-3 font-normal">质检</th>
            <th className="px-4 py-3 font-normal">状态</th>
          </tr>
        </thead>
        <tbody>
          {result.scope.map((l) => {
            const code = reasonOf(l.id);
            const isPrimary = result.primary?.listing.id === l.id;
            const isBackup = result.backup?.listing.id === l.id;
            return (
              <tr key={l.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 text-ink">
                  {l.variety_name}·{l.grade}·{l.crop_year}
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
                <td className="px-4 py-3 text-ink">{fmtDate(l.latest_ship_at)}</td>
                <td className="px-4 py-3 text-xs text-ink-soft">
                  {l.moisture_pct ? `水分${fmtQuality(l.moisture_pct)}%` : "--"}
                </td>
                <td className="px-4 py-3">
                  {isPrimary ? (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">主推</span>
                  ) : isBackup ? (
                    <span className="rounded-full bg-tech px-2 py-0.5 text-xs text-rice">备选</span>
                  ) : code ? (
                    <span className="text-xs text-ink-soft">{code}</span>
                  ) : (
                    <span className="text-xs text-ink-soft">候选</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CompareTab({
  need,
  onNeedChange,
}: {
  need: NeedInput | null;
  onNeedChange: (need: NeedInput, raw: string) => void;
}) {
  const { candidates } = useCandidates();
  const [all, setAll] = useState<Listing[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchListings()
      .then((d) => {
        if (!cancelled) setAll(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const result = compareListings(all, candidates, need);

  return (
    <div className="flex flex-col gap-4">
      <NeedInputBar onSubmit={onNeedChange} />

      {result.scope.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <p className="text-sm text-ink-soft">还没有可对比的粮源</p>
          <p className="mt-2 text-xs text-ink-soft">
            去「找粮源」收藏候选，或在上方描述你的采购需求。
          </p>
        </div>
      ) : (
        <>
          {result.need_summary && <NeedSummaryCard summary={result.need_summary} />}

          {result.primary && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PickCard pick={result.primary} label="主推粮源" />
              {result.backup ? (
                <PickCard pick={result.backup} label="备选粮源" />
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-line bg-panel/40 text-sm text-ink-soft">
                  暂无满足硬条件的备选
                </div>
              )}
            </div>
          )}

          <EliminatedList eliminated={result.eliminated} />
          <VerificationList verifications={result.verifications} />
          <CompareTable result={result} />
        </>
      )}
    </div>
  );
}
