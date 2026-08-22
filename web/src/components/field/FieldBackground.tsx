/**
 * 粮贸协作场背景（纯代码绘制，不嵌入官方素材图标）
 * 地面：深空底 + 数据青菱形格纹与能量光斑
 * 节点：网页原生业务节点信标，站位与 data/agents.ts 中 pos 对齐：
 *       达(50,60) 瞻(30,33) 粮(70,33) 运(88,60) 算(62,90) 钱(20,88) 安(14,60)
 */

type Node = { label: string; left: number; top: number; tone: "orange" | "cyan" };

/** 网页原生业务节点：承担场景定位，不伪装成真实业务看板。 */
const nodes: Node[] = [
  { label: "交易协同", left: 14, top: 14, tone: "cyan" },
  { label: "行情资讯", left: 22, top: 22, tone: "cyan" },
  { label: "金融服务", left: 8, top: 76, tone: "orange" },
  { label: "成本测算", left: 76, top: 80, tone: "orange" },
  { label: "物流调度", left: 84, top: 70, tone: "cyan" },
];

function NodeBeacon({ node }: { node: Node }) {
  const color = node.tone === "orange" ? "#ee7b1f" : "#22d3ee";
  return (
    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${node.left}%`, top: `${node.top}%` }}>
      <div className="relative flex h-12 w-24 items-center justify-center [transform:perspective(220px)_rotateX(57deg)]">
        <span className="absolute h-11 w-20 rounded-[50%] border" style={{ borderColor: `${color}55`, boxShadow: `0 0 22px ${color}24` }} />
        <span className="absolute h-6 w-11 rounded-[50%] border border-dashed opacity-75" style={{ borderColor: color }} />
        <span className="h-1.5 w-1.5 rounded-full shadow-[0_0_10px_currentColor]" style={{ color, backgroundColor: color }} />
      </div>
      <span className="absolute left-1/2 top-[61%] -translate-x-1/2 whitespace-nowrap font-mono text-[8px] tracking-[0.22em] text-slate-400/70">
        {node.label}
      </span>
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
            "radial-gradient(ellipse at 50% 62%, rgba(238,123,31,0.16), transparent 27%)," +
            "radial-gradient(ellipse at 50% 24%, rgba(34,211,238,0.09), transparent 34%)," +
            "repeating-linear-gradient(45deg, rgba(34,211,238,0.055) 0 1px, transparent 1px 28px)," +
            "repeating-linear-gradient(-45deg, rgba(34,211,238,0.04) 0 1px, transparent 1px 28px)",
        }}
      />

      {/* 远景数据轨道：不承载文字和数值，只建立科技空间感 */}
      <div className="pointer-events-none absolute left-1/2 top-[8%] h-[42%] w-[62%] -translate-x-1/2 rounded-[50%] border border-tech/10 [transform:translateX(-50%)_rotateX(62deg)]" />
      <div className="pointer-events-none absolute left-1/2 top-[13%] h-[31%] w-[46%] -translate-x-1/2 rounded-[50%] border border-brand/15 [transform:translateX(-50%)_rotateX(62deg)]" />

      {nodes.map((node) => (
        <NodeBeacon key={node.label} node={node} />
      ))}

      {/* 暗角最后覆盖，让视线收束到场景中心 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(112%_92%_at_50%_48%,transparent_42%,rgba(2,6,16,0.7)_100%)]" />
    </div>
  );
}
