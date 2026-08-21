/**
 * 粮贸协作场背景场景（纯代码绘制，版式图仅作构图参考）
 * 站台坐标与 data/agents.ts 中 pos 一一对应（百分比 × 1600/900）：
 * 达(808,657) 瞻(800,243) 粮(1224,351) 运(1456,585) 算(800,846) 钱(344,738) 安(176,441)
 */
export default function FieldBackground() {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="ld-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdf9f0" />
          <stop offset="1" stopColor="#f6ecd6" />
        </linearGradient>
        <linearGradient id="ld-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8f0dd" />
          <stop offset="1" stopColor="#f1e4c6" />
        </linearGradient>
        <radialGradient id="ld-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ee7b1f" stopOpacity="0.13" />
          <stop offset="1" stopColor="#ee7b1f" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 天空底色与云 */}
      <rect width="1600" height="900" fill="url(#ld-sky)" />
      <g fill="#ffffff" opacity="0.6">
        <ellipse cx="240" cy="100" rx="72" ry="15" />
        <ellipse cx="304" cy="88" rx="44" ry="11" />
        <ellipse cx="1340" cy="82" rx="78" ry="14" />
        <ellipse cx="1272" cy="96" rx="42" ry="10" />
      </g>

      {/* 等距地面 */}
      <path d="M 800 80 L 1580 500 L 800 900 L 20 500 Z" fill="url(#ld-ground)" stroke="#eadfc4" strokeWidth="2" />
      <g stroke="#e7d9b8" strokeWidth="1" opacity="0.45">
        <path d="M 410 290 L 1190 690" />
        <path d="M 605 190 L 1385 590" />
        <path d="M 215 610 L 995 210" />
        <path d="M 410 710 L 1190 310" />
      </g>

      {/* 环形道路：连接六个外围节点，不穿过达小二 */}
      <path
        d="M 176 441 C 300 300, 560 235, 800 243 C 990 250, 1140 290, 1224 351 C 1320 400, 1420 480, 1456 585 C 1420 720, 1100 830, 800 846 C 600 856, 430 800, 344 738 C 240 690, 140 540, 176 441 Z"
        fill="none"
        stroke="#f3e7ca"
        strokeWidth="34"
        strokeLinecap="round"
      />
      <path
        d="M 176 441 C 300 300, 560 235, 800 243 C 990 250, 1140 290, 1224 351 C 1320 400, 1420 480, 1456 585 C 1420 720, 1100 830, 800 846 C 600 856, 430 800, 344 738 C 240 690, 140 540, 176 441 Z"
        fill="none"
        stroke="#e6d3a8"
        strokeWidth="2"
        strokeDasharray="10 16"
      />
      <g fill="#ee7b1f">
        <circle cx="540" cy="248" r="4" className="ld-pulse" />
        <circle cx="1330" cy="420" r="4" className="ld-pulse" style={{ animationDelay: "-0.8s" }} />
        <circle cx="1120" cy="822" r="4" className="ld-pulse" style={{ animationDelay: "-1.6s" }} />
        <circle cx="300" cy="700" r="4" className="ld-pulse" style={{ animationDelay: "-1.2s" }} />
      </g>

      {/* ===== 外围六个节点站台 ===== */}
      {[
        { x: 800, y: 243 }, // 瞻
        { x: 1224, y: 351 }, // 粮
        { x: 1456, y: 585 }, // 运
        { x: 800, y: 846 }, // 算
        { x: 344, y: 738 }, // 钱
        { x: 176, y: 441 }, // 安
      ].map((p, i) => (
        <g key={i}>
          <ellipse cx={p.x} cy={p.y} rx="92" ry="30" fill="#f2e5c5" stroke="#e5d3ab" strokeWidth="1.5" />
          <ellipse cx={p.x} cy={p.y - 3} rx="68" ry="20" fill="#f8efd6" />
        </g>
      ))}

      {/* 达小二中央业务台：双环站台 + 光晕 */}
      <ellipse cx="808" cy="657" rx="150" ry="48" fill="url(#ld-glow)" />
      <ellipse cx="808" cy="657" rx="118" ry="38" fill="#f3e6c6" stroke="#e6d3a8" strokeWidth="1.5" />
      <ellipse cx="808" cy="654" rx="84" ry="26" fill="#f9f0d9" />

      {/* ===== 产业节点装饰 ===== */}

      {/* 行情与资讯屏（瞻小二身后） */}
      <line x1="800" y1="192" x2="800" y2="232" stroke="#e0d2ac" strokeWidth="5" />
      <g className="ld-float" style={{ animationDelay: "-1s" }}>
        <rect x="660" y="102" width="280" height="88" rx="12" fill="#ffffff" opacity="0.94" stroke="#eee0c2" strokeWidth="1.5" />
        <g stroke="#f0e6cc" strokeWidth="1">
          <line x1="676" y1="130" x2="924" y2="130" />
          <line x1="676" y1="154" x2="924" y2="154" />
        </g>
        <polyline
          points="676,172 716,158 748,166 788,138 824,148 862,124 924,132"
          fill="none"
          stroke="#ee7b1f"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="6 6"
          className="ld-dash"
        />
        <circle cx="924" cy="132" r="4" fill="#ee7b1f" className="ld-pulse" />
      </g>

      {/* 粮仓与玉米田（粮小二附近） */}
      <g transform="translate(1320,206)">
        <rect x="0" y="26" width="36" height="72" rx="9" fill="#f7f0df" stroke="#e2d6ba" strokeWidth="1.5" />
        <ellipse cx="18" cy="26" rx="18" ry="8" fill="#efe4c8" stroke="#e2d6ba" strokeWidth="1.5" />
        <rect x="46" y="44" width="30" height="54" rx="8" fill="#f7f0df" stroke="#e2d6ba" strokeWidth="1.5" />
        <ellipse cx="61" cy="44" rx="15" ry="7" fill="#efe4c8" stroke="#e2d6ba" strokeWidth="1.5" />
      </g>
      <g stroke="#d9a441" strokeWidth="3" strokeLinecap="round" opacity="0.9">
        <line x1="1270" y1="416" x2="1270" y2="402" />
        <line x1="1292" y1="424" x2="1292" y2="410" />
        <line x1="1316" y1="416" x2="1316" y2="402" />
        <line x1="1340" y1="424" x2="1340" y2="410" />
        <line x1="1364" y1="416" x2="1364" y2="402" />
      </g>

      {/* 货车与仓库（运小二附近） */}
      <g transform="translate(1296,600)">
        <rect x="0" y="16" width="58" height="28" rx="6" fill="#ee7b1f" />
        <path d="M 10 16 L 34 16 L 28 4 L 16 4 Z" fill="#f6a45c" />
        <rect x="58" y="24" width="24" height="20" rx="5" fill="#f6a45c" />
        <rect x="64" y="28" width="12" height="8" rx="2" fill="#fff7ea" />
        <circle cx="16" cy="46" r="7" fill="#3a342c" />
        <circle cx="44" cy="46" r="7" fill="#3a342c" />
        <circle cx="72" cy="46" r="7" fill="#3a342c" />
      </g>
      <g transform="translate(1500,470)">
        <polygon points="0,26 30,12 60,26 30,40" fill="#f3e7ca" stroke="#e5d3ab" strokeWidth="1" />
        <polygon points="0,26 30,40 30,66 0,52" fill="#e9dabb" />
        <polygon points="60,26 30,40 30,66 60,52" fill="#efe2c2" />
      </g>

      {/* 银行（钱小二附近） */}
      <g transform="translate(150,596)">
        <rect x="0" y="28" width="92" height="52" rx="3" fill="#f7f0df" stroke="#e2d6ba" strokeWidth="1.5" />
        <polygon points="-8,28 46,2 100,28" fill="#ee7b1f" opacity="0.9" />
        <g fill="#e9dabb">
          <rect x="10" y="36" width="9" height="38" rx="2" />
          <rect x="30" y="36" width="9" height="38" rx="2" />
          <rect x="53" y="36" width="9" height="38" rx="2" />
          <rect x="73" y="36" width="9" height="38" rx="2" />
        </g>
        <text x="46" y="22" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff7ea">
          ¥
        </text>
      </g>

      {/* 盾牌与农田（安小二附近） */}
      <g transform="translate(74,336)" className="ld-float" style={{ animationDelay: "-2.4s" }}>
        <path
          d="M 24 0 L 46 9 V 28 Q 46 48 24 56 Q 2 48 2 28 V 9 Z"
          fill="#ffffff"
          stroke="#4b8f8c"
          strokeWidth="3"
          strokeLinejoin="round"
          opacity="0.95"
        />
        <path d="M 14 26 L 22 34 L 35 17" fill="none" stroke="#4b8f8c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(48,486)">
        <polygon points="0,22 56,0 112,22 56,44" fill="#cfe3b8" stroke="#b8d29a" strokeWidth="1.5" />
        <g stroke="#9dbb7c" strokeWidth="2.5" strokeLinecap="round">
          <line x1="34" y1="26" x2="52" y2="19" />
          <line x1="50" y1="32" x2="68" y2="25" />
          <line x1="66" y1="38" x2="84" y2="31" />
        </g>
      </g>

      {/* 测算台图表（算小二附近） */}
      <g transform="translate(930,742)" className="ld-float" style={{ animationDelay: "-2s" }}>
        <rect x="0" y="0" width="104" height="64" rx="10" fill="#ffffff" opacity="0.94" stroke="#eee0c2" strokeWidth="1.5" />
        <rect x="14" y="34" width="14" height="18" rx="3" fill="#c9bdea" className="ld-pulse" />
        <rect x="36" y="24" width="14" height="28" rx="3" fill="#a996dd" className="ld-pulse" style={{ animationDelay: "-0.7s" }} />
        <rect x="58" y="14" width="14" height="38" rx="3" fill="#7a6bc0" className="ld-pulse" style={{ animationDelay: "-1.4s" }} />
        <text x="86" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill="#7a6bc0">
          ¥
        </text>
      </g>

      {/* 达小二旁：业务伙伴与指挥屏 */}
      <g transform="translate(688,586)">
        <circle cx="16" cy="10" r="9" fill="#8a7d6a" />
        <path d="M 4 24 Q 16 18 28 24 L 30 52 Q 16 58 2 52 Z" fill="#6e6252" />
        <rect x="6" y="52" width="8" height="22" rx="3.5" fill="#5c5142" />
        <rect x="18" y="52" width="8" height="22" rx="3.5" fill="#5c5142" />
        <path d="M 28 30 Q 42 26 48 18" fill="none" stroke="#6e6252" strokeWidth="6" strokeLinecap="round" />
      </g>
      <g className="ld-float" style={{ animationDelay: "-3s" }}>
        <g transform="translate(888,540)">
          <rect width="120" height="78" rx="10" fill="#ffffff" opacity="0.85" stroke="#eee0c2" strokeWidth="1.5" />
          <circle cx="24" cy="22" r="7" fill="#ee7b1f" opacity="0.9" />
          <circle cx="60" cy="50" r="7" fill="#f2a55c" />
          <circle cx="96" cy="22" r="7" fill="#f6c48d" />
          <path d="M 30 26 L 54 46 M 66 46 L 90 26" stroke="#e0d2ac" strokeWidth="2" fill="none" />
        </g>
      </g>

      {/* 点缀树木 */}
      {[
        { x: 495, y: 320, s: 1 },
        { x: 1064, y: 560, s: 0.9 },
        { x: 596, y: 760, s: 1.05 },
        { x: 1440, y: 300, s: 0.85 },
        { x: 360, y: 540, s: 0.8 },
        { x: 1180, y: 720, s: 0.9 },
      ].map((t, i) => (
        <g key={i} transform={`translate(${t.x},${t.y}) scale(${t.s})`}>
          <rect x="-3" y="8" width="6" height="14" rx="2.5" fill="#b08a5a" />
          <circle cx="0" cy="0" r="15" fill="#b7cf94" />
          <circle cx="9" cy="5" r="10" fill="#9db97a" />
        </g>
      ))}
    </svg>
  );
}
