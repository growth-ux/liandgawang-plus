/**
 * 首页全息道具：每个小二「正在操作」的橙色全息屏（纯 SVG + CSS 动画装饰层）
 * 造型对照官方参考图 product-design/assets/generated/liangdawang-plus-home-collaboration-field-v1.png
 */
import type { CSSProperties } from "react";
import type { Holo, HoloType } from "../../data/agents";

const O = "#ee7b1f"; // brand 橙：全息主色，呼应参考图
const C = "#22d3ee"; // tech 青：数据细节点缀
const G = "#f7b32b"; // 稻谷金：粮小二稻穗全息专用
const FILL = "rgba(238,123,31,0.08)";

const panel = { fill: FILL, stroke: O, strokeWidth: 1.5 } as const;

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

/** 粮小二：等距稻田全息，4×4 麦株阵列 + 优选地块质检扫描（呼应官方资产 wheat.14a88246.png 与「找粮源」职责） */
function GrainScreen({ className }: { className?: string }) {
  // 等距映射 P(u,v) = (70+(u-v)*15, 40+(u+v)*7.5)，麦株落在格心；hot 为优选地块
  const stalks: { x: number; y: number; s: number; hot?: boolean }[] = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      stalks.push({
        x: 70 + (i - j) * 15,
        y: 40 + (i + j + 1) * 7.5,
        s: 0.8 + (i + j) * 0.055, // 前排略大，制造纵深
        hot: i === 2 && j === 1,
      });
    }
  }
  stalks.sort((a, b) => a.y - b.y); // 由后往前画，保证前排遮挡正确
  const LEAF = "#a8b054"; // 麦叶橄榄绿，呼应官方资产
  const hot = stalks.find((t) => t.hot)!;
  return (
    <svg viewBox="0 0 140 110" className={className}>
      <defs>
        {/* 单株麦：橄榄绿叶 + 金色茎粒，原点在株底 */}
        <g id="ld-wheat">
          <path d="M0 0 C-3.4 -1.6 -5.4 -4.4 -6.2 -8.2" fill="none" stroke={LEAF} strokeWidth="1.1" strokeLinecap="round" />
          <path d="M0 0 C3.4 -1.6 5.4 -4.4 6.2 -8.2" fill="none" stroke={LEAF} strokeWidth="1.1" strokeLinecap="round" />
          <line x1="0" y1="0" x2="0" y2="-12" stroke={G} strokeWidth="1.1" strokeLinecap="round" />
          <ellipse cx="-2.4" cy="-8.4" rx="1.5" ry="2.6" fill={G} transform="rotate(26 -2.4 -8.4)" />
          <ellipse cx="2.4" cy="-10.4" rx="1.5" ry="2.6" fill={G} transform="rotate(-26 2.4 -10.4)" />
          <ellipse cx="-2.2" cy="-12.4" rx="1.4" ry="2.4" fill={G} transform="rotate(24 -2.2 -12.4)" />
          <ellipse cx="2.2" cy="-14.2" rx="1.4" ry="2.4" fill={G} transform="rotate(-24 2.2 -14.2)" />
          <ellipse cx="0" cy="-16.6" rx="1.4" ry="2.5" fill={G} />
        </g>
      </defs>
      {/* 等距田块：半透明全息地面 + 等距网格线 */}
      <path d="M70 40 L130 70 L70 100 L10 70 Z" fill="rgba(238,123,31,0.07)" stroke={O} strokeWidth="1.3" strokeLinejoin="round" />
      <g stroke={O} strokeWidth="0.6" opacity="0.16">
        {[1, 2, 3].map((k) => (
          <g key={k}>
            <line x1={70 + k * 15} y1={40 + k * 7.5} x2={70 + k * 15 - 60} y2={40 + k * 7.5 + 30} />
            <line x1={70 - k * 15} y1={40 + k * 7.5} x2={70 - k * 15 + 60} y2={40 + k * 7.5 + 30} />
          </g>
        ))}
      </g>
      {/* 优选地块扫描环 */}
      <ellipse
        cx={hot.x} cy={hot.y} rx="10" ry="4.6" fill="none" stroke={C} strokeWidth="1"
        strokeDasharray="4 5" className="ld-dash-flow"
        style={{ "--dash-shift": "-18px" } as CSSProperties}
      />
      {/* 麦株阵列 */}
      {stalks.map((t, idx) => (
        <use
          key={idx} href="#ld-wheat"
          transform={`translate(${t.x} ${t.y}) scale(${t.s})`}
          opacity={Math.min(1, 0.6 + t.s * 0.4)}
        />
      ))}
      {/* 上升谷粒光点 */}
      <ellipse cx="52" rx="1.3" ry="2.2" fill={G} opacity="0">
        <animate attributeName="cy" values="84;44" dur="3.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.8;0" dur="3.8s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="96" rx="1.3" ry="2.2" fill={G} opacity="0">
        <animate attributeName="cy" values="78;40" dur="4.4s" begin="-2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.8;0" dur="4.4s" begin="-2s" repeatCount="indefinite" />
      </ellipse>
    </svg>
  );
}

