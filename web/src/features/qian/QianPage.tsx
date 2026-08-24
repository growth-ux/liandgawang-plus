import { useState, type CSSProperties } from "react";
import AgentSwitcher from "../../components/AgentSwitcher";
import AgentPortrait from "../../components/AgentPortrait";
import { getAgent } from "../../data/agents";
import type { FinanceProduct, FinanceRequirement } from "./types";
import FinanceMarketTab from "./FinanceMarketTab";
import SmartMatchTab from "./SmartMatchTab";
import MatchRecordsTab from "./MatchRecordsTab";

const agent = getAgent("qian")!;
const TABS = ["资金产品", "智能匹配", "我的匹配"] as const;

/** 钱小二：金融产品市场 + 智能匹配 + 历史匹配记录 */
export default function QianPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [draft, setDraft] = useState<Partial<FinanceRequirement> | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<FinanceProduct | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);

  const onStartMatch = (partial?: Partial<FinanceRequirement>) => {
    setDraft(partial ?? null);
    setActiveTab(1);
  };

  return (
    <div className="agent-theme-page flex min-h-[calc(100vh-4rem)] flex-col" style={{ "--agent-accent": agent.accent } as CSSProperties}>
      {/* 头部 */}
      <div className="agent-theme-header border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            <AgentPortrait agent={agent} />
            <div>
              <h1 className="text-lg font-semibold">
                {agent.name}｜{agent.action}
                <span className="agent-theme-tag ml-2.5 rounded-full px-2.5 py-0.5 text-xs font-normal">
                  {agent.role}
                </span>
              </h1>
            </div>
          </div>
          <AgentSwitcher currentId={agent.id} />
        </div>
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="flex gap-6">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`relative pb-3 pt-1 text-sm transition-colors ${
                  i === activeTab ? "agent-theme-tab-active font-semibold" : "text-ink-soft hover:text-ink"
                }`}
              >
                {tab}
                {i === activeTab && (
                  <span className="agent-theme-tab-line absolute inset-x-2 -bottom-px h-0.5 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容 */}
      <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6">
        {activeTab === 0 && (
          <FinanceMarketTab
            onStartMatch={onStartMatch}
            onViewProduct={setSelectedProduct}
          />
        )}
        {activeTab === 1 && (
          <SmartMatchTab
            prefill={draft}
            onSaved={() => setSavedVersion((v) => v + 1)}
            onViewProduct={setSelectedProduct}
          />
        )}
        {activeTab === 2 && (
          <MatchRecordsTab
            refreshKey={savedVersion}
            onReuse={(req) => {
              setDraft(req);
              setActiveTab(1);
            }}
            onOpenProduct={setSelectedProduct}
          />
        )}
      </div>

      {/* 产品详情抽屉 */}
      {selectedProduct && (
        <ProductDrawer
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onStartMatch={onStartMatch}
        />
      )}
    </div>
  );
}

// ─── ProductDrawer（内联实现，避免过度拆分） ────────────────────────────────

function ProductDrawer({
  product,
  onClose,
  onStartMatch,
}: {
  product: FinanceProduct;
  onClose: () => void;
  onStartMatch: (partial: Partial<FinanceRequirement>) => void;
}) {
  const PURPOSE_LABELS: Record<string, string> = {
    grain_purchase: "粮食采购",
    inventory_turnover: "库存周转",
    receivable_turnover: "应收周转",
  };
  const GUARANTEE_LABELS: Record<string, string> = {
    credit: "信用",
    guarantee: "保证",
    order: "订单",
    warehouse_receipt: "仓单",
    controlled_goods: "受控货权",
    receivable: "应收账款",
  };
  const CREDENTIAL_LABELS: Record<string, string> = {
    purchase_contract: "采购合同",
    purchase_order: "采购订单",
    warehouse_receipt: "仓单",
    controlled_goods: "货权凭证",
    receivable_invoice: "应收凭证",
    delivery_receipt: "交货单",
    business_license: "营业执照",
    bank_flow: "银行流水",
  };

  const fmt = (v: string) =>
    `${(Number(v) / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}万`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[520px] flex-col bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-base font-semibold">{product.name}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">✕</button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed">
          <p className="mb-4 text-xs text-ink-soft">{product.institution_name} · {product.scenario}</p>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <InfoCell label="额度范围" value={`${fmt(product.min_amount_yuan)}–${fmt(product.max_amount_yuan)}`} />
            <InfoCell label="使用期限" value={`${product.min_days}–${product.max_days}天`} />
            <InfoCell
              label="参考年化"
              value={product.annual_rate_pct ? `${product.annual_rate_pct}%` : "费用需人工确认"}
            />
            <InfoCell
              label="最低经营年限"
              value={product.min_business_years ? `${product.min_business_years}年` : "无要求"}
            />
          </div>

          <Section title="资金用途">
            {product.purposes.map((p) => (
              <Tag key={p} tone="brand">{PURPOSE_LABELS[p] ?? p}</Tag>
            ))}
          </Section>

          <Section title="增信方式">
            {product.guarantee_modes.map((g) => (
              <Tag key={g} tone="tech">{GUARANTEE_LABELS[g] ?? g}</Tag>
            ))}
          </Section>

          <Section title="必要凭证">
            {product.required_credentials.map((c) => (
              <Tag key={c} tone="amber">{CREDENTIAL_LABELS[c] ?? c}</Tag>
            ))}
          </Section>

          {product.fee_note && (
            <Section title="费用说明">
              <p className="text-xs text-ink-soft">{product.fee_note}</p>
            </Section>
          )}

          <Section title="准入条件">
            <ul className="space-y-1">
              {product.requirements.map((r, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-ink-soft">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
                  {r}
                </li>
              ))}
            </ul>
          </Section>

          <p className="mt-4 text-[11px] text-ink-soft/70">
            数据更新于 {product.data_updated_at} · 产品条件与费用需由金融顾问最终确认
          </p>
        </div>

        {/* 底部动作 */}
        <div className="border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={() => {
              onStartMatch({
                purpose: product.purposes[0],
                amount_yuan: product.min_amount_yuan,
                duration_days: product.min_days,
                credentials: product.required_credentials.length > 0 ? product.required_credentials : null,
              });
            }}
            className="w-full rounded-full bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand/90"
          >
            拿这个产品去匹配
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-rice-deep p-3">
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-medium text-ink-soft">{title}</h3>
      {children}
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: "brand" | "tech" | "amber" }) {
  const tones = {
    brand: "bg-brand-faint text-brand-deep",
    tech: "bg-tech/10 text-tech",
    amber: "bg-amber-400/10 text-amber-300",
  };
  return (
    <span className={`mr-1.5 mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}
