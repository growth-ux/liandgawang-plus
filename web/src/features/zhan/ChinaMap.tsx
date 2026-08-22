import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { SpotPrice } from "./types";
import { fmtInt, shortName } from "./format";

let chinaRegistered = false;

function buildOption(spots: SpotPrice[]) {
  const data = spots.map((s) => ({
    name: s.region_name,
    short: shortName(s.region_name),
    value: [s.lng, s.lat, Number(s.price)],
    price: fmtInt(s.price),
    change: s.change_pct,
    regionType: s.region_type,
    quoteType: s.quote_type,
    remark: s.remark,
    lastYear: fmtInt(s.last_year_price),
  }));

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "#131c36",
      borderColor: "rgba(148,163,184,0.3)",
      textStyle: { color: "#e9eef7", fontSize: 12 },
      formatter: (p: any) => {
        const d = p.data;
        const n = Number(d.change);
        const chgColor = n > 0 ? "#34d399" : n < 0 ? "#f87171" : "#93a1b8";
        return [
          `<b>${d.name}</b>`,
          `价格（${d.quoteType}）：${d.price} 元/吨`,
          `品质：${d.remark}`,
          `涨跌：<span style="color:${chgColor}">${n > 0 ? "+" : ""}${d.change}%</span>`,
          `去年同期：${d.lastYear}`,
        ].join("<br/>");
      },
    },
    geo: {
      map: "china",
      roam: true,
      layoutCenter: ["50%", "70%"],
      layoutSize: "140%",
      scaleLimit: { min: 1, max: 3 },
      label: { show: false },
      itemStyle: {
        areaColor: "rgba(148,163,184,0.08)",
        borderColor: "rgba(148,163,184,0.32)",
        borderWidth: 0.8,
      },
      emphasis: {
        itemStyle: { areaColor: "rgba(34,211,238,0.16)" },
        label: { show: true, color: "#e9eef7", fontSize: 11 },
      },
    },
    series: [
      {
        type: "scatter",
        coordinateSystem: "geo",
        data,
        symbolSize: 11,
        itemStyle: {
          color: (p: any) => (p.data.regionType === "产区" ? "#22d3ee" : "#ee7b1f"),
          borderColor: "#0b1220",
          borderWidth: 1,
        },
        label: {
          show: true,
          position: "top",
          distance: 6,
          color: "#e9eef7",
          fontSize: 11,
          lineHeight: 15,
          formatter: (p: any) => `${p.data.short}\n${p.data.price}`,
        },
      },
    ],
  };
}

export default function ChinaMap({ spots }: { spots: SpotPrice[] }) {
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
    if (chinaRegistered) {
      chart.setOption(buildOption(spots));
      return;
    }
    fetch("/geojson/china.json")
      .then((r) => r.json())
      .then((geoJson) => {
        echarts.registerMap("china", geoJson);
        chinaRegistered = true;
        chart.setOption(buildOption(spots));
      })
      .catch(() => {
        // 地图数据加载失败：不阻断页面，右侧指数表仍可用
      });
  }, [spots]);

  return <div ref={containerRef} className="h-[440px] w-full" />;
}
