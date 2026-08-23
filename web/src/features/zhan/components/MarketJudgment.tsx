import type { MarketJudgment as Judgment } from "../types";

const directionConfig = {
  bullish: { label: "偏强", tone: "text-emerald-400", arrow: "↑" },
  bearish: { label: "偏弱", tone: "text-red-400", arrow: "↓" },
  neutral: { label: "震荡", tone: "text-amber-300", arrow: "↔" },
};

/** 证据来源标签：价格信号 / 市场事件 */
const evidenceTag = {
  price: { label: "价格", cls: "bg-tech/10 text-tech" },
  event: { label: "事件", cls: "bg-brand-faint text-brand-deep" },
};

/** 证据完整度三档指示 */
const completenessCfg = {
  high: { active: 3, tone: "bg-emerald-400" },
  medium: { active: 2, tone: "bg-amber-400" },
  low: { active: 1, tone: "bg-red-400" },
};

export default function MarketJudgment({
  judgment,
  priceDate,
}: {
  judgment: Judgment;
  priceDate: string;
}) {
  const cfg = directionConfig[judgment.direction];
  const comp = completenessCfg[judgment.evidence_completeness];

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      {/* 第一行：来源 + 时间 + 方向 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="font-medium text-ink">瞻小二市场速览</span>
          <span className="text-ink-soft/50">·</span>
          <span>数据截至 {priceDate}</span>
        </div>
        <span className={`text-xs font-medium ${cfg.tone}`}>
          {cfg.arrow} {cfg.label}
        </span>
      </div>

      {/* 结论 */}
      <h2 className="mt-3 text-[15px] font-semibold leading-7 text-ink">
        {judgment.summary}
      </h2>

      {/* 证据区：两列 */}
      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
        {/* 支持依据 */}
        <div>
          <div className="mb-2 text-xs font-medium text-ink-soft">支持依据</div>
          <div className="space-y-1.5">
            {judgment.supporting.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[13px] leading-6 text-ink"
              >
                <span
                  className={`mt-1 shrink-0 rounded px-1 py-px text-[10px] leading-4 ${evidenceTag[item.type].cls}`}
                >
                  {evidenceTag[item.type].label}
                </span>
                <span>{item.text}</span>
              </div>
            ))}
            {judgment.supporting.length === 0 && (
              <div className="text-xs text-ink-soft">暂无明确支持依据</div>
            )}
          </div>
        </div>

        {/* 风险与不确定性 */}
        <div>
          <div className="mb-2 text-xs font-medium text-ink-soft">
            风险与不确定性
          </div>
          <div className="space-y-1.5">
            {judgment.opposing.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[13px] leading-6 text-ink"
              >
                <span
                  className={`mt-1 shrink-0 rounded px-1 py-px text-[10px] leading-4 ${evidenceTag[item.type].cls}`}
                >
                  {evidenceTag[item.type].label}
                </span>
                <span>{item.text}</span>
              </div>
            ))}
            {judgment.opposing.length === 0 && (
              <div className="text-xs text-ink-soft">暂无明显风险因素</div>
            )}
          </div>
        </div>
      </div>

      {/* 底栏：完整度 + 关注建议 */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-3 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          证据完整度
          <span className="flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1 w-3 rounded-full ${
                  i < comp.active ? comp.tone : "bg-line"
                }`}
              />
            ))}
          </span>
        </span>
        {judgment.watch_suggestions.length > 0 && (
          <>
            <span className="text-ink-soft/40">|</span>
            <span>建议关注：{judgment.watch_suggestions.join("；")}</span>
          </>
        )}
        <span className="text-ink-soft/60">
          研判基于当日一手采集价格与公开市场事件，仅供参考
        </span>
      </div>
    </div>
  );
}
