// web/src/features/liang/workflow.ts
import type {
  CompareResult,
  Pick,
  TaskEliminated,
  TaskPick,
  TaskPlan,
} from "./types";

export type DagNodeId =
  | "parse"
  | "load"
  | "filter"
  | "sort"
  | "eliminate"
  | "pick"
  | "verify"
  | "save";

export type NodeStatus = "pending" | "running" | "done" | "skipped";

export interface DagNode {
  id: DagNodeId;
  label: string;
  deps: DagNodeId[];
}

export const DAG_NODES: DagNode[] = [
  { id: "parse", label: "理解需求", deps: [] },
  { id: "load", label: "读取粮源", deps: ["parse"] },
  { id: "filter", label: "硬条件过滤", deps: ["load"] },
  { id: "sort", label: "排序比较", deps: ["filter"] },
  { id: "eliminate", label: "淘汰归因", deps: ["filter"] },
  { id: "pick", label: "主推/备选", deps: ["sort"] },
  { id: "verify", label: "待核验清单", deps: ["pick", "eliminate"] },
  { id: "save", label: "沉淀任务", deps: ["verify"] },
];

// 自动执行批次（save 为手动触发，不含在内）
export const AUTO_BATCHES: DagNodeId[][] = [
  ["parse"],
  ["load"],
  ["filter"],
  ["sort", "eliminate"],
  ["pick"],
  ["verify"],
];

export function initialStatus(): Record<DagNodeId, NodeStatus> {
  const s = {} as Record<DagNodeId, NodeStatus>;
  for (const n of DAG_NODES) s[n.id] = "pending";
  return s;
}

function pickToTaskPick(p: Pick): TaskPick {
  const l = p.listing;
  return {
    listing_code: l.listing_code,
    variety_name: l.variety_name,
    grade: l.grade,
    crop_year: l.crop_year,
    origin: `${l.origin_province} ${l.origin_city}`,
    supplier_name: l.supplier_name,
    price: l.price,
    price_type: l.price_type,
    available_quantity_tons: l.available_quantity_tons,
    latest_ship_at: l.latest_ship_at,
    reasons: p.reasons,
    risks: p.risks,
  };
}

/** 把候选对比结果固化为可落库的方案快照。 */
export function buildPlan(compare: CompareResult): TaskPlan {
  return {
    need_summary: compare.need_summary,
    primary: compare.primary ? pickToTaskPick(compare.primary) : null,
    backup: compare.backup ? pickToTaskPick(compare.backup) : null,
    eliminated: compare.eliminated.map(
      (e): TaskEliminated => ({
        listing_code: e.listing.listing_code,
        variety_name: e.listing.variety_name,
        grade: e.listing.grade,
        supplier_name: e.listing.supplier_name,
        reason_code: e.reason_code,
        reason_text: e.reason_text,
      }),
    ),
    verifications: compare.verifications,
  };
}
