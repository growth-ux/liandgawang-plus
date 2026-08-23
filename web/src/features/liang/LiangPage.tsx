// web/src/features/liang/LiangPage.tsx
import { useEffect, useState } from "react";
import AgentSwitcher from "../../components/AgentSwitcher";
import { getAgent } from "../../data/agents";
import { fetchListings, fetchMarketSummary } from "./api";
import { CandidateProvider } from "./CandidateContext";
import MarketSummaryBar from "./MarketSummaryBar";
import FilterPanel from "./FilterPanel";
import ListingTable from "./ListingTable";
import ListingDetailDrawer from "./ListingDetailDrawer";
import CandidateBasket from "./CandidateBasket";
import Pagination from "./Pagination";
import CompareTab from "./CompareTab";
import SourcingTab from "./SourcingTab";
import type {
  Listing,
  ListingFilters,
  MarketSummary,
} from "./types";

const agent = getAgent("liang")!;

const PAGE_SIZE = 10;

export default function LiangPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [filters, setFilters] = useState<ListingFilters>({});
  const [listings, setListings] = useState<Listing[]>([]);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [detail, setDetail] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setPage(1);
    fetchListings(filters)
      .then((d) => {
        if (!cancelled) setListings(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    fetchMarketSummary()
      .then((d) => {
        if (!cancelled) {
          setSummary(d.summary);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(listings.length / PAGE_SIZE));
  const pageListings = listings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goCompare = () => setActiveTab(2);
  const activeFilterCount = Object.values(filters).filter((value) => value !== undefined && value !== null && value !== "").length;

  return (
    <CandidateProvider>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col">
        {/* 头部 */}
        <div className="border-b border-line bg-panel">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3.5">
              <img
                src={agent.image}
                alt={agent.name}
                className="h-12 w-auto drop-shadow-[0_0_10px_rgba(201,144,42,0.35)]"
              />
              <div>
                <h1 className="text-lg font-semibold">
                  {agent.name}｜{agent.action}
                  <span className="ml-2.5 rounded-full bg-brand-faint px-2.5 py-0.5 text-xs font-normal text-brand-deep">
                    {agent.role}
                  </span>
                </h1>
              </div>
            </div>
            <AgentSwitcher currentId={agent.id} />
          </div>
          {/* Tab 条 */}
          <div className="mx-auto max-w-[1280px] px-6">
            <div className="flex gap-6">
              {agent.tabs.map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={`relative pb-3 pt-1 text-sm transition-colors ${
                    i === activeTab ? "font-semibold text-brand-deep" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {tab}
                  {i === activeTab && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6">
          {activeTab === 1 ? (
            <SourcingTab />
          ) : activeTab === 2 ? (
            <CompareTab onGoFind={() => setActiveTab(0)} />
          ) : activeTab !== 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
              <img src={agent.image} alt={agent.name} className="h-20 w-auto drop-shadow-[0_0_16px_rgba(201,144,42,0.4)]" />
              <h2 className="mt-4 text-lg font-semibold">「{agent.tabs[activeTab]}」正在建设中</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
                本页将提供粮小二的专业服务，功能按设计逐步落地。
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {summary && <MarketSummaryBar summary={summary} />}

              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <FilterPanel
                  filters={filters}
                  onChange={setFilters}
                  onReset={() => setFilters({})}
                />
                {error ? (
                  <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
                    <p className="text-sm text-red-400">粮源加载失败：{error}</p>
                    <p className="mt-2 text-xs text-ink-soft">请确认后端服务已启动、本地数据库已初始化。</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between px-1">
                      <div>
                      </div>
                      {activeFilterCount > 0 && (
                        <button type="button" onClick={() => setFilters({})} className="text-xs text-tech hover:text-white">
                          清除筛选
                        </button>
                      )}
                    </div>
                    <ListingTable
                      listings={pageListings}
                      onDetail={setDetail}
                    />
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      total={listings.length}
                      onChange={setPage}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 候选篮浮动气泡 */}
        <CandidateBasket onGoCompare={goCompare} />

        {/* 详情抽屉 */}
        {detail && <ListingDetailDrawer listing={detail} onClose={() => setDetail(null)} />}
      </div>
    </CandidateProvider>
  );
}
