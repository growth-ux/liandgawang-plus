import { useEffect, useState } from "react";
import AgentSwitcher from "../../components/AgentSwitcher";
import HoloProp from "../../components/field/HoloProp";
import { getAgent } from "../../data/agents";
import { fetchMarketOverview } from "./api";
import { VARIETIES, type MarketOverview } from "./types";
import ChinaMap from "./ChinaMap";
import PriceIndexTable from "./PriceIndexTable";

const agent = getAgent("zhan")!;

/** 市场全景主页面：品种切换 + 左地图 + 右指数表 */
export default function ZhanPage() {
  const [varietyCode, setVarietyCode] = useState<string>("corn");
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState<MarketOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      {/* 右下角角色伙伴 — 角色 + 全息投影，后期可点击对话 */}
      <button
        type="button"
        className="ld-bob fixed bottom-4 right-40 z-50 cursor-pointer"
        title={`与${agent.name}对话`}
      >
        <div className="relative h-[220px] transition-transform duration-300 hover:scale-[1.04]">
          <img
            src={agent.image}
            alt={agent.name}
            className="h-full w-auto drop-shadow-[0_0_18px_rgba(47,127,184,0.45)] hover:drop-shadow-[0_0_28px_rgba(34,211,238,0.6)]"
            draggable={false}
          />
          <HoloProp holo={agent.holo} />
        </div>
      </button>
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
        {activeTab !== 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
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
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
                <p className="text-sm text-red-400">行情加载失败：{error}</p>
                <p className="mt-2 text-xs text-ink-soft">请确认后端服务已启动、本地数据库已初始化。</p>
              </div>
            ) : !data ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-sm text-ink-soft">
                正在读取行情…
              </div>
            ) : (
              <>
                {/* 左地图 + 右指数表 */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
                  <div className="rounded-2xl border border-line bg-panel p-5">
                    <ChinaMap spots={data.spots} />
                    <div className="mt-3 flex items-center justify-center gap-4 text-xs text-ink-soft">
                      <span>
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-tech" />
                        产区库点
                      </span>
                      <span>
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand" />
                        销区 / 港口
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-panel p-5">
                    <div className="mb-3 text-sm font-semibold">价格指数</div>
                    {/* 固定表头 */}
                    <table className="w-full table-fixed border-collapse text-xs">
                      <colgroup>
                        <col className="w-[20%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[15%]" />
                        <col className="w-[23%]" />
                        <col className="w-[12%]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-line text-left text-ink-soft">
                          <th className="pb-2 pr-2 font-normal">地点</th>
                          <th className="pb-2 pr-2 text-right font-normal">价格</th>
                          <th className="pb-2 pr-2 text-right font-normal">涨跌</th>
                          <th className="pb-2 pl-6 pr-2 font-normal">口径</th>
                          <th className="pb-2 pl-6 pr-2 font-normal">备注</th>
                          <th className="pb-2 text-right font-normal">去年同期</th>
                        </tr>
                      </thead>
                    </table>
                    {/* 可滚动数据区 */}
                    <div className="max-h-[400px] overflow-y-auto">
                      <PriceIndexTable spots={data.spots} />
                    </div>
                  </div>
                </div>

                {/* 备注 */}
                <div className="rounded-xl border border-dashed border-line bg-panel/40 px-4 py-3 text-xs leading-6 text-ink-soft">
                  <span className="font-medium text-ink">备注：</span>
                  均为市场主流粮型、容重二等以上、水分达标；价格由各大区业务员在所在区域市场一手采集的实际成交价。涨跌为环比，去年同期为同比参考。
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
