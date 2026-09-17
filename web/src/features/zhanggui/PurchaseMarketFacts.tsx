import { useState } from "react";
import type { MarketFactEvent, MarketOverview } from "../zhan/types";
import type { PurchaseNeed } from "./purchaseModel";
import { formatMoney } from "./purchaseModel";
import PurchaseFuturesEvidence from "./PurchaseFuturesEvidence";

export type MarketEvidenceTab = "spot" | "futures" | "supply" | "demand" | "events";

export const MARKET_EVIDENCE_TABS: { id: MarketEvidenceTab; label: string }[] = [
  { id: "spot", label: "现货行情" },
  { id: "futures", label: "期货基差" },
  { id: "supply", label: "供应" },
  { id: "demand", label: "需求" },
  { id: "events", label: "关键事件" },
];

function signed(value: number, suffix = "") {
  return `${value > 0 ? "+" : ""}${value.toFixed(value % 1 ? 2 : 0)}${suffix}`;
}

function destinationKeyword(destination: string) {
  for (const name of ["潍坊", "济南", "临沂", "德州", "青岛", "烟台"]) {
    if (destination.includes(name)) return name;
  }
  return "山东";
}

function eventDate(event: MarketFactEvent) {
  const date = new Date(event.date);
  return Number.isNaN(date.getTime())
    ? event.date.slice(5, 10)
    : date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function SourceLink({ href, children }: { href?: string; children: string }) {
  return href ? <a href={href} target="_blank" rel="noreferrer">{children} ↗</a> : <>{children}</>;
}

function SupplyComparison({ comparison }: { comparison: NonNullable<NonNullable<MarketOverview["facts"]>["supply"]["comparison"]> }) {
  return (
    <section className="pw-supply-comparison" aria-label={comparison.title}>
      <header><h5>{comparison.title}</h5><span>截至 {comparison.observed_at} · 单位：{comparison.unit}</span></header>
      <table>
        <thead><tr><th>指标</th><th>本周</th><th>上周</th><th>周变化</th></tr></thead>
        <tbody>{comparison.points.map((point) => (
          <tr key={point.label}>
            <th scope="row">{point.label}</th>
            <td>{point.current.toLocaleString("zh-CN")}</td>
            <td>{point.previous.toLocaleString("zh-CN")}</td>
            <td>{point.change}</td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}

function DemandRatios({ ratios }: { ratios: NonNullable<NonNullable<MarketOverview["facts"]>["demand"]["ratios"]> }) {
  return (
    <section className="pw-demand-ratios" aria-label="饲料配方公开监测比例">
      <header><h5>饲料配方公开监测比例</h5><span>比例尺 0–100%</span></header>
      {ratios.map((ratio) => (
        <div className="pw-demand-ratio" key={ratio.label}>
          <div><strong>{ratio.label}</strong><span>{ratio.display} · {ratio.observed_at}</span></div>
          <div className="pw-demand-ratio-track" aria-label={`${ratio.label}${ratio.display}`}>
            <i style={{ left: `${ratio.min}%`, width: `${ratio.max - ratio.min}%` }} />
          </div>
        </div>
      ))}
    </section>
  );
}

function DemandSections({ sections }: { sections: NonNullable<NonNullable<MarketOverview["facts"]>["demand"]["sections"]> }) {
  return (
    <div className="pw-demand-section-grid" aria-label="需求侧连续指标">
      {sections.map((section) => (
        <section className="pw-demand-section" key={section.title}>
          <header><h5>{section.title}</h5><span>截至 {section.observed_at}</span></header>
          <dl>
            {section.items.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd><strong>{item.value}</strong><small>{item.change}</small></dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function MarketEventTimeline({ events }: { events: MarketFactEvent[] }) {
  const [filter, setFilter] = useState("全部");
  const ordered = [...events].sort((a, b) => b.date.localeCompare(a.date));
  const categories = ["全部", ...Array.from(new Set(ordered.map((event) => event.category)))];
  const visible = filter === "全部" ? ordered : ordered.filter((event) => event.category === filter);
  return (
    <section className="pw-market-events pw-market-events-tab" aria-labelledby="pw-market-events-title">
      <div className="pw-market-events-heading">
        <div><span>动态信息</span><h4 id="pw-market-events-title">关键事件</h4></div>
        <p>按发生时间倒序，保留事件原文、地区与来源</p>
      </div>
      <div className="pw-market-event-filters" aria-label="事件类型筛选">
        {categories.map((category) => <button key={category} type="button"
          aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}</button>)}
      </div>
      <div className="pw-market-event-list">
        {visible.length ? visible.map((event) => (
          <article key={`${event.date}-${event.title}`}>
            <time>{eventDate(event)}</time>
            <div><h5><span>{event.category}</span>{event.title}</h5><p>{event.summary}</p>
              <SourceLink href={event.source_url}>{event.source}</SourceLink></div>
            <small>{event.regions.join(" · ")}</small>
          </article>
        )) : <p className="pw-market-events-empty">当前分类没有公开事件记录。</p>}
      </div>
    </section>
  );
}

export default function PurchaseMarketFacts({
  overview,
  need,
  quoteLow,
  quoteHigh,
  selectedSpotCode,
  activeTab,
}: {
  overview: MarketOverview | null;
  need: PurchaseNeed;
  quoteLow: number;
  quoteHigh: number;
  selectedSpotCode?: string;
  activeTab: MarketEvidenceTab;
}) {
  if (!overview) {
    return (
      <div className="pw-market-facts-loading" role="status">
        正在汇总现货、期货、供给与需求数据…
      </div>
    );
  }

  const facts = overview.facts;
  const keyword = destinationKeyword(need.destination);
  const targetSpot =
    overview.spots.find((spot) => spot.spot_code === selectedSpotCode) ??
    overview.spots.find((spot) => spot.region_name.includes(keyword)) ??
    overview.spots.find((spot) => spot.region_type === "销区") ??
    overview.spots[0];
  const targetPrice = Number(targetSpot?.price ?? 0);

  if (activeTab === "spot") {
    return (
      <div className="pw-market-spot-summary" aria-label="现货行情补充信息">
        <dl>
          <div><dt>所选市场</dt><dd>{targetSpot?.region_name ?? need.destination}</dd></div>
          <div><dt>当前报价</dt><dd>{targetPrice ? `${formatMoney(targetPrice)} 元/吨` : "—"}</dd></div>
          <div><dt>日涨跌</dt><dd>{targetSpot ? signed(Number(targetSpot.change_pct), "%") : "—"}</dd></div>
          <div><dt>候选库点出库价</dt><dd>{formatMoney(quoteLow)}–{formatMoney(quoteHigh)} 元/吨</dd></div>
        </dl>
        <small>截至 {overview.price_date} · 区域市场监测 · 山东 {overview.spots.filter((spot) => spot.region_name.includes("山东")).length} 个监测点</small>
      </div>
    );
  }

  if (activeTab === "futures") {
    if (facts?.futures.series?.length) {
      return <PurchaseFuturesEvidence fact={facts.futures} />;
    }
    return (
      <article className="pw-market-fact-card pw-market-fact-card-single">
        <header>
          <div><h4>期货与基差</h4><p>同一日期下的期货收盘、现货均价与基差记录</p></div>
        </header>
        <div className="pw-market-fact-lead">
          <strong>{facts ? formatMoney(Number(facts.futures.price)) : "—"}<small>元/吨</small></strong>
          <span>{facts?.futures.contract ?? "对应合约"} · {facts ? signed(Number(facts.futures.change_pct), "%") : "—"}</span>
        </div>
        <dl>
          {(facts?.futures.metrics ?? []).map((metric) => (
            <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}<small>{metric.change}</small></dd></div>
          ))}
        </dl>
        <footer>{facts?.futures.observed_at ?? overview.price_date} · <SourceLink href={facts?.futures.source_url}>{facts?.futures.source ?? "交易所行情"}</SourceLink></footer>
      </article>
    );
  }

  if (activeTab === "events") {
    return <MarketEventTimeline events={facts?.events ?? []} />;
  }

  const fact = facts?.[activeTab];
  const isSupply = activeTab === "supply";
  const supplyComparison = activeTab === "supply" ? facts?.supply.comparison : undefined;
  const demandSections = activeTab === "demand" ? facts?.demand.sections : undefined;
  const demandRatios = activeTab === "demand" ? facts?.demand.ratios : undefined;
  const sources = isSupply ? facts?.supply.sources : facts?.demand.sources;
  return (
    <article className="pw-market-fact-card pw-market-fact-card-single">
      <header>
        <div>
          <h4>{isSupply ? "供应变化" : "需求变化"}</h4>
          <p>{isSupply ? "港口到货、库存与进口数据" : "加工、饲用与采购记录"}</p>
        </div>
      </header>
      <div className="pw-market-fact-copy">
        <strong>{fact?.headline ?? "正在整理"}</strong>
        <p>{fact?.summary ?? "等待相关市场数据。"}</p>
      </div>
      {supplyComparison && <SupplyComparison comparison={supplyComparison} />}
      {demandSections && <DemandSections sections={demandSections} />}
      {demandRatios && <DemandRatios ratios={demandRatios} />}
      {(!demandSections?.length || isSupply) && <dl>
          {(fact?.metrics ?? []).map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}<small>{metric.change}</small></dd>
            </div>
          ))}
        </dl>}
      <footer>
        截至 {fact?.observed_at ?? overview.price_date} · {sources?.length
          ? <>数据源：{sources.map((source, index) => <span key={source.url}>
            {index > 0 && " · "}<SourceLink href={source.url}>{source.label}</SourceLink>
          </span>)}</>
          : <SourceLink href={fact?.source_url}>{fact?.source ?? "市场监测"}</SourceLink>}
      </footer>
    </article>
  );
}
