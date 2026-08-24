import { useNavigate } from "react-router-dom";
import type { RiskHandoffDraft } from "./handoff";
import { saveRiskHandoff } from "./handoff";

export default function RiskHandoffDialog({ draft, onClose }: { draft: RiskHandoffDraft; onClose: () => void }) {
  const navigate = useNavigate();

  const confirm = () => {
    saveRiskHandoff(draft);
    navigate("/agent/an?from=handoff");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="确认交给安小二">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-400/25 bg-panel shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
        <div className="relative border-b border-line px-6 py-5">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgba(52,211,153,.12)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-300/70">Risk handoff</p>
              <h2 className="mt-1 text-lg font-semibold">确认交给安小二</h2>
              <p className="mt-1 text-xs text-ink-soft">安小二只做独立风控，不会修改当前推荐结果。</p>
            </div>
            <button type="button" onClick={onClose} className="text-xl leading-none text-ink-soft hover:text-ink" aria-label="关闭">×</button>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-2xl border border-line bg-rice/45 p-4">
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <Field label="审查对象" value={draft.partnerName} />
              <Field label="对象类型" value={draft.partnerType === "grain" ? "粮源供应方" : draft.partnerType === "logistics" ? "物流服务方" : "资金服务方"} />
              <Field label="来源小二" value={draft.sourceAgent} />
              <Field label="来源任务" value={draft.sourceTask} />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold">将自动带入</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {draft.profile.map((item) => <span key={item.label} className="rounded-full border border-line bg-rice/45 px-2.5 py-1 text-[11px] text-ink-soft">{item.label}：{item.value}</span>)}
            </div>
          </div>

          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-xs leading-5 text-ink-soft">
            同时带入 {draft.findings.length} 项风险或待确认信息。进入安小二后仍需你确认核验结果。
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full border border-line px-5 py-2 text-sm text-ink-soft hover:text-ink">取消</button>
          <button type="button" onClick={confirm} className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400">确认并进入安小二</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] text-ink-soft">{label}</div><div className="mt-1 font-medium text-ink">{value}</div></div>;
}