/** 运小二：路线投影玻璃屏，竖版玻璃屏内只保留两条不同路线（粗线推荐/细线备选）+ 目的地标识（呼应「规划 2 条运输路线」） */
function RouteScreen({ className }: { className?: string }) {
  // 两条路线汇聚于目的地标识尖端 (45,50)：A 左线简单直达、被选中为推荐；B 右线绕弯复杂、作为备选
  const routeA = "M30 100 C 27 91 29 83 33 76 C 37 69 42 60 45 50";
  const routeB = "M62 100 C 72 95 52 92 58 85 C 63 79 72 80 69 73 C 66 66 52 68 55 61 C 57 56 50 55 45 50";
  return (
    <svg viewBox="0 0 90 120" className={className}>
      <defs>
        <filter id="ld-route-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      {/* 竖版玻璃面板，与其它全息屏同款 */}
      <rect x="4" y="4" width="82" height="112" rx="8" {...panel} />
      <rect x="6.5" y="6.5" width="77" height="107" rx="6" fill="none" stroke={O} strokeWidth="0.8" opacity="0.18" />
      {/* 中部暖橙浸润光晕 */}
      <ellipse cx="45" cy="64" rx="24" ry="27" fill="rgba(238,123,31,0.18)" filter="url(#ld-route-blur)" />
      {/* 目的地标识：呼吸光环 + 描边定位 pin */}
      <circle cx="45" cy="34" r="12" fill="none" stroke={O} strokeWidth="0.9" opacity="0.5" className="ld-blink" />
      <path
        d="M45 24 c-5.8 0 -9.6 4.2 -9.6 9.3 c0 6.9 9.6 16.7 9.6 16.7 c0 0 9.6 -9.8 9.6 -16.7 c0 -5.1 -3.8 -9.3 -9.6 -9.3 z"
        fill={O} stroke="#ffd9ae" strokeWidth="1.2" strokeLinejoin="round"
      />
      <circle cx="45" cy="33" r="3.4" fill="#0b1220" />
      {/* 路线 B 备选（绕弯复杂）：细实线 + 慢行光点 */}
      <path d={routeB} fill="none" stroke={O} strokeWidth="1.4" opacity="0.55" strokeLinecap="round" />
      <circle r="1.5" fill={O} opacity="0.6">
        <animateMotion dur="6s" repeatCount="indefinite" path={routeB} />
      </circle>
      {/* 路线 A 推荐（简单直达）：柔光层 → 半透底层 → 高亮芯线 */}
      <path d={routeA} fill="none" stroke={O} strokeWidth="6" opacity="0.25" strokeLinecap="round" filter="url(#ld-route-blur)" />
      <path d={routeA} fill="none" stroke={O} strokeWidth="3" opacity="0.45" strokeLinecap="round" />
      <path d={routeA} fill="none" stroke="#f59e0b" strokeWidth="1.8" opacity="0.95" strokeLinecap="round" />
      {/* 沿推荐路线巡游的青色流光段 */}
      <path
        d={routeA} fill="none" stroke={C} strokeWidth="2" strokeLinecap="round"
        strokeDasharray="8 40" opacity="0.95" className="ld-dash-flow"
        style={{ "--dash-shift": "-48px", animationDuration: "2.8s" } as CSSProperties}
      />
      {/* 起点：A 实心脉冲、B 空心点 */}
      <circle cx="30" cy="100" r="4.6" fill="none" stroke={O} strokeWidth="0.9" opacity="0.5" className="ld-blink" style={{ animationDelay: "-0.8s" } as CSSProperties} />
      <circle cx="30" cy="100" r="2.4" fill={O} />
      <circle cx="62" cy="100" r="2" fill="rgba(238,123,31,0.15)" stroke={O} strokeWidth="1" opacity="0.7" />
    </svg>
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

const screens: Record<Exclude<HoloType, "rings" | "chips">, (p: { className?: string }) => React.ReactNode> = {
  chart: ChartScreen,
  grain: GrainScreen,
  route: RouteScreen,
  fund: FundScreen,
  shield: ShieldBadge,
};

/** 道具宽度（相对角色宽度百分比），不超过角色体量以免抢主体 */
const widthByType: Record<Exclude<HoloType, "rings" | "chips">, string> = {
  chart: "w-[120%]",
  grain: "w-[168%]",
  route: "w-[103%]",
  fund: "w-[118%]",
  shield: "w-[88%]",
};

export default function HoloProp({ holo, delay = 0 }: { holo?: Holo; delay?: number }) {
  if (!holo) return null;

  // 碎片型：成本要素碎片环绕角色（算小二），渲染在角色身前避免被遮挡
  if (holo.type === "chips") {
    return (
      <div
        aria-hidden
        className="ld-holo-breathe pointer-events-none absolute -inset-x-[45%] inset-y-[-3%] z-10"
        style={{ animationDelay: `${delay}s` }}
      >
        {/* 方案对比小牌：A/B 到厂成本，A 为推荐方案 */}
        <div className="absolute left-0 top-[2%] rounded border border-brand/60 bg-[#0a1428]/70 px-2 py-1 font-mono text-[10px] leading-[1.6] shadow-[0_0_12px_rgba(238,123,31,0.3)]">
          <div className="text-brand-deep">
            方案A ¥2,354/吨 <span className="text-emerald-300">✓</span>
          </div>
          <div className="text-ink-soft opacity-55">方案B ¥2,412/吨</div>
        </div>
        <span className="ld-blink absolute right-[4%] top-[22%] rounded border border-brand/60 bg-[#0a1428]/70 px-1.5 py-0.5 font-mono text-[10px] text-brand-deep shadow-[0_0_12px_rgba(238,123,31,0.3)]">
          运费 ↑12%
        </span>
        <span
          className="ld-blink absolute left-[2%] top-[46%] rounded border border-brand/60 bg-[#0a1428]/70 px-1.5 py-0.5 font-mono text-[10px] text-brand-deep shadow-[0_0_12px_rgba(238,123,31,0.3)]"
          style={{ animationDelay: "-1.3s" }}
        >
          水杂 ↓6%
        </span>
        <span
          className="ld-blink absolute bottom-[16%] right-[12%] rounded border border-brand/60 bg-[#0a1428]/70 px-1.5 py-0.5 font-mono text-[10px] text-brand-deep shadow-[0_0_12px_rgba(238,123,31,0.3)]"
          style={{ animationDelay: "-2.2s" }}
        >
          到厂 ¥2,354/吨
        </span>
      </div>
    );
  }

  // 环绕型：角色脚下的双层能量环（外橙内青、反向流动），渲染在角色身后
  if (holo.type === "rings") {
    return (
      <div
        aria-hidden
        className="ld-holo-breathe pointer-events-none absolute -inset-x-[24%] bottom-[-9%] -z-10"
        style={{ animationDelay: `${delay}s` }}
      >
        <svg viewBox="0 0 200 60" className="w-full overflow-visible">
          <ellipse
            cx="100" cy="30" rx="86" ry="20" fill="rgba(238,123,31,0.035)" stroke={O} strokeWidth="1.4"
            strokeDasharray="7 9" opacity="0.8" className="ld-dash-flow"
            style={{ "--dash-shift": "-32px" } as CSSProperties}
          />
          <ellipse
            cx="100" cy="30" rx="60" ry="13" fill="none" stroke={C} strokeWidth="1"
            strokeDasharray="4 8" opacity="0.5" className="ld-dash-flow"
            style={{ "--dash-shift": "-24px", animationDuration: "4.2s" } as CSSProperties}
          />
        </svg>
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
