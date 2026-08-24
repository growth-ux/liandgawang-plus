import type { ReviewRecord } from "./types";

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

