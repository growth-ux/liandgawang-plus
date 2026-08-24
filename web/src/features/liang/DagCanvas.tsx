// web/src/features/liang/DagCanvas.tsx
import type { DagNodeId, NodeStatus } from "./workflow";

const W = 92;
const H = 44;

const NODE_POS: Record<DagNodeId, { x: number; y: number }> = {
  parse: { x: 14, y: 68 },
  load: { x: 144, y: 68 },
  filter: { x: 274, y: 68 },
  sort: { x: 414, y: 24 },
  eliminate: { x: 414, y: 112 },
  review: { x: 554, y: 24 },
  pick: { x: 694, y: 24 },
  verify: { x: 834, y: 68 },
  save: { x: 974, y: 68 },
};

const EDGES: { from: DagNodeId; to: DagNodeId }[] = [
  { from: "parse", to: "load" },
  { from: "load", to: "filter" },
  { from: "filter", to: "sort" },
  { from: "filter", to: "eliminate" },
  { from: "sort", to: "review" },
  { from: "review", to: "pick" },
  { from: "pick", to: "verify" },
  { from: "eliminate", to: "verify" },
  { from: "verify", to: "save" },
];

const NODE_LABEL: Record<DagNodeId, string> = {
  parse: "理解需求",
  load: "读取粮源",
  filter: "硬条件过滤",
  sort: "排序比较",
  eliminate: "淘汰归因",
  review: "AI 比选决策",
  pick: "主推/备选",
  verify: "待核验清单",
  save: "沉淀任务",
};

function edgePath(from: DagNodeId, to: DagNodeId): string {
  const a = NODE_POS[from];
  const b = NODE_POS[to];
  const x1 = a.x + W;
  const y1 = a.y + H / 2;
  const x2 = b.x;
  const y2 = b.y + H / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function nodeClass(st: NodeStatus): string {
  switch (st) {
    case "running":
      return "border-brand bg-brand-faint text-brand-deep animate-pulse";
    case "done":
      return "border-brand bg-brand text-white";
    case "skipped":
      return "border-line/50 bg-panel/40 text-ink-soft/60";
    default:
      return "border-line bg-panel text-ink-soft";
  }
}

export default function DagCanvas({
  status,
}: {
  status: Record<DagNodeId, NodeStatus>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel/60 px-2 py-4">
      <div className="relative mx-auto h-[180px] w-[1080px]">
        <svg
          className="absolute inset-0"
          viewBox="0 0 1080 180"
          width={1080}
          height={180}
        >
          <defs>
            <marker
              id="dag-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#c9902a" />
            </marker>
          </defs>
          {EDGES.map((e) => (
            <path
              key={`${e.from}-${e.to}`}
              d={edgePath(e.from, e.to)}
              fill="none"
              stroke="#2a3346"
              strokeWidth={1.5}
              markerEnd="url(#dag-arrow)"
            />
          ))}
        </svg>

        {Object.entries(NODE_POS).map(([id, pos]) => {
          const st = status[id as DagNodeId];
          return (
            <div
              key={id}
              className={`absolute flex flex-col items-center justify-center rounded-xl border text-xs ${nodeClass(st)}`}
              style={{ left: pos.x, top: pos.y, width: W, height: H }}
            >
              <span className="font-medium">{NODE_LABEL[id as DagNodeId]}</span>
              {st === "done" && <span className="text-[10px] leading-none">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
