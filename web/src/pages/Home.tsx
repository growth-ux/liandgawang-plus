import { useState } from "react";
import { Link } from "react-router-dom";
import { agents, type Agent } from "../data/agents";

/** 单个小二热区：透明命中区 + 名称气泡 + 悬停高亮 */
function AgentHotspot({ agent }: { agent: Agent }) {
  const [hover, setHover] = useState(false);
  const { x, y, w, h } = agent.hotspot;

  return (
    <Link
      to={`/agent/${agent.id}`}
      aria-label={`${agent.name}｜${agent.action}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group absolute block"
      style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
    >
      {/* 悬停高亮轮廓 */}
      <span
        className={`absolute inset-1 rounded-[28px] transition-all duration-300 ${
          hover ? "border-2 border-brand/60 bg-brand/10" : "border-2 border-transparent"
        }`}
      />
      {/* 名称气泡 */}
      <span
        className={`absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-1/3 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs shadow-sm transition-all duration-300 ${
          hover
            ? "scale-110 bg-white font-semibold text-brand-deep ring-2 ring-brand/50"
            : "bg-white/85 text-ink"
        }`}
      >
        {agent.name}｜{agent.action}
      </span>
    </Link>
  );
}

/** 粮掌柜首页：全宽粮贸协作场主视觉 + 七位小二热区 */
export default function Home() {
  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-rice">
      <img
        src="/images/home-field.png"
        alt="粮贸协作场：七位 AI 小二分布在粮贸业务场景中"
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      {/* 七位小二热区（达小二居中，外围顺时针：瞻、粮、运、算、钱、安） */}
      {agents.map((agent) => (
        <AgentHotspot key={agent.id} agent={agent} />
      ))}

      {/* 底部品牌注脚，不占用内容模块 */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/70 px-4 py-1 text-xs tracking-wide text-ink-soft backdrop-blur">
        用户不用先找功能，只需要叫小二；小二不用全部上场，只按需要入席
      </div>
    </div>
  );
}
