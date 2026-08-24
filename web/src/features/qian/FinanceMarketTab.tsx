import { useEffect, useState } from "react";
import TechSelect from "../../components/TechSelect";
import { fetchFinanceMeta, fetchFinanceProducts } from "./api";
import type { FinanceCategory, FinanceMeta, FinanceProduct, FinancePurpose, FinanceRequirement } from "./types";

interface Props {
  onStartMatch: (partial?: Partial<FinanceRequirement>) => void;
  onViewProduct: (product: FinanceProduct) => void;
}

const PURPOSE_LABELS: Record<string, string> = {
  grain_purchase: "粮食采购",
  inventory_turnover: "库存周转",
  receivable_turnover: "应收周转",
};
const GUARANTEE_LABELS: Record<string, string> = {
  credit: "信用", guarantee: "保证", order: "订单",
  warehouse_receipt: "仓单", controlled_goods: "受控货权", receivable: "应收账款",
};
const CATEGORY_NAMES: Record<FinanceCategory, string> = {
  purchase_working: "采购周转融资",
  order_finance: "订单融资",
  warehouse_finance: "仓单/货权融资",
  receivable_finance: "应收账款融资",
};

function formatWan(value: string): string {
  return `${(Number(value) / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}万`;
}

const PAGE_SIZE = 5;

