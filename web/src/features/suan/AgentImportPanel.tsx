import { useEffect, useState } from "react";
import type { SchemeDraft } from "./types";

interface Props {
  onImport: (schemes: SchemeDraft[], pendingItems: string[]) => void;
}

interface LiangTask {
  id: number;
  task_code: string;
  status: string;
  need: { variety?: string; quantity_tons?: number } | null;
  plan: {
    primary: {
      listing_code: string;
      variety_name: string;
      grade: string;
      origin: string;
      supplier_name: string;
      price: string;
      quality_penalty: string;
      available_quantity_tons: number;
    } | null;
  } | null;
  created_at: string | null;
}

interface YunTask {
  id: number;
  origin: string;
  destination: string;
  variety_name: string;
  quantity_tons: number;
  status: string;
  status_label: string;
  created_at: string;
}

interface YunPlan {
  id: number;
  plan_type: string;
  title: string;
  price_low: number;
  price_high: number;
  days_low: number;
  days_high: number;
}

interface QianRecord {
  id: number;
  match_code: string;
  requirement: { amount_yuan: string; duration_days: number; purpose: string };
  result: {
    primary: {
      product: { name: string };
      estimated_cost_yuan: string | null;
    } | null;
  };
  created_at: string;
}

type Tab = "liang" | "yun" | "qian" | null;

const AGENT_META = {
  liang: {
    label: "粮小二",
    char: "粮",
    desc: "导入寻源报价与质检结果",
    text: "text-amber-300",
    avatar: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    active: "border-amber-400/50 bg-amber-400/[0.07] shadow-[0_0_18px_rgba(251,191,36,0.12)]",
    hover: "hover:border-amber-400/35",
  },
  yun: {
    label: "运小二",
    char: "运",
    desc: "导入运输方案与运费区间",
    text: "text-emerald-300",
    avatar: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    active: "border-emerald-400/50 bg-emerald-400/[0.07] shadow-[0_0_18px_rgba(52,211,153,0.12)]",
    hover: "hover:border-emerald-400/35",
  },
  qian: {
    label: "钱小二",
    char: "钱",
    desc: "导入资金产品与成本估算",
    text: "text-orange-300",
    avatar: "border-orange-400/30 bg-orange-400/10 text-orange-300",
    active: "border-orange-400/50 bg-orange-400/[0.07] shadow-[0_0_18px_rgba(251,146,60,0.12)]",
    hover: "hover:border-orange-400/35",
  },
};

