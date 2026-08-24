import { useMemo, useState } from "react";
import type { Partner, PartnerType } from "./types";

export default function NewRiskReviewDialog({
  partners,
  onClose,
  onConfirm,
}: {
  partners: Partner[];
  onClose: () => void;
  onConfirm: (partnerId: string) => void;
}) {
  const [type, setType] = useState<PartnerType>("grain");
  const available = useMemo(
    () => partners.filter((partner) => partner.type === type && !partner.id.startsWith("H-")),
    [partners, type],
  );
  const [selectedByType, setSelectedByType] = useState<Record<PartnerType, string>>({
    grain: partners.find((partner) => partner.type === "grain" && !partner.id.startsWith("H-"))?.id ?? "",
    logistics: partners.find((partner) => partner.type === "logistics" && !partner.id.startsWith("H-"))?.id ?? "",
    finance: partners.find((partner) => partner.type === "finance" && !partner.id.startsWith("H-"))?.id ?? "",
  });
  const selectedId = selectedByType[type];
  const selected = partners.find((partner) => partner.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="新建合作方体检">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-emerald-400/25 bg-panel shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-300/70">Independent review</p>
            <h2 className="mt-1 text-lg font-semibold">新建合作方体检</h2>
            <p className="mt-1 text-xs text-ink-soft">不关联其他小二任务，基于合作方资料和企业经验独立审查。</p>
          </div>
          <button type="button" onClick={onClose} className="text-xl text-ink-soft hover:text-ink" aria-label="关闭">×</button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <div className="text-xs font-medium">1. 选择合作方类型</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {([[
                "grain", "粮源供应方",
              ], [
                "logistics", "物流服务方",
              ], [
                "finance", "资金服务方",
              ]] as Array<[PartnerType, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`rounded-xl border px-3 py-3 text-xs transition ${type === value ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-300" : "border-line bg-rice/30 text-ink-soft hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="partner-select" className="text-xs font-medium">2. 选择系统已有合作方</label>
            <select
              id="partner-select"
              value={selectedId}
              onChange={(event) => setSelectedByType((current) => ({ ...current, [type]: event.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-line bg-rice px-3 text-sm outline-none focus:border-emerald-400/35"
            >
              {available.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
            </select>
          </div>

          {selected && (
            <div className="rounded-2xl border border-line bg-rice/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{selected.name}</div>
                  <div className="mt-1 text-xs text-ink-soft">{selected.region} · {selected.business}</div>
                </div>
                <span className="rounded-full bg-rice-deep px-2.5 py-1 text-[10px] text-ink-soft">已有基础资料</span>
              </div>
              <p className="mt-3 border-t border-line pt-3 text-[11px] leading-5 text-ink-soft">本次不关联具体业务方案，结论只基于合作方基础资料和企业历史经验，不替代交易场景核验。</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full border border-line px-5 py-2 text-sm text-ink-soft">取消</button>
          <button type="button" disabled={!selectedId} onClick={() => onConfirm(selectedId)} className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-medium text-slate-950 disabled:opacity-40">开始体检</button>
        </div>
      </div>
    </div>
  );
}
