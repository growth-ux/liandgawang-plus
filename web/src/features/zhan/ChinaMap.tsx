import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { SpotPrice } from "./types";
import { fmtInt, shortName } from "./format";

let chinaRegistered = false;

/** 涨跌着色遵循国内行情习惯：红涨绿跌 */
function chgColor(change: string): string {
  const n = Number(change);
  return n > 0 ? "#f87171" : n < 0 ? "#34d399" : "#93a1b8";
}

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
        const chgColorCss = n > 0 ? "#f87171" : n < 0 ? "#34d399" : "#93a1b8";
        return [
          `<b>${d.name}</b>（${d.regionType}）`,
          `价格（${d.quoteType}）：${d.price} 元/吨`,
          `品质：${d.remark}`,
          `涨跌：<span style="color:${chgColorCss}">${n > 0 ? "+" : ""}${d.change}%</span>`,
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
        // 点越大代表当日波动越大
        symbolSize: (_value: number[], p: any) =>
          Math.min(17, 9 + Math.abs(Number(p.data.change)) * 4),
        itemStyle: {
          color: (p: any) => chgColor(p.data.change),
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

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">全国市场监测分布</div>
        <div className="flex items-center gap-3 text-[11px] text-ink-soft">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-400" />
            上涨
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            下跌
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-ink-soft" />
            持平
          </span>
          <span className="text-ink-soft/60">点越大波动越大</span>
        </div>
      </div>
      <div ref={containerRef} className="h-[420px] w-full" />
    </div>
  );
}
