import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { PricePoint } from "./types";
import { fmtDate, fmtInt } from "./format";

const DEFAULT_WINDOW_DAYS = 90; // 默认显示最近 90 天，滚轮/拖拽可拉长到全量 2 年
const MIN_WINDOW_DAYS = 30; // 最小缩放窗口（天）

interface ChartSpot {
  region_name: string;
  quote_type: string;
  remark: string;
}

function buildOption(points: PricePoint[], spot: ChartSpot) {
  const startPct =
    points.length > DEFAULT_WINDOW_DAYS
      ? (1 - DEFAULT_WINDOW_DAYS / points.length) * 100
      : 0;
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#131c36",
      borderColor: "rgba(148,163,184,0.3)",
      textStyle: { color: "#e9eef7", fontSize: 12 },
      formatter: (params: any) => {
        const idx = params[0].dataIndex;
        const date = points[idx].observed_date;
        return [
          `<b>${spot.region_name}</b>`,
          `${spot.quote_type} · ${spot.remark}`,
          `${date}：<b>${fmtInt(String(params[0].value))}</b> 元/吨`,
        ].join("<br/>");
      },
    },
    grid: { left: 48, right: 20, top: 24, bottom: 52 },
    xAxis: {
      type: "category",
      data: points.map((p) => fmtDate(p.observed_date)),
      boundaryGap: false,
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
      axisTick: { show: false },
      axisLabel: { color: "#93a1b8", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: { color: "#93a1b8", fontSize: 11 },
      splitLine: {
        lineStyle: { color: "rgba(148,163,184,0.12)", type: "dashed" },
      },
    },
    dataZoom: [
      {
        type: "inside",
        start: startPct,
        end: 100,
        minValueSpan: MIN_WINDOW_DAYS,
        zoomOnMouseWheel: true,
        moveOnMouseWheel: false,
        moveOnMouseMove: true,
      },
      {
        type: "slider",
        start: startPct,
        end: 100,
        height: 20,
        bottom: 8,
        borderColor: "rgba(148,163,184,0.25)",
        backgroundColor: "rgba(19,28,54,0.35)",
        fillerColor: "rgba(34,211,238,0.15)",
        handleStyle: { color: "#22d3ee" },
        textStyle: { color: "#93a1b8", fontSize: 10 },
      },
    ],
    series: [
      {
        type: "line",
        data: points.map((p) => Number(p.price)),
        smooth: true,
        showSymbol: false,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#22d3ee", width: 2 },
        itemStyle: { color: "#22d3ee" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(34,211,238,0.25)" },
              { offset: 1, color: "rgba(34,211,238,0.0)" },
            ],
          },
        },
      },
    ],
  };
}

export default function PriceTrendChart({
  points,
  spot,
}: {
  points: PricePoint[];
  spot: ChartSpot;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = echarts.init(container);
    chartRef.current = chart;
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(buildOption(points, spot), true);
  }, [points, spot]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">价格走势</span>
        <span className="text-xs text-ink-soft">滚轮缩放 · 拖拽平移 · 最多 2 年</span>
      </div>
      <div ref={containerRef} className="h-[360px] w-full" />
    </div>
  );
}
