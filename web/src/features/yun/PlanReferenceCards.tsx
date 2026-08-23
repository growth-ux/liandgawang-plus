import type { TransportPlan } from "./types";

interface Props {
  faster: TransportPlan | null;
  cheaper: TransportPlan | null;
  primary: TransportPlan;
}

const midPrice = (plan: TransportPlan) => (plan.price_low + plan.price_high) / 2;

function diffText(reference: TransportPlan, primary: TransportPlan): string {
  const priceDiff = Math.round(midPrice(reference) - midPrice(primary)); // 正=更贵，负=更省
  const dayDiff = reference.days_high - primary.days_high; // 正=更慢，负=更快
  const parts: string[] = [];
  if (dayDiff < 0) parts.push(`比主推快 ${Math.abs(dayDiff)} 天`);
  else if (dayDiff > 0) parts.push(`比主推慢 ${dayDiff} 天`);
  else parts.push("时效与主推相当");
  if (priceDiff < 0) parts.push(`省约 ${Math.abs(priceDiff)} 元/吨`);
  else if (priceDiff > 0) parts.push(`贵约 ${priceDiff} 元/吨`);
  else parts.push("运费与主推相当");
  return parts.join("，");
}

function ReferenceCard({
  label,
  reference,
  primary,
}: {
  label: string;
  reference: TransportPlan;
  primary: TransportPlan;
}) {
  const rejected = reference.plan_type === "rejected";
  return (
    <div
      className={`rounded-2xl border p-5 ${
        rejected ? "border-line bg-panel/60" : "border-line bg-panel"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {rejected && (
          <span className="rounded-full border border-red-400/50 bg-red-400/10 px-2.5 py-0.5 text-xs text-red-400">
            未入选
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-ink">{reference.title}</p>
      <p className="mt-1 text-xs text-ink-soft">
        ¥{reference.price_low}~{reference.price_high} 元/吨 · {reference.days_low}~
        {reference.days_high} 天 · 换装 {reference.transship_count} 次
      </p>
      <p className={`mt-2 text-xs ${rejected ? "text-red-400" : "text-ink-soft"}`}>
        {rejected ? reference.reason : diffText(reference, primary)}
      </p>
    </div>
  );
}

/** 更快 / 更省两张半宽参照卡（仅信息展示，不提供采用动作） */
export default function PlanReferenceCards({ faster, cheaper, primary }: Props) {
  if (!faster && !cheaper) return null;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {faster && <ReferenceCard label="更快参照" reference={faster} primary={primary} />}
      {cheaper && <ReferenceCard label="更省参照" reference={cheaper} primary={primary} />}
    </div>
  );
}
