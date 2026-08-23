import type { RouteLeg } from "./types";
import { fmtInt } from "./format";

const MODE_ICON: Record<string, string> = {
  road: "🚚",
  rail: "🚆",
  water: "🚢",
};

/** 单个节点（起终点/换装点） */
function Node({ name, delay }: { name: string; delay: number }) {
  return (
    <div
      className="route-reveal flex flex-col items-center gap-1.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="h-2.5 w-2.5 rounded-full border-2 border-brand bg-panel" />
      <span className="whitespace-nowrap text-xs font-medium text-ink">{name}</span>
    </div>
  );
}

/** 一段线路：方式图标 + 里程 */
function Segment({ leg, delay }: { leg: RouteLeg; delay: number }) {
  return (
    <div
      className="route-reveal flex min-w-[110px] flex-col items-center gap-1.5 px-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative flex h-2.5 w-full items-center">
        <div className="h-px w-full bg-brand/60" />
        <span className="absolute left-1/2 -translate-x-1/2 text-sm leading-none">
          {MODE_ICON[leg.mode] ?? "🚛"}
        </span>
      </div>
      <span className="whitespace-nowrap text-[11px] text-ink-soft">
        {leg.mode_name} {fmtInt(leg.distance_km)}km
      </span>
    </div>
  );
}

/** 路线示意图：起点 → 各段（方式+里程）→ 终点，逐段浮现 */
export default function RouteDiagram({ legs }: { legs: RouteLeg[] }) {
  if (legs.length === 0) return null;
  return (
    <div className="flex items-start overflow-x-auto py-2">
      <Node name={legs[0].origin} delay={0} />
      {legs.map((leg, i) => (
        <span key={`${leg.origin}-${leg.destination}-${leg.mode}`} className="flex items-start">
          <Segment leg={leg} delay={(i + 1) * 180} />
          <Node name={leg.destination} delay={(i + 1) * 180 + 90} />
        </span>
      ))}
    </div>
  );
}
