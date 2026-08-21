/**
 * 首页全息道具：每个小二「正在操作」的橙色全息屏（纯 SVG + CSS 动画装饰层）
 * 造型对照官方参考图 product-design/assets/generated/liangdawang-plus-home-collaboration-field-v1.png
 */
import type { CSSProperties } from "react";
import type { Holo, HoloType } from "../../data/agents";

const O = "#ee7b1f"; // brand 橙：全息主色，呼应参考图
const C = "#22d3ee"; // tech 青：数据细节点缀
const FILL = "rgba(238,123,31,0.08)";

const panel = { fill: FILL, stroke: O, strokeWidth: 1.5 } as const;

/** 达小二：协作网络屏，对勾节点 + 流光连线 */
function CommandScreen({ className }: { className?: string }) {
  const nodes = [
    { x: 26, y: 30, d: "0s" },
    { x: 66, y: 20, d: "-0.6s" },
    { x: 56, y: 58, d: "-1.2s" },
    { x: 94, y: 58, d: "-1.8s" },
  ];
  return (
    <svg viewBox="0 0 120 90" className={className}>
      <rect x="4" y="4" width="112" height="82" rx="7" {...panel} />
      <g stroke={O} strokeWidth="1" strokeDasharray="4 5" opacity="0.7" className="ld-dash-flow">
        <line x1="26" y1="30" x2="66" y2="20" />
        <line x1="66" y1="20" x2="94" y2="58" />
        <line x1="26" y1="30" x2="56" y2="58" />
        <line x1="56" y1="58" x2="94" y2="58" />
      </g>
      {nodes.map((n) => (
        <g key={`${n.x}-${n.y}`} className="ld-blink" style={{ animationDelay: n.d }}>
          <circle cx={n.x} cy={n.y} r="8" fill="rgba(238,123,31,0.15)" stroke={O} strokeWidth="1.5" />
          <path
            d={`M${n.x - 3.5} ${n.y} l2.5 2.5 l5 -5`}
            fill="none"
            stroke={C}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
    </svg>
  );
}

/** 瞻小二：行情大屏，K 线蜡烛图 + 成交量柱 + 均线循环生长 */
function ChartScreen({ className }: { className?: string }) {
  // o/c/h/l 为 SVG y 坐标（值越小价越高），整体呈上行趋势
  const candles = [
    { x: 18, o: 58, c: 49, h: 45, l: 61, v: 6 },
    { x: 30, o: 53, c: 43, h: 40, l: 56, v: 9 },
    { x: 42, o: 45, c: 52, h: 42, l: 55, v: 5 },
    { x: 54, o: 51, c: 40, h: 37, l: 54, v: 8 },
    { x: 66, o: 43, c: 34, h: 31, l: 46, v: 6 },
    { x: 78, o: 38, c: 45, h: 34, l: 48, v: 4 },
    { x: 90, o: 39, c: 27, h: 24, l: 42, v: 9 },
    { x: 102, o: 29, c: 18, h: 15, l: 32, v: 12 },
  ];
  return (
    <svg viewBox="0 0 120 90" className={className}>
      <rect x="4" y="4" width="112" height="82" rx="7" {...panel} />
      <g stroke={O} strokeWidth="0.8" opacity="0.25">
        <line x1="12" y1="28" x2="108" y2="28" />
        <line x1="12" y1="44" x2="108" y2="44" />
        <line x1="12" y1="60" x2="108" y2="60" />
      </g>
      {/* 成交量柱 */}
      {candles.map((k) => (
        <rect key={`v${k.x}`} x={k.x - 3.5} y={78 - k.v} width="7" height={k.v} fill={O} opacity="0.3" />
      ))}
      {/* 蜡烛：阳线实心橙，阴线空心 */}
      {candles.map((k) => {
        const up = k.c < k.o;
        return (
          <g key={k.x} stroke={O} strokeWidth="1.2">
            <line x1={k.x} y1={k.h} x2={k.x} y2={k.l} />
            <rect
              x={k.x - 3.5} y={Math.min(k.o, k.c)} width="7" height={Math.abs(k.o - k.c)}
              fill={up ? O : "none"} fillOpacity="0.85"
            />
          </g>
        );
      })}
    </svg>
  );
}

/** 粮小二：粮源质检扫描屏，麦穗靶框扫描 + 水分/容重/杂质指标（呼应「对比供应方质检报告」） */
function GrainScreen({ className }: { className?: string }) {
  const metrics = [
    { y: 22, label: "水分", value: "14.2%", w: 30, d: "0s" },
    { y: 38, label: "容重", value: "718", w: 40, d: "-0.7s" },
    { y: 54, label: "杂质", value: "0.8%", w: 18, d: "-1.4s" },
  ];
  return (
    <svg viewBox="0 0 140 90" className={className}>
      <defs>
        <clipPath id="ld-grain-clip">
          <circle cx="34" cy="45" r="20" />
        </clipPath>
      </defs>
      <rect x="4" y="4" width="132" height="82" rx="7" {...panel} />
      {/* 扫描靶框：四角括线 + 流动虚线环 */}
      <g stroke={O} strokeWidth="1.4" fill="none" strokeLinecap="round">
        <path d="M16 27 v-4 a4 4 0 0 1 4 -4 h4" />
        <path d="M44 19 h4 a4 4 0 0 1 4 4 v4" />
        <path d="M52 63 v4 a4 4 0 0 1 -4 4 h-4" />
        <path d="M24 71 h-4 a4 4 0 0 1 -4 -4 v-4" />
      </g>
      <circle
        cx="34" cy="45" r="20" fill="none" stroke={O} strokeWidth="1.2"
        strokeDasharray="6 8" opacity="0.7" className="ld-dash-flow"
        style={{ "--dash-shift": "-28px" } as CSSProperties}
      />
      {/* 麦穗 */}
      <g stroke={O} strokeWidth="1.6" fill="none" strokeLinecap="round">
        <line x1="34" y1="56" x2="34" y2="36" />
        <path d="M34 40 l-5 -3.5 M34 40 l5 -3.5 M34 46 l-5 -3.5 M34 46 l5 -3.5 M34 52 l-5 -3.5 M34 52 l5 -3.5" />
      </g>
      <g clipPath="url(#ld-grain-clip)">
        <rect
          x="14" y="22" width="40" height="4" fill={C} opacity="0.35"
          className="ld-scan-y" style={{ "--scan-dist": "46px" } as CSSProperties}
        />
      </g>
      {/* 质检指标：标签 + 条 + 数值 */}
      {metrics.map((m) => (
        <g key={m.y} className="ld-blink" style={{ animationDelay: m.d }}>
          <text x="66" y={m.y + 4.5} fontSize="6.5" fill={O} opacity="0.85">
            {m.label}
          </text>
          <rect x="84" y={m.y} width="34" height="5" rx="2.5" fill="none" stroke={O} strokeWidth="0.8" opacity="0.4" />
          <rect x="84" y={m.y} width={m.w} height="5" rx="2.5" fill={O} />
          <text x="122" y={m.y + 4.5} fontSize="6.5" fill={C}>
            {m.value}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** 运小二：路线屏，光点沿运输路线循环跑动 */
function RouteScreen({ className }: { className?: string }) {
  const route = "M14 62 L42 62 L42 34 L76 34 L76 52 L104 52";
  return (
    <svg viewBox="0 0 120 90" className={className}>
      <rect x="4" y="4" width="112" height="82" rx="7" {...panel} />
      <path d={route} fill="none" stroke={O} strokeWidth="1.4" strokeDasharray="4 5" opacity="0.8" />
      <circle cx="14" cy="62" r="4" fill="none" stroke={O} strokeWidth="1.6" />
      <circle cx="104" cy="52" r="4" fill={O} className="ld-blink" />
      <circle r="3" fill={C}>
        <animateMotion dur="3.2s" repeatCount="indefinite" path={route} />
      </circle>
    </svg>
  );
}

/** 算小二：环绕能量环 + 两侧悬浮数字碎片（环绕角色，渲染在角色身后） */
function RingsField() {
  return (
    <>
      <svg viewBox="0 0 200 60" className="absolute bottom-[2%] left-1/2 w-full -translate-x-1/2">
        <ellipse
          cx="100" cy="30" rx="86" ry="20" fill="none" stroke={O} strokeWidth="1.4"
          strokeDasharray="7 9" opacity="0.8" className="ld-dash-flow"
          style={{ "--dash-shift": "-32px" } as CSSProperties}
        />
        <ellipse
          cx="100" cy="30" rx="60" ry="13" fill="none" stroke={C} strokeWidth="1"
          strokeDasharray="4 8" opacity="0.5" className="ld-dash-flow"
          style={{ "--dash-shift": "-24px", animationDuration: "4.2s" } as CSSProperties}
        />
      </svg>
      <span className="ld-blink absolute right-[4%] top-[22%] rounded border border-brand/60 bg-[#0a1428]/70 px-1.5 py-0.5 font-mono text-[10px] text-brand-deep shadow-[0_0_12px_rgba(238,123,31,0.3)]">
        18%
      </span>
      <span
        className="ld-blink absolute left-[2%] top-[46%] rounded border border-brand/60 bg-[#0a1428]/70 px-1.5 py-0.5 font-mono text-[10px] text-brand-deep shadow-[0_0_12px_rgba(238,123,31,0.3)]"
        style={{ animationDelay: "-1.3s" }}
      >
        60%
      </span>
    </>
  );
}

/** 钱小二：资金仪表盘，双层旋转资金环 + 三家机构授信对比（呼应「比对 3 家机构授信方案」） */
function FundScreen({ className }: { className?: string }) {
  const offers = [
    { y: 22, w: 34, pct: "4.2%", d: "0s" },
    { y: 38, w: 25, pct: "3.8%", d: "-0.7s" },
    { y: 54, w: 43, pct: "4.9%", d: "-1.4s" },
  ];
  return (
    <svg viewBox="0 0 140 90" className={className}>
      <defs>
        <clipPath id="ld-fund-clip">
          <rect x="4" y="4" width="132" height="82" rx="7" />
        </clipPath>
      </defs>
      <rect x="4" y="4" width="132" height="82" rx="7" {...panel} />
      {/* 双层资金环：外环橙、内环青，反向流速 */}
      <circle
        cx="34" cy="45" r="20" fill="none" stroke={O} strokeWidth="2.5"
        strokeDasharray="26 14" className="ld-dash-flow" opacity="0.9"
        style={{ "--dash-shift": "-80px" } as CSSProperties}
      />
      <circle
        cx="34" cy="45" r="13" fill="none" stroke={C} strokeWidth="1.2"
        strokeDasharray="8 8" className="ld-dash-flow" opacity="0.6"
        style={{ "--dash-shift": "-32px", animationDuration: "3.6s" } as CSSProperties}
      />
      <text x="34" y="50" textAnchor="middle" fontSize="12" fill={O}>
        ¥
      </text>
      {/* 授信方案对比条：轨道 + 实条 + 利率标签 */}
      {offers.map((o) => (
        <g key={o.y} className="ld-blink" style={{ animationDelay: o.d }}>
          <rect x="66" y={o.y} width="44" height="5" rx="2.5" fill="none" stroke={O} strokeWidth="0.8" opacity="0.4" />
          <rect x="66" y={o.y} width={o.w} height="5" rx="2.5" fill={O} />
          <text x="114" y={o.y + 4.5} fontSize="6.5" fill={C}>
            {o.pct}
          </text>
        </g>
      ))}
      <g clipPath="url(#ld-fund-clip)">
        <rect x="0" y="0" width="18" height="90" fill="rgba(255,255,255,0.16)" className="ld-sweep" />
      </g>
    </svg>
  );
}

/** 安小二：盾牌全息牌，对勾脉冲 + 扫描线掠过 */
function ShieldBadge({ className }: { className?: string }) {
  const shield = "M40 6 L68 16 V44 C68 64 54 76 40 82 C26 76 12 64 12 44 V16 Z";
  return (
    <svg viewBox="0 0 80 90" className={className}>
      <defs>
        <clipPath id="ld-shield-clip">
          <path d={shield} />
        </clipPath>
      </defs>
      <path d={shield} fill={FILL} stroke={O} strokeWidth="1.8" />
      <path
        d="M28 44 L37 53 L54 32"
        fill="none" stroke={O} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        className="ld-blink"
      />
      <g clipPath="url(#ld-shield-clip)">
        <rect
          x="4" y="2" width="72" height="6" fill={C} opacity="0.3"
          className="ld-scan-y" style={{ "--scan-dist": "76px" } as CSSProperties}
        />
      </g>
    </svg>
  );
}

const screens: Record<Exclude<HoloType, "rings">, (p: { className?: string }) => React.ReactNode> = {
  command: CommandScreen,
  chart: ChartScreen,
  grain: GrainScreen,
  route: RouteScreen,
  fund: FundScreen,
  shield: ShieldBadge,
};

/** 道具宽度（相对角色宽度百分比），不超过角色体量以免抢主体 */
const widthByType: Record<Exclude<HoloType, "rings">, string> = {
  command: "w-[95%]",
  chart: "w-[120%]",
  grain: "w-[105%]",
  route: "w-[105%]",
  fund: "w-[118%]",
  shield: "w-[88%]",
};

export default function HoloProp({ holo, delay = 0 }: { holo?: Holo; delay?: number }) {
  if (!holo) return null;

  // 环绕型：渲染在角色身后（-z-10），忽略 side/offsetY
  if (holo.type === "rings") {
    return (
      <div
        aria-hidden
        className="ld-holo-breathe pointer-events-none absolute -inset-x-[45%] inset-y-[-3%] -z-10"
        style={{ animationDelay: `${delay}s` }}
      >
        <RingsField />
      </div>
    );
  }

  const Screen = screens[holo.type];
  // 3D 透视：角度按角色单独配置（agents.ts holo.tilt），缺省按侧别给默认值
  const tiltY = holo.tilt?.y ?? (holo.side === "left" ? -16 : 16);
  const tiltX = holo.tilt?.x ?? 3;
  const tiltZ = holo.tilt?.z ?? 0;
  const tilt = `perspective(600px) rotateY(${tiltY}deg) rotateX(${tiltX}deg) rotateZ(${tiltZ}deg)`;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute z-10 ${widthByType[holo.type]}`}
      style={{
        top: `${holo.offsetY}%`,
        transform: tilt,
        transformOrigin: holo.side === "left" ? "right center" : "left center",
        ...(holo.side === "left" ? { right: `${holo.gap ?? 58}%` } : { left: `${holo.gap ?? 58}%` }),
      }}
    >
      <div className="ld-holo-breathe" style={{ animationDelay: `${delay}s` }}>
        <Screen className="h-auto w-full drop-shadow-[0_0_12px_rgba(238,123,31,0.4)]" />
      </div>
    </div>
  );
}
