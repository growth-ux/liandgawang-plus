import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { fetchMarketOverview, fetchPriceSeries } from "../zhan/api";
import type { PricePoint, PriceSeriesResponse, SpotPrice } from "../zhan/types";
import { formatMoney } from "./purchaseModel";
import MarketRegionSelect from "./MarketRegionSelect";
import type { MarketSelection } from "./purchaseAdvice";

export function trendWindow(points: PricePoint[], days: number) {
  const latest = points[points.length - 1];
  if (!latest) return [];
  const cutoff = new Date(`${latest.observed_date}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
  const start = cutoff.toISOString().slice(0, 10);
  return points.filter((point) => point.observed_date >= start);
}

export function priceTrendOption(points: PricePoint[]): echarts.EChartsOption {
  return {
    animationDuration: 350,
    grid: { left: 56, right: 28, top: 30, bottom: 36 },
    tooltip: {
      trigger: "axis",
      renderMode: "richText",
      confine: true,
      backgroundColor: "#142238",
      borderColor: "#345371",
      textStyle: { color: "#e6f2fa" },
      valueFormatter: (value) => `${formatMoney(Number(value))} 元/吨`,
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.observed_date),
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#304761" } },
      axisTick: { show: false },
      axisLabel: { color: "#9eb2c9", fontSize: 12, formatter: (date: string) => date.slice(5).replace("-", "/") },
    },
    yAxis: {
      type: "value",
      scale: true,
      name: "元/吨",
      nameTextStyle: { color: "#9eb2c9", padding: [0, 0, 0, 20] },
      axisLabel: { color: "#9eb2c9", fontSize: 12 },
      splitLine: { lineStyle: { color: "#6b95b621", type: "dashed" } },
    },
    series: [{
      name: "成交价",
      type: "line",
      data: points.map((point) => Number(point.price)),
      showSymbol: points.length <= 7,
      symbol: "circle",
      symbolSize: 6,
      lineStyle: { color: "#57d4de", width: 3 },
      itemStyle: { color: "#57d4de", borderColor: "#102033", borderWidth: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "#39bdcf40" },
          { offset: 1, color: "#39bdcf02" },
        ]),
      },
      markPoint: {
        symbol: "circle", symbolSize: 7,
        label: { show: false },
        data: [{ type: "max", name: "区间最高" }, { type: "min", name: "区间最低" }],
      },
    }],
  };
}

function TrendChart({ points }: { points: PricePoint[] }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let chart: echarts.ECharts | undefined;
    const resize = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      if (!chart) {
        chart = echarts.init(element);
        chart.setOption(priceTrendOption(points));
      } else chart.resize();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => { observer.disconnect(); chart?.dispose(); };
  }, [points]);
  return <div ref={container} className="pw-price-chart" role="img" aria-label={`${points[0]?.observed_date}至${points[points.length - 1]?.observed_date}价格走势，末日${points[points.length - 1]?.price}元/吨`} />;
}

export default function PurchaseMarketTrend({ variety, asOf, onContextChange }: {
  variety: "玉米" | "小麦";
  asOf?: string;
  onContextChange?(selection: MarketSelection): void;
}) {
  const [spots, setSpots] = useState<SpotPrice[]>([]);
  const [spotCode, setSpotCode] = useState("");
  const [series, setSeries] = useState<PriceSeriesResponse | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const varietyCode = variety === "玉米" ? "corn" : "wheat";

  useEffect(() => {
    let cancelled = false;
    setSpots([]); setSpotCode(""); setSeries(null); setError("");
    fetchMarketOverview(varietyCode).then((overview) => {
      if (cancelled) return;
      const regional = overview.spots.filter((spot) => spot.region_name.includes("山东"));
      if (!regional.length) { setError("暂无山东区域行情"); return; }
      setSpots(regional);
      const preferred = regional.find((spot) => spot.region_name.includes("潍坊"))
        ?? regional.find((spot) => spot.region_type === "销区") ?? regional[0];
      setSpotCode(preferred.spot_code);
    }).catch(() => { if (!cancelled) setError("行情暂时无法加载"); });
    return () => { cancelled = true; };
  }, [varietyCode, retry]);

  useEffect(() => {
    if (!spotCode) return;
    let cancelled = false;
    setSeries(null); setError("");
    fetchPriceSeries(varietyCode, spotCode).then((data) => {
      if (cancelled) return;
      const points = data.points.filter((point) =>
        Number.isFinite(Number(point.price)) && Number(point.price) > 0 &&
        (!asOf || point.observed_date <= asOf),
      ).sort((a, b) => a.observed_date.localeCompare(b.observed_date));
      if (points.length < 2) { setError("该时段暂无价格走势"); return; }
      setSeries({ ...data, points });
    }).catch(() => { if (!cancelled) setError("价格走势暂时无法加载"); });
    return () => { cancelled = true; };
  }, [varietyCode, spotCode, asOf]);

  useEffect(() => {
    onContextChange?.(error ? "unavailable" : series ? {
      spot_code: series.spot.spot_code, period_days: period,
      data_date: series.points[series.points.length - 1].observed_date,
    } : "loading");
  }, [error, series, period, onContextChange]);

  // 研判结果回写会触发父组件重渲染。保持 points 引用稳定，
  // 避免 TrendChart 的 effect 误判数据变化并重新初始化 ECharts。
  const points = useMemo(
    () => (series ? trendWindow(series.points, period) : []),
    [series, period],
  );
  const prices = useMemo(
    () => points.map((point) => Number(point.price)),
    [points],
  );
  const latest = prices[prices.length - 1] ?? 0;
  const change = latest - (prices[0] ?? 0);
  const percent = prices[0] ? change / prices[0] * 100 : 0;
  const sign = change > 0 ? "+" : "";
  return (
    <section className="pw-price-history" aria-label="行情走势">
      <div className="pw-price-history-heading">
        <h3>{variety}行情走势</h3>
        <MarketRegionSelect spots={spots} value={spotCode}
          onChange={(code) => { setSeries(null); setError(""); setSpotCode(code); }} />
      </div>
      {error ? (
        <div className="pw-price-loading" role="status">
          <p>{error}</p><button className="pw-text-button" onClick={() => setRetry((value) => value + 1)}>重新加载</button>
        </div>
      ) : !series ? <div className="pw-price-loading" role="status">正在读取行情…</div> : (
        <>
          <div className="pw-price-metrics">
            <div><span>成交价</span><strong>{formatMoney(latest)}<small>元/吨</small></strong></div>
            <div data-direction={change > 0 ? "up" : change < 0 ? "down" : "flat"}>
              <span>近 {period} 天涨跌</span><strong>{sign}{formatMoney(change)}<small>元/吨</small></strong>
              <em>{sign}{percent.toFixed(2)}%</em>
            </div>
            <div><span>区间最高</span><strong>{formatMoney(Math.max(...prices))}<small>元/吨</small></strong></div>
            <div><span>区间最低</span><strong>{formatMoney(Math.min(...prices))}<small>元/吨</small></strong></div>
          </div>
          <div className="pw-price-chart-toolbar">
            <span>成交价 · {series.spot.remark}</span>
            <div aria-label="走势周期">{([7, 30, 90] as const).map((days) => (
              <button key={days} type="button" aria-pressed={period === days} onClick={() => setPeriod(days)}>近{days}天</button>
            ))}</div>
          </div>
          <TrendChart points={points} />
          <div className="pw-price-history-date"><span>{points[0]?.observed_date} — {points[points.length - 1]?.observed_date}</span><span>来源：瞻小二行情库</span></div>
        </>
      )}
    </section>
  );
}
