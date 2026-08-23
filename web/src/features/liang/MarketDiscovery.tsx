// web/src/features/liang/MarketDiscovery.tsx
import type { Discovery } from "./types";

export default function MarketDiscovery({
  discoveries,
  onApply,
}: {
  discoveries: Discovery[];
  onApply: (key: string, value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="mb-3 border-b border-line pb-3">
        <div className="text-[11px] font-medium tracking-[0.14em] text-tech">MARKET SIGNALS</div>
        <span className="mt-1 block text-sm font-semibold">粮小二市场发现</span>
      </div>
      <ul className="space-y-2.5">
        {discoveries.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              disabled={!d.filter}
              onClick={() => d.filter && onApply(d.filter.key, d.filter.value)}
              className={`w-full rounded-xl border border-line bg-rice/70 px-3 py-3 text-left transition-all ${
                d.filter ? "hover:-translate-y-0.5 hover:border-tech hover:bg-rice-deep" : "cursor-default"
              }`}
            >
              <div className="text-sm font-medium text-ink">{d.title}</div>
              <div className="mt-1 text-xs leading-5 text-ink-soft">{d.detail}</div>
              {d.filter && <div className="mt-2 text-[11px] font-medium text-tech">应用到列表 →</div>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
