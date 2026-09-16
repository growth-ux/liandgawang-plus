import { assessPurchaseMarket } from "./marketAssessment";
import { agents } from "../../data/agents";
import {
  formatMoney,
  orderProblems,
  purchaseSettlement,
  purchaseTotals,
  PURCHASE_STAGES,
  type Purchase,
  type PurchaseNeed,
} from "./purchaseModel";
import { ACCOUNT_FROZEN, ACCOUNT_TOTAL } from "./qualificationData";
import type { AgentResult, AgentRun, CollaborationSnapshot } from "./types";

/** 粮掌柜始终主理采购，小二按当前业务动作参与。 */
export function purchaseStageRoles(purchase: Purchase | null, stage: number) {
  const stages = [
    {
      members: [],
      steward: "需求确认",
      action: "整理品种、数量、收货地、交期与预算，向你确认采购目标。",
    },
    {
      members: ["zhan"],
      steward: "采购决策",
      action: "结合瞻小二的行情依据，向你确认采购、调整或观望。",
    },
    {
      members: ["an", "qian"],
      steward: "准入协调",
      action: "汇总资质与资金核验，提示补充材料，核验通过后推进选粮。",
    },
    {
      members: ["liang", "zhan"],
      steward: "选粮决策",
      action: "",
    },
    {
      members:
        purchase?.transportId === "pickup"
          ? ["yun", "zhan", "suan"]
          : ["yun", "suan"],
      steward: "提货协调",
      action: "汇总运输时效、提货条件与到厂成本，向你确认安排。",
    },
    purchase?.ordered
      ? {
          members: ["yun"],
          steward: "履约跟进",
          action: "",
        }
      : {
          members: ["an", "qian", "suan"],
          steward: "下单确认",
          action: "",
    },
    {
      members: ["suan"],
      steward: "到厂核算",
      action: "",
    },
    {
      members: ["an"],
      steward: "履约复盘",
      action: "",
    },
  ];
  return stages[stage];
}
const TASKS: Record<string, string> = {
  zhan: "行情研判与提货窗口",
  liang: "粮源寻采与候选比选",
  an: "企业资质与合同安全",
  qian: "账户与资金条件核验",
  yun: "运输方案与交付跟进",
  suan: "实际到厂成本与损耗核算",
};