export default function FinanceMarketTab({ onStartMatch, onViewProduct }: Props) {
  const [meta, setMeta] = useState<FinanceMeta | null>(null);
  const [products, setProducts] = useState<FinanceProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    category: "" as FinanceCategory | "",
    purpose: "" as FinancePurpose | "",
    amount_yuan: "",
    duration_days: "",
    guarantee_mode: "",
    max_annual_rate_pct: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchFinanceMeta(), fetchFinanceProducts({})])
      .then(([m, p]) => {
        if (cancelled) return;
        setMeta(m);
        setProducts(p.items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const f: Record<string, string> = {};
    Object.entries(appliedFilters).forEach(([k, v]) => { if (v) f[k] = v; });
    fetchFinanceProducts(f as never)
      .then((p) => {
        if (!cancelled) {
          setProducts(p.items);
          setPage(1);
        }
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "加载失败"); });
    return () => { cancelled = true; };
  }, [appliedFilters]);

  const resetFilters = () => {
    const empty = { category: "" as const, purpose: "" as const, amount_yuan: "", duration_days: "", guarantee_mode: "", max_annual_rate_pct: "" };
    setFilters(empty);
    setAppliedFilters(empty);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const pageProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      {/* 市场概览 */}
      {meta && (
        <div className="rounded-2xl border border-line bg-panel/80 p-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <span className="text-2xl font-bold text-brand">{meta.product_count}</span>
            <span className="text-sm text-ink-soft">款可选产品</span>
            <span className="text-sm">
              参考年化 <span className="font-medium text-emerald-400">{meta.annual_rate_min_pct}%</span>
              –<span className="font-medium text-emerald-400">{meta.annual_rate_max_pct}%</span>
            </span>
            <span className="text-xs text-ink-soft">数据更新于 {meta.data_updated_at}</span>
            <button
              onClick={() => onStartMatch()}
              className="ml-auto rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              让钱小二帮我匹配
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {meta.categories.map((c) => (
              <span key={c} className="rounded-full bg-rice-deep px-3 py-1 text-xs text-ink-soft">
                {meta.category_names[c]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 筛选 + 产品列表 */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[220px_1fr]">
        {/* 筛选面板 */}
        <div className="rounded-2xl border border-line bg-panel/60 p-4">
          <h3 className="mb-3 text-xs font-semibold text-ink-soft">筛选条件</h3>
          <div className="flex flex-col gap-3 text-sm">
            <TechSelect
              label="产品类别"
              value={filters.category}
              options={[{ value: "", label: "全部" }, ...Object.entries(CATEGORY_NAMES).map(([value, label]) => ({ value, label }))]}
              onChange={(v) => setFilters({ ...filters, category: v as FinanceCategory | "" })}
            />
            <TechSelect
              label="资金用途"
              value={filters.purpose}
              options={[{ value: "", label: "全部" }, ...Object.entries(PURPOSE_LABELS).map(([value, label]) => ({ value, label }))]}
              onChange={(v) => setFilters({ ...filters, purpose: v as FinancePurpose | "" })}
            />
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">需求金额（元）</span>
              <input type="number" value={filters.amount_yuan} onChange={(e) => setFilters({ ...filters, amount_yuan: e.target.value })}
                placeholder="300000" className="w-full rounded-lg border border-line bg-rice-deep px-3 py-2 text-xs text-ink outline-none focus:border-brand" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">使用天数</span>
              <input type="number" value={filters.duration_days} onChange={(e) => setFilters({ ...filters, duration_days: e.target.value })}
                placeholder="45" className="w-full rounded-lg border border-line bg-rice-deep px-3 py-2 text-xs text-ink outline-none focus:border-brand" />
            </label>
            <TechSelect
              label="增信方式"
              value={filters.guarantee_mode}
              options={[{ value: "", label: "全部" }, ...Object.entries(GUARANTEE_LABELS).map(([value, label]) => ({ value, label }))]}
              onChange={(v) => setFilters({ ...filters, guarantee_mode: v })}
            />
            <div className="mt-1 flex gap-2">
              <button onClick={() => setAppliedFilters(filters)}
                className="flex-1 rounded-lg bg-brand py-2 text-xs font-medium text-white hover:bg-brand/90">
                应用筛选
              </button>
              <button onClick={resetFilters} className="rounded-lg border border-line px-3 py-2 text-xs text-ink-soft hover:text-ink">
                重置
              </button>
            </div>
          </div>
        </div>

        {/* 产品列表 */}
        <div className="flex flex-col gap-3">
          {error ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
              <p className="text-sm text-red-400">金融产品加载失败：{error}</p>
              <button onClick={() => setAppliedFilters({ ...appliedFilters })}
                className="mt-3 rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft hover:text-ink">
                重新加载
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-line bg-panel/40 text-sm text-ink-soft">
              没有符合条件的产品，请调整筛选条件
            </div>
          ) : (
            <>
              <p className="px-1 text-xs text-ink-soft">
                共 {products.length} 款产品，第 {page}/{totalPages} 页
              </p>
              {pageProducts.map((p) => (
              <div key={p.id} className="rounded-2xl border border-line bg-panel/70 p-4 transition-colors hover:border-brand/40">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{p.name}</h4>
                    <p className="mt-0.5 text-xs text-ink-soft">{p.institution_name} · {p.scenario}</p>
                  </div>
                  <span className="rounded-full bg-brand-faint px-2.5 py-0.5 text-[11px] text-brand-deep">
                    {CATEGORY_NAMES[p.category]}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  <span>额度 <span className="font-medium">{formatWan(p.min_amount_yuan)}–{formatWan(p.max_amount_yuan)}</span></span>
                  <span>期限 <span className="font-medium">{p.min_days}–{p.max_days}天</span></span>
                  <span>
                    参考年化{" "}
                    <span className="font-medium text-emerald-400">
                      {p.annual_rate_pct ? `${p.annual_rate_pct}%` : "需人工确认"}
                    </span>
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.guarantee_modes.map((g) => (
                    <span key={g} className="rounded-full bg-tech/10 px-2 py-0.5 text-[10px] text-tech">
                      {GUARANTEE_LABELS[g] ?? g}
                    </span>
                  ))}
                  {p.required_credentials.map((c) => (
                    <span key={c} className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">
                      {c}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => onViewProduct(p)}
                    className="rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft hover:text-ink">
                    查看详情
                  </button>
                  <button
                    onClick={() => onStartMatch({
                      purpose: p.purposes[0] as FinanceRequirement["purpose"],
                      amount_yuan: p.min_amount_yuan,
                      duration_days: p.min_days,
                      credentials: p.required_credentials.length > 0 ? p.required_credentials : null,
                    })}
                    className="rounded-full bg-brand/15 px-4 py-1.5 text-xs font-medium text-brand-deep hover:bg-brand/25"
                  >
                    拿这个产品去匹配
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-ink-soft/60">更新于 {p.data_updated_at}</p>
              </div>
            ))}

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft hover:text-ink disabled:opacity-30"
                  >
                    上一页
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`h-8 w-8 rounded-lg text-xs transition-colors ${
                        n === page ? "bg-brand text-white" : "border border-line text-ink-soft hover:text-ink"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft hover:text-ink disabled:opacity-30"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
