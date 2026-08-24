import type { Partner, PartnerType, RiskItem, RiskLevel } from "./types";

const STORAGE_KEY = "liangda:risk-handoff-draft";

export interface RiskHandoffDraft {
  id: string;
  partnerType: PartnerType;
  partnerName: string;
  region: string;
  business: string;
  sourceAgent: "粮小二" | "运小二" | "钱小二";
  sourceTask: string;
  profile: Array<{ label: string; value: string }>;
  findings: string[];
  positiveEvidence: string[];
  createdAt: string;
}

export function saveRiskHandoff(draft: RiskHandoffDraft): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function readRiskHandoff(): RiskHandoffDraft | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RiskHandoffDraft;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function typeLabel(type: PartnerType): string {
  if (type === "grain") return "粮源供应方";
  if (type === "logistics") return "物流服务方";
  return "资金服务方";
}

function riskLevel(type: PartnerType, finding: string): RiskLevel {
  if (type === "finance" && /费用|收费|成本口径/.test(finding)) return "high";
  return "medium";
}

function actionFor(type: PartnerType, finding: string): string {
  if (type === "grain") return `向供应方核实并留存结果：${finding}`;
  if (type === "logistics") return `询运前确认并记录：${finding}`;
  return `咨询资金服务方并取得明确说明：${finding}`;
}

export function partnerFromHandoff(draft: RiskHandoffDraft): Partner {
  const risks: RiskItem[] = draft.findings.map((finding, index) => ({
    id: `${draft.id}-R${index + 1}`,
    title: finding.length > 28 ? `${finding.slice(0, 28)}…` : finding,
    level: riskLevel(draft.partnerType, finding),
    description: finding,
    evidence: `${draft.sourceAgent}结果 · ${draft.sourceTask}`,
    source: draft.sourceAgent,
    action: actionFor(draft.partnerType, finding),
  }));

  draft.positiveEvidence.slice(0, 1).forEach((evidence, index) => {
    risks.push({
      id: `${draft.id}-P${index + 1}`,
      title: "已有业务证据支持继续评估",
      level: "low",
      description: evidence,
      evidence: `${draft.sourceAgent}结果 · 业务摘要`,
      source: draft.sourceAgent,
      action: "保留当前业务证据，无需重复核验。",
    });
  });

  return {
    id: `H-${draft.id}`,
    name: draft.partnerName,
    type: draft.partnerType,
    typeLabel: typeLabel(draft.partnerType),
    sourceAgent: draft.sourceAgent,
    sourceTask: draft.sourceTask,
    region: draft.region,
    business: draft.business,
    updatedAt: new Date(draft.createdAt).toLocaleString("zh-CN", { hour12: false }),
    verdict: risks.some((risk) => risk.level !== "low") ? "verify" : "proceed",
    summary: risks.some((risk) => risk.level !== "low")
      ? `已接收${draft.sourceAgent}的当前业务结果，发现 ${risks.filter((risk) => risk.level !== "low").length} 项信息需要在继续推进前核验。`
      : `已接收${draft.sourceAgent}的当前业务结果，现有信息未见明显异常，可以继续接洽。`,
    profile: draft.profile.slice(0, 4),
    risks,
  };
}
