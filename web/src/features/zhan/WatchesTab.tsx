import { useEffect, useRef, useState } from "react";
import {
  createWatch,
  evaluateWatch,
  fetchMarketOverview,
  fetchWatches,
  updateWatch,
} from "./api";
import { VARIETIES, type SpotPrice, type Watch, type WatchType } from "./types";

const WATCH_TYPE_OPTIONS: { value: WatchType; label: string; unit: string }[] = [
  { value: "price_above", label: "价格高于", unit: "元/吨" },
  { value: "price_below", label: "价格低于", unit: "元/吨" },
  { value: "day_change", label: "日涨跌超过", unit: "%" },
  { value: "week_change", label: "周涨跌超过", unit: "%" },
];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  monitoring: { label: "监测中", tone: "bg-sky-400/15 text-sky-300" },
  triggered: { label: "已触发", tone: "bg-amber-400/15 text-amber-300" },
  notified: { label: "已通知", tone: "bg-emerald-400/15 text-emerald-300" },
  paused: { label: "已暂停", tone: "bg-rice-deep text-ink-soft" },
  closed: { label: "已关闭", tone: "bg-rice-deep text-ink-soft" },
  data_pending: { label: "数据待补充", tone: "bg-amber-400/10 text-amber-300/80" },
};

function stripZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

function isPriceType(t: WatchType): boolean {
  return t === "price_above" || t === "price_below";
}

