export type KnowledgeType = "fact" | "preference" | "decision" | "risk";
export type KnowledgeStatus = "active" | "ignored";

export interface KnowledgeReference {
  knowledge_id: number;
  title: string;
  content: string;
  source_agent: string;
  source_title: string;
  applicable_reason: string;
  reliability_label: string;
}

export interface KnowledgeItem {
  id: number;
  knowledge_type: KnowledgeType;
  title: string;
  content: string;
  applicable_context: string[];
  tags: string[];
  source_type: string;
  source_record_id: number | null;
  source_agent: string;
  source_title: string;
  origin: "ai" | "manual";
  evidence_count: number;
  citation_count: number;
  reliability_label: string;
  status: KnowledgeStatus;
  memory_sync_status: "pending" | "synced" | "failed";
  created_at: string | null;
  updated_at: string | null;
}

export interface KnowledgeCitation {
  id: number;
  knowledge_id: number;
  knowledge_title?: string;
  agent_key: string;
  task_type: string;
  task_id: number;
  effect: string;
  accepted: boolean;
  created_at: string | null;
}

export interface KnowledgeOverviewData {
  total_items: number;
  new_this_week: number;
  citations_this_month: number;
  active_agents: number;
  reduced_confirmations: number;
  counts_by_type: Record<KnowledgeType, number>;
  latest_item: KnowledgeItem | null;
  recent_citations: KnowledgeCitation[];
}

export interface KnowledgeListParams {
  knowledge_type?: KnowledgeType;
  source_agent?: string;
  status?: KnowledgeStatus;
  query?: string;
}

export interface KnowledgeCreate {
  knowledge_type: KnowledgeType;
  title: string;
  content: string;
  applicable_context: string[];
  tags: string[];
}

export type KnowledgeUpdate = Partial<Omit<KnowledgeCreate, "knowledge_type">> & {
  status?: KnowledgeStatus;
};