/** 节点、连线、抽屉均从当前采购状态计算，不另建一套节点状态机。 */
export function purchaseCollaboration(
  purchase: Purchase | null,
  need: PurchaseNeed,
  stage: number,
  checking: number | null,
): CollaborationSnapshot {
  const active = purchaseStageRoles(purchase, stage).members;
  const totals = purchase ? purchaseTotals(purchase) : null;
  const goal = purchase?.need ?? need;
  const facts = {
    采购品种: `二等${goal.variety}`,
    采购数量: `${goal.quantity} 吨`,
    到货地区: goal.destination,
    交期: `${goal.days} 天`,
    预算上限: `${goal.budget} 元/吨`,
  };
  const results = new Map<string, AgentRun>();
  function result(
    id: string,
    summary: string,
    values: Record<string, unknown> = {},
    problems: string[] = [],
    running = false,
  ) {
    const status = running
      ? "running"
      : problems.length
        ? "completed_with_objection"
        : "completed";
    const output: AgentResult = {
      agent_id: id,
      status: problems.length ? "completed_with_objection" : "completed",
      summary,
      facts: { ...facts, ...values },
      recommendations: problems.length ? problems : [summary],
      risks: problems.map((detail, index) => ({
        code: `CHECK-${index + 1}`,
        detail,
        severity: "high",
      })),
      missing_information: problems,
      evidence: [
        {
          item: summary,
          source: purchase
            ? `采购 ${purchase.id} · ${PURCHASE_STAGES[stage]}`
            : "待确认采购条件",
        },
      ],
      impact_on_mission: problems.length
        ? "阻止推进，完成补充或修正后重新核验。"
        : `本结果用于${PURCHASE_STAGES[stage]}，与当前操作面板保持一致。`,
      available_actions: [],
    };
    results.set(id, {
      agent_id: id,
      participation_reason: TASKS[id],
      status,
      input_snapshot: {
        当前阶段: PURCHASE_STAGES[stage],
        采购编号: purchase?.id ?? "待创建",
      },
      output_snapshot: running ? null : output,
    });
  }
  const market = purchase?.marketDecision;
  const marketSummary =
    purchase?.stage === 1
      ? assessPurchaseMarket(goal).summary
      : (market?.summary ??
        (purchase && purchase.stage > 1
          ? "历史采购未单独记录行情确认，可查看原方案依据。"
          : assessPurchaseMarket(goal).summary));
  if (stage >= 1)
    result(
      "zhan",
      market?.action === "watch"
        ? `已保存研判，用户选择暂时观望。${marketSummary}`
        : marketSummary,
      {
        行情决策: market
          ? {
              buy: "继续采购",
              adjust: "调整需求",
              watch: "暂时观望",
              inherited: "沿用原方案研判",
            }[market.action]
          : "等待用户确认",
        研判时库存: `${market?.assessedNeed.stockDays ?? goal.stockDays ?? 7} 天`,
        建议交期: market
          ? `${market.suggestedNeed.days} 天`
          : `${assessPurchaseMarket(goal).suggestedNeed.days} 天`,
      },
    );
  if (purchase && stage >= 2) {
    const checked = purchase.qualified || purchase.qualificationChecked;
    const anProblems =
      checked && !purchase.documentName
        ? ["经办人授权书缺失，补充材料后重新核验。"]
        : [];
    const fundProblems =
      checked && goal.quantity * goal.budget * 0.1 > ACCOUNT_TOTAL - ACCOUNT_FROZEN
        ? ["保证金预留超过账户可用额度，请调整采购计划。"]
        : [];
    result(
      "an",
      checking !== null
        ? "正在核验企业资质与经办人授权。"
        : purchase.qualified
          ? "企业资质及经办人授权核验通过。"
          : (anProblems[0] ?? "待启动企业资质核验。"),
      { 授权材料: purchase.documentName || "尚未补充" },
      anProblems,
      checking !== null && checking < 5,
    );
    result(
      "qian",
      checking !== null
        ? "正在核验资金账户与保证金。"
        : checked
          ? (fundProblems[0] ?? "对公账户与保证金额度核验通过。")
          : "待启动资金账户与保证金核验。",
      {
        预留保证金: `${goal.quantity * goal.budget * 0.1} 元`,
        可用额度: `${formatMoney(ACCOUNT_TOTAL - ACCOUNT_FROZEN)} 元`,
      },
      fundProblems,
      checking !== null && checking < 6,
    );
    if (!checked && checking === null) {
      for (const id of ["an", "qian"])
        results.set(id, {
          ...results.get(id)!,
          status: "pending",
          output_snapshot: null,
        });
    }
  }
  if (purchase && totals && stage >= 3) {
    result(
      "liang",
      `当前选择${totals.source.depot}，${totals.source.price} 元/吨，可供 ${totals.source.stock} 吨。`,
      {
        粮源: totals.source.name,
        粮款: `${totals.goods} 元`,
        水分: totals.source.moisture,
      },
    );
  }
  if (purchase && totals && stage === 3) {
    result(
      "zhan",
      `${totals.source.depot}当前报价 ${totals.source.price} 元/吨，含税出库、不含运输。`,
      {
        当前粮源报价: `${totals.source.price} 元/吨`,
        参考口径: purchase.originMission
          ? "沿用原方案粮源报价"
          : "山东区域二等粮出库参考，不含运费",
      },
    );
  }
  if (purchase && totals && stage >= 4) {
    const problems =
      totals.days > goal.days
        ? ["当前运输方案超过采购交期，请选择更快方案。"]
        : [];
    result(
      "yun",
      `${totals.source.depot} → ${goal.destination}，${totals.transport.label}，${totals.freight} 元/吨，预计 ${totals.days} 天。`,
      { 运输方式: totals.transport.label, 物流费用: `${totals.logistics} 元` },
      problems,
    );
    result(
      "suan",
      `所选组合到厂 ${totals.unit} 元/吨，总成本 ${totals.total} 元。`,
      {
        粮款: `${totals.goods} 元`,
        物流费用: `${totals.logistics} 元`,
        预算余量: `${(goal.budget - totals.unit) * goal.quantity} 元`,
      },
      totals.unit > goal.budget ? ["到厂成本超过预算上限，请调整方案。"] : [],
    );
    result(
      "zhan",
      purchase.transportId === "pickup"
        ? `建议分 ${Math.ceil(goal.quantity / 30)} 车次错峰提货，出发前复核天气与库区营业时间。`
        : "请在确认排期前复核天气与库区装卸窗口，交期以本次方案为准。",
    );
  }
  if (purchase && totals && stage >= 5) {
    const problems = purchase.reviewAttempted ? orderProblems(purchase) : [];
    result(
      "an",
      purchase.ordered
        ? "合同与收款主体核验通过，订单已确认。"
        : (problems[0] ??
            (purchase.reviewed
              ? "合同与交易约束已核验通过，可以确认下单。"
              : "等待核验合同、收款主体、预算、库存与交期。")),
      { 合同卖方: totals.source.name, 收款主体: purchase.payee },
      problems,
    );
    if (!purchase.reviewAttempted && !purchase.reviewed && !purchase.ordered)
      results.set("an", {
        ...results.get("an")!,
        status: "pending",
        output_snapshot: null,
      });
    result(
      "qian",
      `本笔预计预留保证金 ${goal.quantity * goal.budget * 0.1} 元，账户可用额度 ${formatMoney(ACCOUNT_TOTAL - ACCOUNT_FROZEN)} 元；以交易核验结果确认资金条件。`,
      {
        预留保证金: `${goal.quantity * goal.budget * 0.1} 元`,
        订单总额: `${totals.total} 元`,
      },
      purchase.reviewAttempted && goal.quantity * goal.budget * 0.1 > ACCOUNT_TOTAL - ACCOUNT_FROZEN
        ? ["保证金预留超过账户可用额度，请调整采购计划。"]
        : [],
    );
    if (purchase.ordered)
      result(
        "yun",
        purchase.received
          ? "本笔粮食已签收入库，履约完成。"
          : [
              "订单已确认，等待库区发运。",
              "已装车发运，持续跟进运输。",
              "已到货，等待客户验收确认。",
            ][purchase.deliveryStep],
      );
  }
  if (purchase && stage === 6) {
    const settlement = purchaseSettlement(purchase);
    result("suan", settlement.isComplete
      ? `实际合格入库吨成本 ${formatMoney(settlement.landedUnit!)} 元，损耗 ${(settlement.lossRate * 100).toFixed(2)}%，结算凭证已关联。`
      : "粮款已核对，自提运输、装卸与损耗费用待补录。", {
      来源订单: purchase.id,
      结算总额: `${formatMoney(settlement.settledTotal)} 元`,
      合格入库: `${formatMoney(settlement.receivedQuantity)} 吨`,
      成本口径: settlement.isComplete ? "总成本 ÷ 实际合格入库量" : "仅含平台粮款",
    });
  }
  if (purchase && stage === 7) {
    const settlement = purchaseSettlement(purchase);
    const delayed = settlement.days > goal.days;
    const excessiveLoss = settlement.lossRate > settlement.lossAllowanceRate;
    result(
      "an",
      delayed || excessiveLoss
        ? "本次履约发现异常，责任结论已形成风险规则并归档。"
        : "供应、运输与验收记录已复核，本次未形成新增风险规则。",
      {
        交付时效: delayed ? `超出约定 ${settlement.days - goal.days} 天` : "按期交付",
        运输损耗: `${(settlement.lossRate * 100).toFixed(2)}%`,
        合同允差: `${(settlement.lossAllowanceRate * 100).toFixed(2)}%`,
        风险规则: delayed || excessiveLoss ? "新增 1 条" : "无新增",
      },
      delayed || excessiveLoss ? ["本次履约异常已进入后续合作提醒。"] : [],
    );
  }

  const team = agents
    .filter((a) => a.id !== "da")
    .map((agent) => ({
      agent_id: agent.id,
      name: agent.name,
      selected: active.includes(agent.id),
      reason: active.includes(agent.id)
        ? (results.get(agent.id)?.output_snapshot?.summary ??
          `等待办理 · ${TASKS[agent.id]}`)
        : `本步无需参与 · ${TASKS[agent.id]}`,
      expected_output: TASKS[agent.id],
    }));
  const runs = team.map(
    (member) =>
      (member.selected ? results.get(member.agent_id) : undefined) ?? {
        agent_id: member.agent_id,
        participation_reason: TASKS[member.agent_id],
        status: "pending" as const,
        input_snapshot: {},
        output_snapshot: null,
      },
  );
  const objections = runs.filter(
    (run) =>
      active.includes(run.agent_id) &&
      run.status === "completed_with_objection",
  );
  return {
    team,
    agent_runs: runs,
    conflicts: objections.map((run) => ({
      kind: "cost_vs_risk",
      agent_ids: [run.agent_id],
      title: run.output_snapshot!.summary,
      detail: run.output_snapshot!.summary,
      evidence: [],
      severity: "high",
      requires_human: true,
      supplement_requested: false,
    })),
    status:
      checking !== null
        ? "running"
        : purchase?.received
          ? "completed"
          : "awaiting_decision",
    recommendation: null,
  };
}
