import type { MarketEvent } from "../types";

const directionStyle = {
  bullish: { label: "偏多", cls: "bg-emerald-400/10 text-emerald-300" },
  bearish: { label: "偏空", cls: "bg-red-400/10 text-red-300" },
  neutral: { label: "中性", cls: "bg-amber-400/10 text-amber-300" },
};

const strengthLabel = { strong: "强", moderate: "中", mild: "弱" };

export default function MarketEventList({ events }: { events: MarketEvent[] }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="text-sm font-semibold">关键事件与预期影响</div>

      {!events.length ? (
        <div className="mt-3 rounded-lg bg-rice-deep/60 px-4 py-6 text-center text-xs leading-6 text-ink-soft">
          当前品种暂无重大行情事件，市场运行平稳；
          <br />
          持续跟踪政策拍卖、进出口到港与产区物流动态。
        </div>
      ) : (
        <>
          <div className="space-y-0">
            {events.map((evt, idx) => {
              const cfg = directionStyle[evt.direction];
              return (
                <div
                  key={evt.event_code}
                  className={`py-3.5 ${idx > 0 ? "border-t border-line" : "mt-1"}`}
                >
                  {/* 标题行 */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[13px] font-medium leading-6 text-ink">
                      {evt.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  {/* 摘要 */}
                  <p className="mt-1 text-xs leading-6 text-ink-soft">
                    {evt.summary}
                  </p>

                  {/* 元信息 */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-soft">
                    <span>{evt.event_at.slice(0, 10)}</span>
                    <span>影响区域：{evt.impact_regions.join("、")}</span>
                    <span>作用窗口：{evt.duration_hint}</span>
                    <span>
                      强度：{strengthLabel[evt.strength] ?? evt.strength}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 border-t border-line pt-3 text-[11px] text-ink-soft/70">
            事件整理：粮达网行情资讯跟踪 · 影响评估为瞻小二研判观点，仅供参考
          </div>
        </>
      )}
    </div>
  );
}
