import { agents } from "../../data/agents";

/**
 * 粮贸协作场背景（纯代码绘制，不嵌入官方素材图标）
 * 地面：深空底 + 数据青菱形格纹与能量光斑
 * 节点：网页原生业务节点信标，位置直接跟随 data/agents.ts 中的小二脚底坐标。
 */

type Node = { id: string; left: number; top: number };

/** 六位小二共用脚底信标；粮掌柜保留自己的中央能量环。 */
const nodes: Node[] = agents
  .filter((agent) => agent.id !== "da")
  .map((agent) => ({ id: agent.id, left: agent.pos.x, top: agent.pos.y }));

function NodeBeacon({ node }: { node: Node }) {
  const color = "#22d3ee";
  return (
    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${node.left}%`, top: `${node.top}%` }}>
      <div className="relative flex h-12 w-24 items-center justify-center [transform:perspective(220px)_rotateX(57deg)]">
        <span className="absolute h-12 w-24 rounded-[50%] border" style={{ borderColor: `${color}4d`, boxShadow: `0 0 20px ${color}1f` }} />
        <span className="absolute h-7 w-14 rounded-[50%] border border-dashed opacity-75" style={{ borderColor: color }} />
        <span className="h-1.5 w-1.5 rounded-full shadow-[0_0_10px_currentColor]" style={{ color, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function FieldBackground() {
  return (
    <div className="absolute inset-0" aria-hidden>
      {/* 深空数字孪生地面：冷色压低，橙色能量只留给业务主链 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "#07101f",
          backgroundImage:
            "radial-gradient(ellipse at 50% 58%, rgba(238,123,31,0.16), transparent 27%)," +
            "radial-gradient(ellipse at 50% 24%, rgba(34,211,238,0.09), transparent 34%)," +
            "repeating-linear-gradient(45deg, rgba(34,211,238,0.055) 0 1px, transparent 1px 28px)," +
            "repeating-linear-gradient(-45deg, rgba(34,211,238,0.04) 0 1px, transparent 1px 28px)",
        }}
      />

      {nodes.map((node) => (
        <NodeBeacon key={node.id} node={node} />
      ))}

      {/* 暗角最后覆盖，让视线收束到场景中心 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(112%_92%_at_50%_48%,transparent_42%,rgba(2,6,16,0.7)_100%)]" />
    </div>
  );
}
