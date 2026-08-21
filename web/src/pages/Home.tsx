import { Link } from "react-router-dom";
import { agents, type Agent } from "../data/agents";
import AgentSprite from "../components/field/AgentSprite";
import FieldBackground from "../components/field/FieldBackground";

/** 单个数字员工：官方 IP 形象 + 循环动作 + 名称气泡 + 悬停高亮 */
function AgentActor({ agent, index }: { agent: Agent; index: number }) {
  const { x, y, size } = agent.pos;
  return (
    <Link
      to={`/agent/${agent.id}`}
      aria-label={`${agent.name}｜${agent.action}`}
      className="group absolute -translate-x-1/2 -translate-y-full"
      style={{ left: `${x}%`, top: `${y}%`, height: `${size}%`, zIndex: Math.round(y) }}
    >
      {/* 浮动 + 摇摆两层动画叠加，相位错开 */}
      <div className="ld-bob relative h-full" style={{ animationDelay: `${index * -0.6}s` }}>
        <div className="ld-sway h-full" style={{ animationDelay: `${index * -1.3}s` }}>
          <AgentSprite
            alt={`${agent.name}｜${agent.action}`}
            className="h-full w-auto drop-shadow-[0_12px_16px_rgba(59,47,30,0.22)] transition-transform duration-300 group-hover:scale-[1.06]"
          />
        </div>
        {/* 名称气泡 */}
        <span className="absolute left-1/2 top-[-3%] flex -translate-x-1/2 -translate-y-full items-center whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-xs text-ink shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white group-hover:font-semibold group-hover:text-brand-deep group-hover:ring-2 group-hover:ring-brand/50">
          {agent.name}｜{agent.action}
        </span>
        {/* 悬停高亮轮廓 */}
        <span className="pointer-events-none absolute -inset-x-[14%] -inset-y-[3%] rounded-[36px] border-2 border-transparent transition-all duration-300 group-hover:border-brand/55 group-hover:bg-brand/5" />
      </div>
    </Link>
  );
}

/** 粮掌柜首页：代码绘制的协作场场景 + 七位可动的官方 IP 数字员工 */
export default function Home() {
  // 按站位从后往前渲染，保证前后遮挡关系正确
  const sorted = [...agents].sort((a, b) => a.pos.y - b.pos.y);

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#f8f1e2]">
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
