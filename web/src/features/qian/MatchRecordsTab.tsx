import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchFinanceMatches, fetchFinanceMatch, handoffFinanceMatchToSuan } from "./api";
import type { FinanceHandoff, FinanceProduct, FinanceRequirement, MatchRecord } from "./types";
import RiskHandoffDialog from "../an/RiskHandoffDialog";
import type { RiskHandoffDraft } from "../an/handoff";

interface Props {
  refreshKey: number;
  onReuse: (req: Partial<FinanceRequirement>) => void;
  onOpenProduct: (product: FinanceProduct) => void;
}

const PURPOSE_LABELS: Record<string, string> = {
  grain_purchase: "粮食采购",
  inventory_turnover: "库存周转",
  receivable_turnover: "应收周转",
};

function formatWan(value: string): string {
  return `${(Number(value) / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}万`;
}

export default function MatchRecordsTab({ refreshKey, onReuse, onOpenProduct: _onOpenProduct }: Props) {
  const navigate = useNavigate();
  const [records, setRecords] = useState<MatchRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MatchRecord | null>(null);
  const [handoff, setHandoff] = useState<FinanceHandoff | null>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [riskDraft, setRiskDraft] = useState<RiskHandoffDraft | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchFinanceMatches()
      .then((r) => setRecords(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewDetail = async (id: number) => {
    try {
      const r = await fetchFinanceMatch(id);
      setDetail(r);
      setExpandedId(id);
    } catch {
      // 静默
    }
  };

  const handleHandoff = async (id: number) => {
    setHandoffLoading(true);
    try {
      const h = await handoffFinanceMatchToSuan(id);
      setHandoff(h);
    } catch {
      // 静默
    } finally {
      setHandoffLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
        <p className="text-sm text-red-400">匹配记录加载失败：{error}</p>
        <button onClick={load} className="mt-3 rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft hover:text-ink">
          重新加载
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-ink-soft">加载中…</div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
        <p className="text-sm font-medium">还没有保存的匹配结果</p>
        <p className="mt-1 text-xs text-ink-soft">前往「智能匹配」完成首次匹配</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold">历史匹配记录</h3>
      {records.map((r) => {
        const req = r.requirement;
        const primary = r.result.primary;
        const isExpanded = expandedId === r.id;

        return (
          <div key={r.id} className="rounded-2xl border border-line bg-panel/70 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-ink-soft">{r.match_code}</span>
                  <span className="text-[10px] text-ink-soft/60">
                    {r.created_at ? new Date(r.created_at).toLocaleString("zh-CN") : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm">
                  <span className="font-medium">{formatWan(req.amount_yuan)}</span>
                  <span className="mx-1.5 text-ink-soft">·</span>
                  <span>{req.duration_days}天</span>
                  <span className="mx-1.5 text-ink-soft">·</span>
                  <span>{PURPOSE_LABELS[req.purpose] ?? req.purpose}</span>
                </p>
                {primary ? (
                  <p className="mt-0.5 text-xs text-brand-deep">
                    主推：{primary.product.name}
                    {primary.estimated_cost_yuan && (
                      <span className="ml-2 text-ink-soft">参考成本 {primary.estimated_cost_yuan}元</span>
                    )}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-ink-soft">未找到完全符合产品</p>
                )}
                {primary && primary.pending_conditions.length > 0 && (
                  <p className="mt-0.5 text-[10px] text-amber-300">
                    待确认条件 {primary.pending_conditions.length} 项
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleViewDetail(r.id)}
                  className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:text-ink">
                  查看结果
                </button>
                <button onClick={() => onReuse(req)}
                  className="rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-brand-deep hover:bg-brand/25">
                  重新匹配
                </button>
              </div>
            </div>

            {/* 展开详情 */}
            {isExpanded && detail && detail.id === r.id && (
              <div className="mt-4 border-t border-line pt-4">
                <h4 className="mb-2 text-xs font-semibold text-ink-soft">匹配结果快照</h4>
                {detail.result.explanation && (
                  <p className="mb-3 rounded-xl bg-brand-faint/40 px-4 py-2 text-xs text-brand-deep">
                    {detail.result.explanation}
                  </p>
                )}
                {detail.result.primary && (
                  <div className="rounded-xl bg-rice-deep p-3">
                    <p className="text-sm font-medium">{detail.result.primary.product.name}</p>
                    <p className="text-xs text-ink-soft">{detail.result.primary.product.institution_name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {detail.result.primary.matched_reasons.map((reason, i) => (
                        <span key={i} className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">{reason}</span>
                      ))}
                    </div>
                    {detail.result.primary.pending_conditions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {detail.result.primary.pending_conditions.map((c, i) => (
                          <span key={i} className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">⚠ {c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 算小二交接 */}
                {detail.result.primary && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {!handoff ? (
                      <button
                        onClick={() => handleHandoff(detail.id)}
                        disabled={handoffLoading}
                        className="rounded-full border border-tech/40 px-4 py-1.5 text-xs font-medium text-tech hover:bg-tech/10 disabled:opacity-40"
                      >
                        {handoffLoading ? "交接中…" : "交给算小二测成本"}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const h = {
                            source_agent: "qian" as const,
                            target_agent: "suan" as const,
                            source_ref: `FIN-M${detail.id}`,
                            schemes: [{
                              scheme_id: "A",
                              name: `${handoff.product_name} 资金方案`,
                              financing_cost_yuan: handoff.reference_cost_yuan ?? null,
                              pending_items: handoff.pending_conditions,
                            }],
                            pending_items: handoff.pending_conditions,
                          };
                          sessionStorage.setItem("suan_pending_handoff", JSON.stringify(h));
                          navigate("/agent/suan");
                        }}
                        className="rounded-full bg-tech/80 px-4 py-1.5 text-xs font-medium text-white hover:bg-tech"
                      >
                        前往算小二
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const primary = detail.result.primary!;
                        setRiskDraft({
                          id: `qian-${detail.id}-${Date.now()}`,
                          partnerType: "finance",
                          partnerName: primary.product.institution_name,
                          region: "粮达网资金服务",
                          business: primary.product.scenario,
                          sourceAgent: "钱小二",
                          sourceTask: `${detail.match_code} · ${primary.product.name}`,
                          profile: [
                            { label: "资金产品", value: primary.product.name },
                            { label: "匹配金额", value: `${formatWan(detail.requirement.amount_yuan)}` },
                            { label: "使用期限", value: `${detail.requirement.duration_days} 天` },
                            { label: "费用口径", value: primary.product.annual_rate_pct ? `参考年化 ${primary.product.annual_rate_pct}%` : primary.product.fee_note },
                          ],
                          findings: primary.pending_conditions,
                          positiveEvidence: primary.matched_reasons,
                          createdAt: new Date().toISOString(),
                        });
                      }}
                      className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.07] px-4 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-400/10"
                    >
                      查资金服务方风险
                    </button>
                  </div>
                )}

                <p className="mt-3 text-[10px] text-ink-soft/60">参考匹配，不代表授信或放款承诺</p>
              </div>
            )}
          </div>
        );
      })}
      {riskDraft && <RiskHandoffDialog draft={riskDraft} onClose={() => setRiskDraft(null)} />}
    </div>
  );
}
