export type PartnerType = "grain" | "logistics" | "finance";
export type RiskLevel = "high" | "medium" | "low";
export type Verdict = "proceed" | "verify" | "pause";
export type VerificationStatus = "pending" | "clear" | "risk" | "blocked";

export interface RiskItem {
  id: string;
  title: string;
  level: RiskLevel;
  description: string;
  evidence: string;
  source: string;
  action: string;
}

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  typeLabel: string;
  sourceAgent: string;
  sourceTask: string;
  region: string;
  business: string;
  updatedAt: string;
  verdict: Verdict;
  summary: string;
  profile: Array<{ label: string; value: string }>;
  risks: RiskItem[];
}

export interface VerificationItem {
  id: string;
  partnerId: string;
  partnerName: string;
  riskId: string;
  title: string;
  level: RiskLevel;
  request: string;
  sourceAgent: string;
  status: VerificationStatus;
  note?: string;
}

export interface ReviewRecord {
  id: string;
  partnerId: string;
  partnerName: string;
  typeLabel: string;
  date: string;
  verdict: Verdict;
  summary: string;
  riskCount: number;
  experience: string;
}
