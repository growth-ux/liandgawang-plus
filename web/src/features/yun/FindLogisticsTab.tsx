import { useCallback, useEffect, useState } from "react";
import {
  createEstimate,
  createTask,
  extractRequirements,
  fetchHotRoutes,
  fetchLogisticsLines,
  fetchLogisticsMeta,
  listEstimates,
  matchTask,
} from "./api";
import type {
  EstimateResult,
  HotRoute,
  LogisticsLine,
  LogisticsMeta,
  QuickEstimateRecord,
} from "./types";

interface Props {
  prefill: QuickEstimateRecord | null;
  onPrefillConsumed: () => void;
  onTaskCreated: (taskId: number) => void;
}

const EMPTY_FORM = {
  origin: "",
  destination: "",
  variety_code: "corn",
  quantity_tons: "",
  deadline_date: "",
};

/** 首 tab：现有物流线路 + 智能受理 + 即时测算 + 热门线路 + 最近测算 */
export default function FindLogisticsTab({ prefill, onPrefillConsumed, onTaskCreated }: Props) {
  const [meta, setMeta] = useState<LogisticsMeta | null>(null);
  const [lines, setLines] = useState<LogisticsLine[]>([]);
  const [hotRoutes, setHotRoutes] = useState<HotRoute[]>([]);
  const [recent, setRecent] = useState<QuickEstimateRecord[]>([]);
  const [nlText, setNlText] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [results, setResults] = useState<EstimateResult[]>([]);
  const [estimateId, setEstimateId] = useState<number | null>(null);
  const [dataDate, setDataDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecent = useCallback(() => {
    listEstimates().then(setRecent).catch(() => {});
  }, []);

  useEffect(() => {
    fetchLogisticsMeta()
      .then(setMeta)
      .catch(() => setError("数据未就绪，请确认后端服务已启动"));
    fetchHotRoutes().then(setHotRoutes).catch(() => {});
    fetchLogisticsLines().then(setLines).catch(() => {});
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    if (!prefill) return;
    setForm({
      origin: prefill.origin,
      destination: prefill.destination,
      variety_code: prefill.variety_code,
      quantity_tons: String(prefill.quantity_tons),
      deadline_date: prefill.deadline_date ?? "",
    });
    setResults(prefill.results);
    onPrefillConsumed();
  }, [prefill, onPrefillConsumed]);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const runEstimate = async () => {
    setBusy(true);
    setError(null);
    setAssumptions([]);
    try {
      let f = { ...form };
      let aiQuestion: string | null = null;
      if (nlText.trim()) {
        const ex = await extractRequirements(nlText);
        if (ex.llm_available && ex.fields) {
          f = {
            ...f,
            origin: ex.fields.origin || f.origin,
            destination: ex.fields.destination || f.destination,
            variety_code: ex.fields.variety_code || f.variety_code,
            quantity_tons: ex.fields.quantity_tons
              ? String(ex.fields.quantity_tons)
              : f.quantity_tons,
            deadline_date: ex.fields.deadline_date || f.deadline_date,
          };
          setForm(f);
          setAssumptions(ex.assumptions ?? []);
          aiQuestion = ex.question ?? null;
        }
      }
      if (!f.origin || !f.destination || !f.quantity_tons) {
        setError(
          `请至少提供发货地、收货地和数量${aiQuestion ? `。运小二想确认：${aiQuestion}` : ""}`
        );
        return;
      }
      const resp = await createEstimate({
        origin: f.origin,
        destination: f.destination,
        variety_code: f.variety_code,
        quantity_tons: Number(f.quantity_tons),
        deadline_date: f.deadline_date || null,
      });
      setResults(resp.results);
      setEstimateId(resp.estimate_id);
      setDataDate(resp.data_updated_at);
      loadRecent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "测算失败");
    } finally {
      setBusy(false);
    }
  };

  const createRequirement = async () => {
    setBusy(true);
    setError(null);
    try {
      const task = await createTask({
        origin: form.origin,
        destination: form.destination,
        variety_code: form.variety_code,
        quantity_tons: Number(form.quantity_tons),
        deadline_date: form.deadline_date || null,
        source_type: estimateId ? "estimate" : "self",
        source_ref: estimateId ? String(estimateId) : "",
      });
      await matchTask(task.id);
      onTaskCreated(task.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建需求失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 现有物流线路：先展示已有运力 */}
      <section className="rounded-3xl border border-line bg-panel p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">现有物流线路</h2>
          <span className="text-xs text-ink-soft">点击线路可带入测算条件</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-soft">
                <th className="pb-2 font-normal">起点</th>
                <th className="pb-2 font-normal">终点</th>
                <th className="pb-2 font-normal">方式</th>
                <th className="pb-2 font-normal">承运方</th>
                <th className="pb-2 text-right font-normal">运力（吨）</th>
                <th className="pb-2 text-right font-normal">运价（元/吨）</th>
                <th className="pb-2 text-right font-normal">时效</th>
                <th className="pb-2 font-normal">发运窗口</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr
                  key={`${l.origin}-${l.destination}-${l.mode}-${l.carrier}`}
                  className="cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-rice"
                  title={l.performance_note}
                  onClick={() => {
                    setField("origin", l.origin);
                    setField("destination", l.destination);
                  }}
                >
                  <td className="py-2.5">{l.origin}</td>
                  <td className="py-2.5">{l.destination}</td>
                  <td className="py-2.5">
                    <span className="rounded-full bg-brand-faint px-2 py-0.5 text-xs text-brand-deep">
                      {l.mode_name}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-ink-soft">{l.carrier}</td>
                  <td className="py-2.5 text-right">{l.tonnage_min}~{l.tonnage_max}</td>
                  <td className="py-2.5 text-right">¥{l.price_low}~{l.price_high}</td>
                  <td className="py-2.5 text-right">{l.days_low}~{l.days_high} 天</td>
                  <td className="py-2.5 text-xs text-ink-soft">{l.dispatch_window}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-ink-soft">
                    线路加载中…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 受理卡 */}
      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="text-base font-semibold">告诉我你要运的粮</h2>
        <p className="mt-1 text-xs text-ink-soft">
          一句话描述，或直接用下方表单；运小二立刻给出各运输方式的参考运费与时效。
        </p>
        <div className="mt-4 flex gap-3">
          <input
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            placeholder="例如：120 吨东北二等玉米，白城到深圳港，8 月 30 日前要到"
            className="h-11 flex-1 rounded-full border border-line bg-rice px-5 text-sm text-ink placeholder:text-ink-soft/70"
          />
          <button
            type="button"
            onClick={runEstimate}
            disabled={busy}
            className="h-11 rounded-full bg-brand px-7 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "测算中…" : "即时测算"}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <select
            value={form.origin}
            onChange={(e) => setField("origin", e.target.value)}
            className="h-10 rounded-xl border border-line bg-rice px-3 text-sm text-ink"
          >
            <option value="">发货地</option>
            {meta?.nodes.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            value={form.destination}
            onChange={(e) => setField("destination", e.target.value)}
            className="h-10 rounded-xl border border-line bg-rice px-3 text-sm text-ink"
          >
            <option value="">收货地</option>
            {meta?.nodes.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            value={form.variety_code}
            onChange={(e) => setField("variety_code", e.target.value)}
            className="h-10 rounded-xl border border-line bg-rice px-3 text-sm text-ink"
          >
            {meta?.varieties.map((v) => (
              <option key={v.code} value={v.code}>{v.name}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={form.quantity_tons}
            onChange={(e) => setField("quantity_tons", e.target.value)}
            placeholder="数量（吨）"
            className="h-10 rounded-xl border border-line bg-rice px-3 text-sm text-ink placeholder:text-ink-soft/70"
          />
          <input
            type="date"
            value={form.deadline_date}
            onChange={(e) => setField("deadline_date", e.target.value)}
            className="h-10 rounded-xl border border-line bg-rice px-3 text-sm text-ink"
          />
        </div>
        {assumptions.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-ink-soft">
            {assumptions.map((a) => (
              <li key={a}>运小二理解：{a}</li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      {/* 测算结果 */}
      {results.length > 0 && (
        <section className="rounded-3xl border border-line bg-panel p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">测算结果（参考价，非最终报价）</h3>
            <span className="text-xs text-ink-soft">数据更新 {dataDate}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {results.map((r) => (
              <div
                key={r.mode}
                className={`rounded-2xl border p-4 ${
                  r.deadline_ok === false
                    ? "border-red-500/40"
                    : r.deadline_ok
                      ? "border-emerald-500/40"
                      : "border-line"
                } bg-panel/60`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{r.mode_name}</span>
                  <span className="flex gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className="rounded-full bg-brand-faint px-2 py-0.5 text-[11px] text-brand-deep">
                        {t}
                      </span>
                    ))}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold">
                  ¥{r.price_low}~{r.price_high}
                  <span className="ml-1 text-xs font-normal text-ink-soft">{r.price_unit}</span>
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  时效 {r.days_low}~{r.days_high} 天 · 换装 {r.transship_count} 次
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {r.legs.map((l) => `${l.origin}—${l.destination}（${l.mode_name}）`).join(" + ")}
                </p>
                {r.deadline_ok === false && (
                  <p className="mt-2 text-xs text-red-400">⚠ 预计超期 {r.over_days} 天，不满足到货期限</p>
                )}
                {r.deadline_ok === true && (
                  <p className="mt-2 text-xs text-emerald-400">✓ 满足到货期限</p>
                )}
                {r.risk_note && <p className="mt-1 text-[11px] text-ink-soft">{r.risk_note}</p>}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={createRequirement}
              disabled={busy || !form.quantity_tons}
              className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              生成正式运输需求
            </button>
            <button
              type="button"
              onClick={() => {
                setResults([]);
                setEstimateId(null);
              }}
              className="rounded-full border border-line px-6 py-2.5 text-sm text-ink-soft hover:text-ink"
            >
              换个条件再算
            </button>
          </div>
        </section>
      )}

      {/* 底部双栏：热门线路 + 最近测算 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-panel p-6">
          <h3 className="text-sm font-semibold">热门线路价格走势</h3>
          <ul className="mt-3 divide-y divide-line/60">
            {hotRoutes.map((h) => (
              <li key={`${h.origin}-${h.destination}-${h.mode}`}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:text-brand-deep"
                  onClick={() => {
                    setField("origin", h.origin);
                    setField("destination", h.destination);
                  }}
                >
                  <span>
                    {h.origin} → {h.destination}
                    <span className="ml-2 text-xs text-ink-soft">{h.mode_name} {h.days_hint}</span>
                  </span>
                  <span className="shrink-0">
                    ¥{h.price_low}~{h.price_high}
                    <span
                      className={`ml-2 text-xs ${
                        h.change_pct > 0 ? "text-red-400" : h.change_pct < 0 ? "text-emerald-400" : "text-ink-soft"
                      }`}
                    >
                      {h.change_pct > 0 ? "+" : ""}{h.change_pct}%
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border border-line bg-panel p-6">
          <h3 className="text-sm font-semibold">最近测算</h3>
          {recent.length === 0 ? (
            <p className="mt-3 text-xs text-ink-soft">还没有测算记录，先在上方算一笔试试。</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recent.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-line/60 px-3 py-2 text-left text-xs hover:border-brand"
                    onClick={() => {
                      setForm({
                        origin: r.origin,
                        destination: r.destination,
                        variety_code: r.variety_code,
                        quantity_tons: String(r.quantity_tons),
                        deadline_date: r.deadline_date ?? "",
                      });
                      setResults(r.results);
                    }}
                  >
                    {r.origin} → {r.destination} · {r.variety_name} {r.quantity_tons} 吨
                    <span className="float-right text-ink-soft">点击恢复</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
