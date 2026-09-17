import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import type { BasisPoint, FuturesPoint, MarketFacts } from "../zhan/types";
import { readThemePalette, useTheme, type ThemePalette } from "../../theme/ThemeContext";
import { formatMoney } from "./purchaseModel";

type FuturesFact = MarketFacts["futures"];

function compactVolume(value: number) {
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString("zh-CN");
}

function futuresOption(points: FuturesPoint[], palette: ThemePalette): echarts.EChartsOption {
  return {
    animationDuration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280,
    grid: [
      { left: 58, right: 24, top: 22, height: "58%" },
      { left: 58, right: 24, top: "75%", height: "14%" },
    ],
    tooltip: {
      trigger: "axis", confine: true, backgroundColor: palette.surface,
      borderColor: palette.line, textStyle: { color: palette.text },
      valueFormatter: (value) => Number(value).toLocaleString("zh-CN"),
    },
    xAxis: [
      { type: "category", data: points.map((point) => point.date), boundaryGap: false,
        axisLine: { lineStyle: { color: palette.line } }, axisTick: { show: false },
        axisLabel: { show: false } },
      { type: "category", gridIndex: 1, data: points.map((point) => point.date), boundaryGap: true,
        axisLine: { lineStyle: { color: palette.line } }, axisTick: { show: false },
        axisLabel: { color: palette.muted, fontSize: 10,
          formatter: (date: string, index: number) => index % 5 === 0 || index === points.length - 1 ? date.slice(5).replace("-", "/") : "" } },
    ],
    yAxis: [
      { type: "value", scale: true, name: "元/吨", nameTextStyle: { color: palette.muted },
        axisLabel: { color: palette.muted, fontSize: 10 }, axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: palette.grid, type: "dashed" } } },
      { type: "value", gridIndex: 1, min: 0, splitNumber: 2,
        axisLabel: { color: palette.muted, fontSize: 9, formatter: compactVolume },
        axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } },
    ],
    series: [
      { name: "收盘价", type: "line", data: points.map((point) => point.close), showSymbol: false,
        lineStyle: { color: palette.tech, width: 2.5 }, itemStyle: { color: palette.tech },
        areaStyle: { color: palette.techArea }, emphasis: { focus: "series" } },
      { name: "成交量", type: "bar", xAxisIndex: 1, yAxisIndex: 1,
        data: points.map((point) => point.volume), barMaxWidth: 13,
        itemStyle: { color: palette.muted, opacity: .38, borderRadius: [2, 2, 0, 0] } },
    ],
  };
}

function basisOption(points: BasisPoint[], palette: ThemePalette): echarts.EChartsOption {
  return {
    animationDuration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240,
    grid: { left: 55, right: 22, top: 18, bottom: 30 },
    tooltip: {
      trigger: "axis", confine: true, backgroundColor: palette.surface,
      borderColor: palette.line, textStyle: { color: palette.text },
      formatter: (items: unknown) => {
        const item = Array.isArray(items) ? items[0] as { dataIndex: number } : null;
        const point = item ? points[item.dataIndex] : undefined;
        return point ? `${point.date}<br/>全国现货均价 ${point.spot} 元/吨<br/>C2611 收盘 ${point.futures} 元/吨<br/>参考基差 ${point.basis > 0 ? "+" : ""}${point.basis} 元/吨` : "";
      },
    },
    xAxis: { type: "category", data: points.map((point) => point.date), boundaryGap: false,
      axisLine: { lineStyle: { color: palette.line } }, axisTick: { show: false },
      axisLabel: { color: palette.muted, fontSize: 10, formatter: (date: string) => date.slice(5).replace("-", "/") } },
    yAxis: { type: "value", scale: true, name: "元/吨", nameTextStyle: { color: palette.muted },
      axisLabel: { color: palette.muted, fontSize: 10 }, axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { color: palette.grid, type: "dashed" } } },
    series: [{ name: "参考基差", type: "line", data: points.map((point) => point.basis),
      symbol: "circle", symbolSize: 7, lineStyle: { color: "#91b8ea", width: 2 },
      itemStyle: { color: "#91b8ea", borderColor: palette.surface, borderWidth: 2 },
      areaStyle: { color: "rgba(145, 184, 234, .13)" } }],
  };
}

function Chart({ option, className, label }: { option: echarts.EChartsOption; className: string; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const chart = echarts.init(element);
    chart.setOption(option);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [option, theme]);
  return <div ref={container} className={className} role="img" aria-label={label} />;
}

export default function PurchaseFuturesEvidence({ fact }: { fact: FuturesFact }) {
  const palette = readThemePalette();
  const series = fact.series ?? [];
  const basis = fact.basis_series ?? [];
  const latest = series[series.length - 1];
  const first = series[0];
  const change = latest && first ? latest.close - first.close : 0;
  const chartOption = useMemo(() => futuresOption(series, palette), [series, palette.surface, palette.text, palette.muted, palette.line, palette.grid, palette.tech, palette.techArea]);
  const basisChartOption = useMemo(() => basisOption(basis, palette), [basis, palette.surface, palette.text, palette.muted, palette.line, palette.grid]);

  if (!series.length) return null;
  return (
    <article className="pw-futures-evidence">
      <header className="pw-futures-evidence-heading">
        <div><span>{fact.contract}</span><h4>期货收盘与成交量</h4></div>
        <dl>
          <div><dt>最新收盘</dt><dd>{formatMoney(latest.close)}</dd></div>
          <div><dt>近30日变动</dt><dd>{change > 0 ? "+" : ""}{formatMoney(change)}</dd></div>
          <div><dt>最新成交量</dt><dd>{compactVolume(latest.volume)}手</dd></div>
        </dl>
      </header>
      <Chart option={chartOption} className="pw-futures-chart"
        label={`${fact.contract}从${first.date}至${latest.date}的收盘价与成交量走势`} />
      <section className="pw-basis-evidence">
        <div className="pw-basis-evidence-heading">
          <div><h5>全国玉米均价－C2611</h5><p>公开周度数据 · 同日口径</p></div>
          <strong>{basis.length ? `${basis[basis.length - 1].basis > 0 ? "+" : ""}${basis[basis.length - 1].basis}` : "—"}<small>元/吨</small></strong>
        </div>
        <Chart option={basisChartOption} className="pw-basis-chart"
          label={`全国玉米均价与${fact.contract}的周度参考基差`} />
      </section>
      <footer>
        <span>期货截至 {fact.observed_at} · <a href={fact.source_url} target="_blank" rel="noreferrer">{fact.source} ↗</a></span>
        {fact.basis_source && <span>基差截至 {basis[basis.length - 1]?.date} · <a href={fact.basis_source_url} target="_blank" rel="noreferrer">{fact.basis_source} ↗</a></span>}
      </footer>
    </article>
  );
}