export default function AgentImportPanel({ onImport }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(null);
  const [liangTasks, setLiangTasks] = useState<LiangTask[]>([]);
  const [yunTasks, setYunTasks] = useState<YunTask[]>([]);
  const [yunPlans, setYunPlans] = useState<Record<number, YunPlan[]>>({});
  const [qianRecords, setQianRecords] = useState<QianRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYunTaskId, setSelectedYunTaskId] = useState<number | null>(null);

  const loadLiang = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/liang/tasks");
      const data = await resp.json();
      setLiangTasks((data.items || []).filter((t: LiangTask) => t.plan?.primary));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const loadYun = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/logistics/tasks");
      const tasks: YunTask[] = await resp.json();
      setYunTasks(tasks.filter((t) => t.status === "plans_ready" || t.status === "feedback"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const loadYunPlans = async (taskId: number) => {
    try {
      const resp = await fetch(`/api/logistics/tasks/${taskId}`);
      const data = await resp.json();
      setYunPlans((prev) => ({ ...prev, [taskId]: data.plans || [] }));
      setSelectedYunTaskId(taskId);
    } catch {
      // silent
    }
  };

  const loadQian = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/finance/matches");
      const data = await resp.json();
      setQianRecords((data.items || []).filter((r: QianRecord) => r.result?.primary));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "liang") loadLiang();
    else if (activeTab === "yun") loadYun();
    else if (activeTab === "qian") loadQian();
  }, [activeTab]);

  const handleSelectLiang = (task: LiangTask) => {
    const p = task.plan?.primary;
    if (!p) return;
    onImport(
      [
        {
          scheme_id: "A",
          name: `${p.variety_name} ${p.origin}`,
          variety_name: p.variety_name,
          quantity_tons: String(task.need?.quantity_tons ?? p.available_quantity_tons),
          purchase_price_yuan_per_ton: p.price,
          quality_discount_yuan_per_ton: p.quality_penalty || null,
          tax_included: null,
          freight_yuan_per_ton: null,
          loading_yuan_per_ton: null,
          loss_rate_pct: null,
          financing_cost_yuan: null,
          other_cost_yuan: null,
          constraints_met: true,
          pending_items: ["运费待补充", "含税口径待确认"],
          field_meta: {},
        },
      ],
      ["运费待补充", "含税口径待确认"],
    );
  };

  const handleSelectYunPlan = (task: YunTask, plan: YunPlan) => {
    const midPrice = String(Math.round((plan.price_low + plan.price_high) / 2));
    onImport(
      [
        {
          scheme_id: "A",
          name: `${task.origin}→${task.destination} ${plan.title}`,
          variety_name: task.variety_name,
          quantity_tons: String(task.quantity_tons),
          purchase_price_yuan_per_ton: null,
          freight_yuan_per_ton: midPrice,
          tax_included: null,
          quality_discount_yuan_per_ton: null,
          loading_yuan_per_ton: null,
          loss_rate_pct: null,
          financing_cost_yuan: null,
          other_cost_yuan: null,
          constraints_met: true,
          pending_items: ["货价待粮小二确认", "报价待询运确认"],
          field_meta: {},
        },
      ],
      ["货价待粮小二确认", "报价待询运确认"],
    );
  };

  const handleSelectQian = (record: QianRecord) => {
    const primary = record.result.primary;
    if (!primary) return;
    onImport(
      [
        {
          scheme_id: "A",
          name: `${primary.product.name} 资金方案`,
          variety_name: null,
          quantity_tons: null,
          purchase_price_yuan_per_ton: null,
          tax_included: null,
          quality_discount_yuan_per_ton: null,
          freight_yuan_per_ton: null,
          loading_yuan_per_ton: null,
          loss_rate_pct: null,
          financing_cost_yuan: primary.estimated_cost_yuan ?? null,
          other_cost_yuan: null,
          constraints_met: true,
          pending_items: [],
          field_meta: {},
        },
      ],
      [],
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel/60">
      <div className="border-b border-line/70 px-5 py-3.5">
        <h4 className="text-sm font-semibold">从其他小二导入方案数据</h4>
        <p className="mt-0.5 text-xs text-ink-soft">复用粮源、物流、资金环节的已有结果，导入后可补全缺失字段一起测算</p>
      </div>

      <div className="p-5">
        {/* 三个来源入口 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(AGENT_META) as Array<keyof typeof AGENT_META>).map((key) => {
            const meta = AGENT_META[key];
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => { setActiveTab(isActive ? null : key); setError(null); }}
                className={`group flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                  isActive ? meta.active : `border-line bg-rice-deep ${meta.hover}`
                }`}
              >
                <span
                  className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg border text-sm font-bold transition-transform group-hover:scale-105 ${meta.avatar}`}
                >
                  {meta.char}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${isActive ? meta.text : "text-ink"}`}>
                    {meta.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-soft">{meta.desc}</span>
                </span>
                <span
                  className={`flex-none text-xs transition-colors ${
                    isActive ? meta.text : "text-ink-soft/40 group-hover:text-ink-soft"
                  }`}
                >
                  {isActive ? "▲" : "▼"}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        {loading && <p className="mt-3 text-xs text-ink-soft">加载中…</p>}

        {/* 粮小二列表 */}
        {activeTab === "liang" && !loading && (
          <div className="mt-3 flex flex-col gap-2">
            {liangTasks.length === 0 ? (
              <p className="text-xs text-ink-soft">暂无已完成的寻源任务</p>
            ) : (
              liangTasks.map((t) => {
                const p = t.plan?.primary!;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectLiang(t)}
                    className="flex items-center justify-between rounded-xl bg-rice-deep p-3 text-left text-xs transition-colors hover:bg-rice-deep/80"
                  >
                    <div>
                      <span className="font-medium">{p.variety_name} · {p.origin}</span>
                      <span className="ml-2 text-ink-soft">{p.supplier_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-amber-300">{Number(p.price).toLocaleString()} 元/吨</span>
                      <span className="ml-2 text-ink-soft">{t.need?.quantity_tons}吨</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

      {/* 运小二列表 */}
      {activeTab === "yun" && !loading && (
        <div className="mt-3 flex flex-col gap-2">
          {yunTasks.length === 0 ? (
            <p className="text-xs text-ink-soft">暂无已出方案的运输任务</p>
          ) : (
            yunTasks.map((t) => {
              const plans = yunPlans[t.id];
              const isExpanded = selectedYunTaskId === t.id && plans;
              return (
                <div key={t.id}>
                  <button
                    onClick={() => isExpanded ? setSelectedYunTaskId(null) : loadYunPlans(t.id)}
                    className="flex w-full items-center justify-between rounded-xl bg-rice-deep p-3 text-left text-xs hover:bg-rice-deep/80"
                  >
                    <div>
                      <span className="font-medium">{t.origin} → {t.destination}</span>
                      <span className="ml-2 text-ink-soft">{t.variety_name} {t.quantity_tons}吨</span>
                    </div>
                    <span className="text-emerald-300">{t.status_label}</span>
                  </button>
                  {isExpanded && plans.length > 0 && (
                    <div className="mt-1 ml-4 flex flex-col gap-1">
                      {plans.filter((p) => p.plan_type !== "rejected").map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectYunPlan(t, p)}
                          className="flex items-center justify-between rounded-lg bg-panel p-2 text-xs hover:bg-panel/80"
                        >
                          <span>{p.title}</span>
                          <span className="text-emerald-300">
                            {p.price_low}~{p.price_high} 元/吨
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 钱小二列表 */}
      {activeTab === "qian" && !loading && (
        <div className="mt-3 flex flex-col gap-2">
          {qianRecords.length === 0 ? (
            <p className="text-xs text-ink-soft">暂无已保存的资金匹配</p>
          ) : (
            qianRecords.map((r) => {
              const p = r.result.primary!;
              return (
                <button
                  key={r.id}
                  onClick={() => handleSelectQian(r)}
                  className="flex items-center justify-between rounded-xl bg-rice-deep p-3 text-left text-xs hover:bg-rice-deep/80"
                >
                  <div>
                    <span className="font-medium">{p.product.name}</span>
                    <span className="ml-2 text-ink-soft">{r.requirement.duration_days}天</span>
                  </div>
                  <span className="text-orange-300">
                    {p.estimated_cost_yuan ? `${Number(p.estimated_cost_yuan).toLocaleString()} 元` : "—"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      </div>
    </div>
  );
}
