import { Link } from "react-router-dom";
import { agents, type Agent } from "../data/agents";
import AgentSprite from "../components/field/AgentSprite";
import FieldBackground from "../components/field/FieldBackground";
import HoloProp from "../components/field/HoloProp";

/** 单个数字员工：专属 IP 形象 + 循环动作 + 名称气泡（含当前在做什么） + 悬停高亮 */
function AgentActor({ agent, index }: { agent: Agent; index: number }) {
  const { x, y, size } = agent.pos;
  return (
    <Link
      to={`/agent/${agent.id}`}
      aria-label={`${agent.name}｜${agent.action}｜${agent.doing}`}
      className="group absolute -translate-x-1/2 -translate-y-full"
      style={{ left: `${x}%`, top: `${y}%`, height: `${size}%`, zIndex: Math.round(y) }}
    >
      {/* 地面投影与科技定位环固定于脚下，不随浮动动画移动 */}
      <span className="pointer-events-none absolute bottom-[-2%] left-1/2 h-[6%] w-[78%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.66),rgba(0,0,0,0)_70%)]" />
      <span className="pointer-events-none absolute bottom-[-0.5%] left-1/2 h-[5%] w-[62%] -translate-x-1/2 rounded-[50%] border border-tech/25 shadow-[0_0_16px_rgba(34,211,238,0.12)] transition-all duration-300 group-hover:border-brand/70 group-hover:shadow-[0_0_22px_rgba(238,123,31,0.36)]" />
      {/* 浮动 + 摇摆两层动画叠加，相位错开 */}
      <div className="ld-bob relative h-full" style={{ animationDelay: `${index * -0.6}s` }}>
        <div className="ld-sway h-full" style={{ animationDelay: `${index * -1.3}s` }}>
          {/* 镜像层独立于 sway/悬停缩放，避免 transform 互相覆盖 */}
          <div className="h-full" style={agent.flip ? { transform: "scaleX(-1)" } : undefined}>
            <AgentSprite
              src={agent.image}
              alt={`${agent.name}｜${agent.action}`}
              className="h-full w-auto object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-[1.06]"
            />
          </div>
        </div>
        {/* 全息道具：跟随浮动但不跟随摇摆，相位按角色错开 */}
        <HoloProp holo={agent.holo} delay={index * -0.9} />
        {/* 名称气泡：像场景标注而非功能卡；详情只在悬停时显现 */}
        <span className="absolute left-1/2 top-[-4%] flex -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5 whitespace-nowrap rounded-full border border-tech/20 bg-[#0a1428]/80 px-3 py-1.5 text-center shadow-[0_7px_20px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-all duration-300 group-hover:scale-105 group-hover:border-brand/70 group-hover:bg-[#101d37]/95 group-hover:shadow-[0_0_22px_rgba(238,123,31,0.25)]">
          <span className="text-xs font-semibold tracking-wide text-ink group-hover:text-brand-deep">
            {agent.name}｜{agent.action}
          </span>
          <span className="max-h-0 overflow-hidden text-[10px] leading-tight text-ink-soft opacity-0 transition-all duration-300 group-hover:max-h-8 group-hover:opacity-100">{agent.doing}</span>
        </span>
        {/* 悬停高亮轮廓 */}
        <span className="pointer-events-none absolute -inset-x-[14%] -inset-y-[3%] rounded-[36px] border-2 border-transparent transition-all duration-300 group-hover:border-brand/55 group-hover:bg-brand/5" />
      </div>
    </Link>
  );
}

/** 粮掌柜首页：官方素材协作场场景 + 七位各自专属形象的数字员工 */
export default function Home() {
  // 按站位从后往前渲染，保证前后遮挡关系正确
  const sorted = [...agents].sort((a, b) => a.pos.y - b.pos.y);

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-rice">
      {/* 16:9 舞台，宽屏下自动居中留白 */}
      <div className="absolute inset-0 m-auto aspect-video max-h-full max-w-full">
        <FieldBackground />
        {sorted.map((agent, i) => (
          <AgentActor key={agent.id} agent={agent} index={i} />
        ))}
      </div>
    </div>
  );
}
