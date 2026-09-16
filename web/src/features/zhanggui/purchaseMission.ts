import type { MissionSnapshot } from "./types";
import { newPurchase, type Purchase } from "./purchaseModel";

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}

/** 只接续已确认且无待核验前置项的方案；缺失数据不以区域演示报价覆盖。 */
export function purchaseFromMission(mission: MissionSnapshot): Purchase {
  if (mission.status !== "completed")
    throw new Error("请先在驾驶舱中确认采购方案，再继续交易办理。");
  if (
    mission.action_tasks.some((task) => task.status === "waiting_prerequisite")
  )
    throw new Error(
      "该方案仍有前置风险核验，请先完成核验；当前不能直接进入采购下单。",
    );
  const variety = mission.goal.variety_name;
  if (
    !["玉米", "小麦"].includes(variety) ||
    (mission.goal.grade && mission.goal.grade !== "二等")
  )
    throw new Error(
      "当前采购办理支持二等玉米、小麦；此任务请继续通过原专业小二处理。",
    );
  const quantity = Number(mission.goal.quantity_tons);
  const budget = Number(mission.goal.budget_yuan_per_ton);
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(budget) ||
    budget <= 0 ||
    !mission.goal.destination ||
    !mission.goal.deadline_date
  )
    throw new Error(
      "原任务缺少完整数量、预算、到货地或交期，请补齐采购条件后再办理。",
    );
  const days = Math.ceil(
    (new Date(`${mission.goal.deadline_date}T23:59:59`).getTime() -
      Date.now()) /
      86400000,
  );
  if (!Number.isFinite(days) || days < 1)
    throw new Error("原任务交期已经过期，请先重新确认到货日期。");
  const selected = mission.decisions.find(
    (decision) =>
      decision.gate_type === "plan" && decision.status === "confirmed",
  );
  const schemeId =
    selected?.selected_action === "choose_b"
      ? "B"
      : selected?.selected_action === "verify_a"
        ? "A"
        : mission.recommendation?.primary_scheme_id;
  const facts = (id: string) =>
    mission.agent_runs.find((run) => run.agent_id === id)?.output_snapshot
      ?.facts ?? {};
  const candidate = records(facts("liang").candidates).find(
    (item) => item.scheme_id === schemeId,
  );
  const costing = records(facts("suan").schemes).find(
    (item) => item.scheme_id === schemeId,
  );
  const batches = records(facts("yun").batches);
  if (
    batches.some((batch) => !Number.isFinite(Number(batch.quantity_tons))) ||
    Math.abs(
      batches.reduce((sum, batch) => sum + Number(batch.quantity_tons), 0) -
        quantity,
    ) > 0.001
  )
    throw new Error("运输批次数量与采购数量不一致，请先复核运小二方案。");
  const freight = Number(facts("yun").freight_weighted_yuan_per_ton);
  const shippingDays = Math.max(
    ...batches.map((batch) => Number(batch.days_high)),
  );
  const price = Number(candidate?.price);
  const stock = Number(candidate?.available_quantity_tons);
  if (
    !candidate?.supplier_name ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isFinite(stock) ||
    stock <= 0 ||
    !Number.isFinite(freight) ||
    freight < 0 ||
    !Number.isFinite(shippingDays) ||
    shippingDays < 1
  )
    throw new Error(
      "原方案尚无完整的粮源、运价或时效结果，无法接续采购。请先补充专业分析。",
    );
  const delivered = Number(costing?.delivered_cost_yuan_per_ton);
  if (!Number.isFinite(delivered) || delivered < price + freight)
    throw new Error("原方案综合成本口径不完整，请先复核算小二结果。");
  const purchase = newPurchase({
    variety: variety as "玉米" | "小麦",
    quantity,
    budget,
    destination: mission.goal.destination,
    days,
  });
  return {
    ...purchase,
    marketDecision: {
      action: "inherited",
      summary:
        mission.agent_runs.find((run) => run.agent_id === "zhan")
          ?.output_snapshot?.summary ??
        "本任务已完成原方案确认，继续沿用原采购安排；未单独记录行情确认。",
      decidedAt:
        selected?.decided_at ??
        mission.updated_at ??
        mission.created_at ??
        purchase.createdAt,
      assessedNeed: { ...purchase.need },
      suggestedNeed: { ...purchase.need },
    },
    id: mission.mission_code,
    originMission: mission,
    sourceId: String(candidate.listing_code ?? schemeId),
    transportId: "confirmed",
    payee: String(candidate.supplier_name),
    sourceOptions: [
      {
        id: String(candidate.listing_code ?? schemeId),
        name: String(candidate.supplier_name),
        depot: String(
          candidate.origin ?? facts("yun").origin ?? candidate.supplier_name,
        ),
        price,
        stock,
        moisture: String(candidate.moisture_pct ?? "以质检单为准"),
        reason: `沿用已确认方案 ${schemeId}：${mission.recommendation?.summary ?? "原驾驶舱采购分析"}`,
      },
    ],
    transportOptions: [
      {
        id: "confirmed",
        label: "已确认运输组合",
        mode: "delivery",
        price: freight,
        days: shippingDays,
        description:
          mission.agent_runs.find((run) => run.agent_id === "yun")
            ?.output_snapshot?.summary ?? "沿用运小二运输结果",
        loadCapacity: 30,
        loadUnit: "车次",
        dispatchWindow: "沿用原方案调度安排",
        priceBasis: "沿用原方案运输费用口径",
        quoteUpdatedAt: mission.updated_at
          ? mission.updated_at.replace("T", " ").slice(0, 16)
          : "原方案确认时",
      },
    ],
    additionalCostPerTon: Math.round((delivered - price - freight) * 100) / 100,
  };
}
