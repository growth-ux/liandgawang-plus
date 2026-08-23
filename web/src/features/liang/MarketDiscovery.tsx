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
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold">粮小二市场发现</span>
      </div>
      <ul className="space-y-2.5">
        {discoveries.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              disabled={!d.filter}
              onClick={() => d.filter && onApply(d.filter.key, d.filter.value)}
              className={`w-full rounded-xl border border-line bg-rice px-3.5 py-2.5 text-left transition-colors ${
                d.filter ? "hover:border-tech" : "cursor-default"
              }`}
            >
              <div className="text-sm font-medium text-ink">{d.title}</div>
              <div className="mt-0.5 text-xs leading-5 text-ink-soft">{d.detail}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
