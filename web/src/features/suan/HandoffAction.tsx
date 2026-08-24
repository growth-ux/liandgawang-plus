import type { CostComparison } from "./types";

interface Props {
  comparison: CostComparison;
  onHandoff: (targetAgent: string, targetValue: string, reason: string) => void;
}

interface HandoffSuggestion {
  targetAgent: string;
  agentLabel: string;
  targetValue: string;
  reason: string;
  costKey: string;
}

export default function HandoffAction({ comparison, onHandoff }: Props) {
  // 基于差异分析生成降本建议
  const suggestions: HandoffSuggestion[] = [];

  for (const result of comparison.results) {
    if (result.scheme_id === comparison.recommended_scheme_id) continue;

    const bestResult = comparison.results.find((r) => r.scheme_id === comparison.recommended_scheme_id);
    if (!bestResult) continue;

    // 运费差异
    const freightDiff = parseFloat(result.breakdown.freight_yuan_per_ton) - parseFloat(bestResult.breakdown.freight_yuan_per_ton);
    if (freightDiff > 5) {
      const bestFreight = bestResult.breakdown.freight_yuan_per_ton;
      suggestions.push({
        targetAgent: "yun",
        agentLabel: "运小二",
        targetValue: `目标运费不高于 ${bestFreight} 元/吨`,
        reason: `方案 ${result.scheme_id} 运费高 ${freightDiff.toFixed(2)} 元/吨`,
        costKey: "freight",
      });
    }

    // 质量折价差异
    const qualityDiff = parseFloat(result.breakdown.quality_yuan_per_ton) - parseFloat(bestResult.breakdown.quality_yuan_per_ton);
    if (qualityDiff > 5) {
      suggestions.push({
        targetAgent: "liang",
        agentLabel: "粮小二",
        targetValue: "寻找质量更优的备选粮源",
        reason: `方案 ${result.scheme_id} 质量折价高 ${qualityDiff.toFixed(2)} 元/吨`,
        costKey: "quality",
      });
    }

    // 资金成本差异
    const finDiff = parseFloat(result.breakdown.financing_yuan_per_ton) - parseFloat(bestResult.breakdown.financing_yuan_per_ton);
    if (finDiff > 3) {
      suggestions.push({
        targetAgent: "qian",
        agentLabel: "钱小二",
        targetValue: "比较更短期限或更低利率的资金方案",
        reason: `方案 ${result.scheme_id} 资金成本高 ${finDiff.toFixed(2)} 元/吨`,
        costKey: "financing",
      });
    }
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel/60">
      <div className="border-b border-line/70 px-5 py-3.5">
        <h4 className="text-sm font-semibold">降本协作建议</h4>
        <p className="mt-0.5 text-xs text-ink-soft">基于方案差异识别的降本机会，可携带目标值交接给对应小二</p>
      </div>
      <div className="flex flex-col gap-2.5 p-5">
        {suggestions.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/50 bg-rice-deep px-4 py-3">
            <div>
              <p className="text-sm">{s.reason}</p>
              <p className="mt-0.5 text-xs text-ink-soft">目标：{s.targetValue}</p>
            </div>
            <button
              onClick={() => onHandoff(s.targetAgent, s.targetValue, s.reason)}
              className="flex-none rounded-full bg-violet-500 px-4 py-1.5 text-xs font-medium text-white shadow-[0_0_10px_rgba(139,92,246,0.3)]"
            >
              交给{s.agentLabel} →
            </button>
          </div>
        ))}
      </div>
      <p className="border-t border-line/50 px-5 py-2.5 text-xs text-ink-soft/60">确认交接后，将携带目标值跳转到对应小二继续办理。</p>
    </div>
  );
}
