import type { LogisticsLine } from "./types";
import { fmtInt } from "./format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

export default function LineDetailDrawer({
  line,
  onClose,
  onBooking,
}: {
  line: LogisticsLine;
  onClose: () => void;
  onBooking?: (line: LogisticsLine) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {line.origin} → {line.destination}
          </h3>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink">
            ✕
          </button>
        </div>

        <div className="rounded-xl border border-line bg-rice p-4">
          <div className="text-[11px] text-ink-soft">参考运价</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-tech">
            ¥{fmtInt(line.price_low)}~{fmtInt(line.price_high)}
            <span className="ml-1 text-xs font-normal text-ink-soft">元/吨</span>
          </div>
        </div>

        <div className="mt-4 divide-y divide-line/60 rounded-xl border border-line px-4">
          <Row label="运输方式" value={line.mode_name} />
          <Row label="里程" value={`${fmtInt(line.distance_km)} 公里`} />
          <Row label="承运方" value={line.carrier} />
          <Row label="运力区间" value={`${fmtInt(line.tonnage_min)}~${fmtInt(line.tonnage_max)} 吨`} />
          <Row label="时效" value={`${line.days_low}~${line.days_high} 天`} />
          <Row label="发运窗口" value={line.dispatch_window} />
          <Row label="装卸条件" value={line.loading_note || "--"} />
          <Row label="履约摘要" value={line.performance_note || "--"} />
        </div>

        {line.risk_note && (
          <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm text-amber-300">
            风险提示：{line.risk_note}
          </div>
        )}

        {onBooking && (
          <button
            type="button"
            onClick={() => onBooking(line)}
            className="mt-5 w-full rounded-full bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand/90"
          >
            发起运力采购
          </button>
        )}
      </div>
    </div>
  );
}
