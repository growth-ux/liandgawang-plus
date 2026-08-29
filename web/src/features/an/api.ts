import type { Partner, ReviewRecord } from "./types";

export interface LearnedKnowledge {
  id: number;
  title: string;
  knowledge_type: "fact" | "preference" | "decision" | "risk";
}

export async function learnRiskReview(record: ReviewRecord): Promise<{ items: LearnedKnowledge[] }> {
  const response = await fetch("/api/knowledge/learn/an-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record_id: record.id,
      partner_name: record.partnerName,
      partner_type: record.typeLabel,
      title: `${record.partnerName}风险处置经验`,
      experience: record.experience,
    }),
  });
  if (!response.ok) throw new Error(`沉淀失败（${response.status}）`);
  return response.json() as Promise<{ items: LearnedKnowledge[] }>;
}

export interface AnExplainResult {
  answer: string;
  llm_available: boolean;
}

export interface AnReviewResult {
  summary: string;
  llm_available: boolean;
}

/** 把前端合作方对象转为后端体检证据入参。 */
function partnerPayload(partner: Partner) {
  return {
    name: partner.name,
    type_label: partner.typeLabel,
    source_agent: partner.sourceAgent,
    source_task: partner.sourceTask,
    region: partner.region,
    business: partner.business,
    verdict: partner.verdict,
    summary: partner.summary,
    profile: partner.profile,
    risks: partner.risks.map((risk) => ({
      title: risk.title,
      level: risk.level,
      description: risk.description,
      evidence: risk.evidence,
      action: risk.action,
    })),
  };
}

/** 带着合作方体检证据追问安小二；后端大模型不可用时返回规则版回答。 */
export async function askPartner(question: string, partner: Partner): Promise<AnExplainResult> {
  const response = await fetch("/api/an/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, partner: partnerPayload(partner) }),
  });
  if (!response.ok) throw new Error(`问答失败（${response.status}）`);
  return response.json() as Promise<AnExplainResult>;
}

/** 独立体检：风险项用确定性数据，大模型现场生成体检结论段落。 */
export async function reviewPartnerSummary(partner: Partner): Promise<AnReviewResult> {
  const response = await fetch("/api/an/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partner: partnerPayload(partner) }),
  });
  if (!response.ok) throw new Error(`体检结论生成失败（${response.status}）`);
  return response.json() as Promise<AnReviewResult>;
}

