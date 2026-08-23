import { useEffect, useState } from "react";
import AgentSwitcher from "../../components/AgentSwitcher";
import { getAgent } from "../../data/agents";
import { fetchMarketOverview } from "./api";
import { VARIETIES, type AnalysisRecord, type AnalysisRequest, type MarketOverview } from "./types";
import ChinaMap from "./ChinaMap";
import PriceIndexTable from "./PriceIndexTable";
import AnalysisRecordsTab from "./AnalysisRecordsTab";
import MarketJudgment from "./components/MarketJudgment";
import MarketEventList from "./components/MarketEventList";
import MarketStatsBar from "./components/MarketStatsBar";
import ProcurementAnalysisTab from "./ProcurementAnalysisTab";
import VarietyMarketTab from "./VarietyMarketTab";

const agent = getAgent("zhan")!;

/** 市场全景主页面：品种切换 + AI 判断 + 地图 + 指数表 + 事件 */
export default function ZhanPage() {
  const [varietyCode, setVarietyCode] = useState<string>("corn");
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState<MarketOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<AnalysisRequest | null>(null);

  const reuseRecord = (r: AnalysisRecord) => {
    setPrefill({
      variety_code: r.variety_code,
      quantity_tons: r.quantity_tons,
      deadline_date: r.deadline_date,
      grade: r.grade,
      target_region: r.target_region ?? "",
      budget_price: r.budget_price,
      stock_days: r.stock_days,
      risk_preference: r.risk_preference,
      remark: r.remark,
    });
    setActiveTab(2);
  };

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetchMarketOverview(varietyCode)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [varietyCode]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* 头部：全宽背景 + 内容居中约束 */}
      <div className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            <img
              src={agent.image}
              alt={agent.name}
              className="h-12 w-auto drop-shadow-[0_0_10px_rgba(47,127,184,0.35)]"
            />
            <div>
              <h1 className="text-lg font-semibold">
                {agent.name}｜{agent.action}
                <span className="ml-2.5 rounded-full bg-brand-faint px-2.5 py-0.5 text-xs font-normal text-brand-deep">
                  {agent.role}
                </span>
                {/* 市场方向标签 */}
                {data?.judgment && (
                  <span
                    className={`ml-2 text-[11px] font-normal ${
                      data.judgment.direction === "bullish"
                        ? "text-emerald-400"
                        : data.judgment.direction === "bearish"
                          ? "text-red-400"
                          : "text-amber-300"
                    }`}
                  >
                    {data.judgment.direction === "bullish"
                      ? "↑ 偏强"
                      : data.judgment.direction === "bearish"
                        ? "↓ 偏弱"
                        : "↔ 震荡"}
                  </span>
                )}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <AgentSwitcher currentId={agent.id} />
          </div>
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
          <VarietyMarketTab
            varietyCode={varietyCode}
            onVarietyChange={setVarietyCode}
          />
        ) : activeTab === 2 ? (
          <ProcurementAnalysisTab
            varietyCode={varietyCode}
            onVarietyChange={setVarietyCode}
            prefill={prefill}
            onPrefillConsumed={() => setPrefill(null)}
          />
        ) : activeTab === 4 ? (
          <AnalysisRecordsTab onReuse={reuseRecord} />
        ) : activeTab !== 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-line bg-panel/60 text-center">
            <img
              src={agent.image}
              alt={agent.name}
              className="h-20 w-auto drop-shadow-[0_0_16px_rgba(47,127,184,0.4)]"
            />
            <h2 className="mt-4 text-lg font-semibold">「{agent.tabs[activeTab]}」正在建设中</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
              本页将提供{agent.role}的完整专业服务。当前为原型占位，功能按设计逐步落地。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* 品种切换 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-soft">品种</span>
              {VARIETIES.map((v) => (
                <button
                  key={v.code}
                  type="button"
                  onClick={() => setVarietyCode(v.code)}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    varietyCode === v.code
                      ? "bg-tech font-semibold text-rice"
                      : "border border-line bg-panel text-ink-soft hover:text-ink"
                  }`}
                >
                  {v.name}
                </button>
              ))}
              {data && (
                <span className="ml-auto text-xs text-ink-soft">价格日期 {data.price_date}</span>
              )}
            </div>

            {/* 加载 / 错误 */}
            {error ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-line bg-panel/60 text-center">
                <p className="text-sm text-red-400">行情加载失败：{error}</p>
                <p className="mt-2 text-xs text-ink-soft">请确认后端服务已启动、本地数据库已初始化。</p>
              </div>
            ) : !data ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-tech" />
                  瞻小二正在整理行情…
                </div>
              </div>
            ) : (
              <>
                {/* 行情概览统计条 */}
                <MarketStatsBar spots={data.spots} />

                {/* AI 判断面板 */}
                {data.judgment && (
                  <MarketJudgment judgment={data.judgment} priceDate={data.price_date} />
                )}

                {/* 左地图 + 右指数表 */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
                  <ChinaMap spots={data.spots} />

                  <div className="rounded-xl border border-line bg-panel p-5">
                    <div className="mb-3 text-sm font-semibold">价格指数</div>
                    <PriceIndexTable spots={data.spots} />
                  </div>
                </div>

                {/* 关键事件卡片 */}
                <MarketEventList events={data.events} />

                {/* 备注 */}
                <div className="rounded-xl border border-line bg-panel/40 px-4 py-3 text-xs leading-6 text-ink-soft">
                  <span className="font-medium text-ink">口径说明：</span>
                  均为市场主流粮型、容重二等以上、水分达标；价格由各大区业务员在所在区域市场一手采集的实际成交价（每个监测点为当地代表性报价），涨跌为环比上一报价日，去年同期为同比参考。
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
