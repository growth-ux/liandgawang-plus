// web/src/features/liang/CandidateBasket.tsx
import { useState } from "react";
import { useCandidates } from "./CandidateContext";
import { fmtInt } from "./format";

export default function CandidateBasket({ onGoCompare }: { onGoCompare: () => void }) {
  const { candidates, remove, clear } = useCandidates();
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="flex h-full w-full max-w-sm flex-col bg-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-base font-semibold">候选篮（{candidates.length}）</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {candidates.length === 0 ? (
                <p className="mt-8 text-center text-sm text-ink-soft">
                  还没有候选，去列表点「+ 候选」收藏粮源
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {candidates.map((c) => (
                    <li key={c.id} className="flex items-center justify-between rounded-xl border border-line bg-rice px-3.5 py-2.5">
                      <div>
                        <div className="text-sm font-medium text-ink">
                          {c.variety_name}·{c.grade} {c.origin_province}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-soft">
                          {c.supplier_name} · {fmtInt(c.price)}元/{c.price_type}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        className="text-xs text-ink-soft hover:text-red-400"
                      >
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2 border-t border-line px-5 py-4">
              <button
                type="button"
                onClick={clear}
                disabled={candidates.length === 0}
                className="h-11 rounded-full border border-line px-5 text-sm text-ink-soft disabled:opacity-40"
              >
                清空
              </button>
              <button
                type="button"
                onClick={onGoCompare}
                disabled={candidates.length === 0}
                className="h-11 flex-1 rounded-full bg-brand text-sm font-medium text-white disabled:opacity-40"
              >
                去候选对比
              </button>
            </div>
          </div>
        </div>
      )}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        >
          🛒 候选篮
          {candidates.length > 0 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs tabular-nums">
              {candidates.length}
            </span>
          )}
        </button>
      )}
    </>
  );
}