function fmtThreshold(w: Watch): string {
  const v = stripZeros(w.threshold);
  return isPriceType(w.watch_type) ? `${v} 元/吨` : `${v}%`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const REGION_GROUPS = ["产区", "港口", "销区"] as const;

function SpotSelect({
  spots,
  value,
  onChange,
}: {
  spots: SpotPrice[];
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = spots.find((s) => s.spot_code === value);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-rice px-3.5 py-2 text-sm text-ink transition-colors hover:border-tech"
      >
        <span className="truncate">
          {current ? `${current.region_name} · ${current.quote_type}` : "选择库点"}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-line bg-panel py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
          {REGION_GROUPS.map((group) => {
            const items = spots.filter((s) => s.region_type === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="px-4 py-1.5 text-xs text-ink-soft">{group}</div>
                {items.map((s) => {
                  const selected = s.spot_code === value;
                  return (
                    <button
                      key={s.spot_code}
                      type="button"
                      onClick={() => {
                        onChange(s.spot_code);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors ${
                        selected ? "bg-tech/15" : "hover:bg-rice-deep"
                      }`}
                    >
                      <span className={selected ? "font-semibold text-tech" : "text-ink"}>
                        {s.region_name} · {s.quote_type}
                      </span>
                      <span className="text-xs text-ink-soft">{stripZeros(s.price)} 元/吨</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function WatchesTab() {
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [variety, setVariety] = useState("corn");
  const [spots, setSpots] = useState<SpotPrice[]>([]);
  const [spotCode, setSpotCode] = useState("");
  const [watchType, setWatchType] = useState<WatchType>("price_below");
  const [threshold, setThreshold] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    try {
      setWatches(await fetchWatches());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }

  useEffect(() => {
    load();
  }, []);

  // 品种变化 → 拉取该品种库点，默认选第一个
  useEffect(() => {
    let cancelled = false;
    setSpots([]);
    setSpotCode("");
    fetchMarketOverview(variety)
      .then((d) => {
        if (cancelled) return;
        setSpots(d.spots);
        setSpotCode(d.spots[0]?.spot_code ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [variety]);

  async function handleCreate() {
    const t = Number(threshold);
    if (!spotCode || !threshold || Number.isNaN(t) || t <= 0) {
      setFormError("请选择库点并填写大于 0 的阈值");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createWatch({
        variety_code: variety,
        spot_code: spotCode,
        watch_type: watchType,
        threshold: t,
      });
      setThreshold("");
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatus(id: number, status: string) {
    await updateWatch(id, { status });
    await load();
  }

  async function handleEvaluate(id: number) {
    await evaluateWatch(id);
    await load();
  }

  const activeUnit = WATCH_TYPE_OPTIONS.find((o) => o.value === watchType)?.unit ?? "";

  return (
    <div className="flex flex-col gap-4">
      {/* 新建关注 */}
      <div className="rounded-2xl border border-line bg-panel p-5">
        {!formOpen ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="rounded-full bg-tech px-6 py-2.5 text-sm font-semibold text-rice transition-colors hover:brightness-110"
          >
            ＋ 新建关注
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-sm font-semibold">新建关注</div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-soft">品种</span>
              {VARIETIES.map((v) => (
                <button
                  key={v.code}
                  type="button"
                  onClick={() => setVariety(v.code)}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    variety === v.code
                      ? "bg-tech font-semibold text-rice"
                      : "border border-line bg-rice text-ink-soft hover:text-ink"
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-ink-soft">库点</span>
              <SpotSelect spots={spots} value={spotCode} onChange={setSpotCode} />
            </div>

            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-ink-soft">条件类型</span>
              <div className="flex flex-wrap gap-2">
                {WATCH_TYPE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setWatchType(o.value)}
                    className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                      watchType === o.value
                        ? "bg-tech font-semibold text-rice"
                        : "border border-line bg-rice text-ink-soft hover:text-ink"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-ink-soft">阈值（{activeUnit}）</span>
              <input
                type="text"
                inputMode="decimal"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="例如 2300"
                className="rounded-xl border border-line bg-rice px-3.5 py-2 text-sm text-ink placeholder:text-ink-soft/60"
              />
            </label>

            {formError && <p className="text-xs text-red-400">{formError}</p>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
              >
                {submitting ? "提交中…" : "创建并检查"}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-full border border-line px-6 py-2.5 text-sm text-ink-soft hover:text-ink"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 列表 / 加载 / 错误 / 空态 */}
      {error ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <p className="text-sm text-red-400">关注加载失败：{error}</p>
          <p className="mt-2 text-xs text-ink-soft">请确认后端服务已启动、本地数据库已初始化。</p>
        </div>
      ) : !watches ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-sm text-ink-soft">
          正在读取关注…
        </div>
      ) : watches.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <p className="text-sm text-ink-soft">还没有关注，点击上方「新建关注」开始</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {watches.map((w) => {
            const meta = STATUS_META[w.status] ?? STATUS_META.monitoring;
            return (
              <div key={w.id} className="rounded-2xl border border-line bg-panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {w.variety_name} · {w.region_name}
                      </span>
                      <span className="rounded-full bg-rice-deep px-2 py-0.5 text-xs text-ink-soft">
                        {w.quote_type}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.tone}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink">
                      {w.watch_type_label}{" "}
                      <span className="font-semibold text-tech">{fmtThreshold(w)}</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">{w.triggered_reason}</p>
                    <p className="mt-1 text-xs text-ink-soft">最近检查 {fmtTime(w.last_checked_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {w.status === "triggered" && (
                      <button
                        type="button"
                        onClick={() => handleStatus(w.id, "notified")}
                        className="rounded-full bg-brand px-3.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-deep"
                      >
                        已通知
                      </button>
                    )}
                    {w.status === "notified" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatus(w.id, "monitoring")}
                          className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:border-tech hover:text-tech"
                        >
                          恢复监测
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatus(w.id, "closed")}
                          className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:border-red-400/50 hover:text-red-400"
                        >
                          <CloseIcon />
                          关闭
                        </button>
                      </>
                    )}
                    {(w.status === "monitoring" || w.status === "data_pending") && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEvaluate(w.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:border-tech hover:text-tech"
                        >
                          <RefreshIcon />
                          重新检查
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatus(w.id, "closed")}
                          className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:border-red-400/50 hover:text-red-400"
                        >
                          <CloseIcon />
                          关闭
                        </button>
                      </>
                    )}
                    {w.status === "paused" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatus(w.id, "monitoring")}
                          className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:border-tech hover:text-tech"
                        >
                          恢复
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatus(w.id, "closed")}
                          className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:border-red-400/50 hover:text-red-400"
                        >
                          <CloseIcon />
                          关闭
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
