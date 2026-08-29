import { useMemo, useState } from "react";
import { askPartner } from "./api";
import type { Partner, PartnerType, RiskItem, RiskLevel, Verdict } from "./types";

const typeOptions: Array<{ value: "all" | PartnerType; label: string }> = [
  { value: "all", label: "全部" },
  { value: "grain", label: "粮源" },
  { value: "logistics", label: "物流" },
  { value: "finance", label: "资金" },
];

const levelStyle: Record<RiskLevel, { label: string; className: string; line: string }> = {
  high: { label: "高风险", className: "bg-red-400/12 text-red-300 border-red-400/20", line: "bg-red-400" },
  medium: { label: "待核验", className: "bg-amber-400/12 text-amber-300 border-amber-400/20", line: "bg-amber-400" },
  low: { label: "低风险", className: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20", line: "bg-emerald-400" },
};

const verdictStyle: Record<Verdict, { label: string; className: string; dot: string }> = {
  proceed: { label: "建议继续接洽", className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300", dot: "bg-emerald-400" },
  verify: { label: "补充核验后继续", className: "border-amber-400/25 bg-amber-400/10 text-amber-300", dot: "bg-amber-400" },
  pause: { label: "建议暂缓", className: "border-red-400/25 bg-red-400/10 text-red-300", dot: "bg-red-400" },
};

interface Props {
  partners: Partner[];
  selectedPartnerId: string;
  onSelectPartner: (id: string) => void;
  addedRiskIds: Set<string>;
  onAddVerification: (partnerId: string, risk: RiskItem) => void;
  onOpenVerifications: () => void;
  onNewReview: () => void;
  summaryLoading?: boolean;
}

export default function RiskCheckTab({
  partners,
  selectedPartnerId,
  onSelectPartner,
  addedRiskIds,
  onAddVerification,
  onOpenVerifications,
  onNewReview,
  summaryLoading = false,
}: Props) {
  const [type, setType] = useState<"all" | PartnerType>("all");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const partner = partners.find((item) => item.id === selectedPartnerId) ?? partners[0];
  const filtered = useMemo(() => partners.filter((item) => type === "all" || item.type === type), [type]);
  const importantRisks = partner.risks.filter((item) => item.level !== "low");

  const rerun = () => {
    setScanning(true);
    setAnswer("");
    window.setTimeout(() => setScanning(false), 850);
  };

  const ask = async () => {
    const text = question.trim();
    if (!text || asking) return;
    setAsking(true);
    setQuestion("");
    setAnswer("");
    try {
      // 带体检证据调用后端大模型；失败时回退本地规则版回答，问答不中断
      const result = await askPartner(text, partner);
      setAnswer(result.answer);
    } catch {
      setAnswer(
        `安小二已结合${partner.sourceAgent}结果和企业合作记录核对：${partner.summary} 当前最需要优先处理的是“${importantRisks[0]?.title ?? "补充基础信息"}”。`,
      );
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-line bg-panel/70 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-300/70">Partner queue</p>
            <h2 className="mt-1 text-base font-semibold">选择合作方</h2>
          </div>
          <span className="rounded-full bg-rice-deep px-2 py-1 text-[10px] text-ink-soft">{partners.length} 个对象</span>
        </div>

        <div className="mt-4 flex gap-1 rounded-xl bg-rice-deep p-1">
          {typeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setType(option.value);
                const first = partners.find((item) => option.value === "all" || item.type === option.value);
                if (first) onSelectPartner(first.id);
              }}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs transition ${
                type === option.value ? "bg-emerald-400/15 text-emerald-300" : "text-ink-soft hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {filtered.map((item) => {
            const selected = item.id === partner.id;
            const verdict = verdictStyle[item.verdict];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectPartner(item.id)}
                className={`relative w-full overflow-hidden rounded-xl border p-3 text-left transition ${
                  selected ? "border-emerald-400/35 bg-emerald-400/[0.07]" : "border-line bg-rice/45 hover:border-emerald-400/20"
                }`}
              >
                {selected && <span className="absolute inset-y-3 left-0 w-0.5 bg-emerald-400" />}
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-md bg-rice-deep px-1.5 py-0.5 text-[10px] text-ink-soft">{item.typeLabel}</span>
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full ${verdict.dot}`} />
                </div>
                <div className="mt-2 text-sm font-medium leading-5">{item.name}</div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-ink-soft">
                  <span>来自{item.sourceAgent}</span>
                  <span>{item.risks.filter((risk) => risk.level !== "low").length} 项需关注</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-emerald-400/20 bg-emerald-400/[0.04] p-3">
          <div className="text-xs font-medium">独立发起体检</div>
          <p className="mt-1 text-[11px] leading-5 text-ink-soft">从系统已有合作方中选择，不需要先经过其他小二。</p>
          <button type="button" onClick={onNewReview} className="mt-2 w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-emerald-400">＋ 新建合作方体检</button>
        </div>
      </aside>

      <section className="min-w-0 space-y-5">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-panel/75 p-5">
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(52,211,153,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,.07)_1px,transparent_1px)] [background-size:32px_32px]" />
          {scanning && <span className="an-scan-line pointer-events-none absolute inset-x-0 top-0 h-px bg-emerald-300 shadow-[0_0_18px_3px_rgba(52,211,153,0.55)]" />}
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span>{partner.typeLabel}</span><span>·</span><span>{partner.region}</span><span>·</span><span>{partner.id}</span>
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{partner.name}</h2>
              <p className="mt-1 text-sm text-ink-soft">{partner.business}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full border border-tech/20 bg-tech/10 px-2.5 py-1 text-tech">来源：{partner.sourceAgent}</span>
                <span className="max-w-full truncate rounded-full border border-line bg-rice/50 px-2.5 py-1 text-ink-soft">{partner.sourceTask}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 xl:items-end">
              <div className={`rounded-xl border px-4 py-3 ${verdictStyle[partner.verdict].className}`}>
                <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">当前结论</div>
                <div className="mt-1 flex items-center gap-2 font-semibold">
                  <span className={`h-2 w-2 rounded-full ${verdictStyle[partner.verdict].dot}`} />
                  {verdictStyle[partner.verdict].label}
                </div>
              </div>
              <button type="button" onClick={rerun} disabled={scanning} className="rounded-full border border-emerald-400/25 px-4 py-2 text-xs text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50">
                {scanning ? "正在重新体检…" : "重新体检"}
              </button>
            </div>
          </div>

          <div className="relative mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 xl:grid-cols-4">
            {partner.profile.map((item) => (
              <div key={item.label}>
                <div className="text-[10px] text-ink-soft">{item.label}</div>
                <div className="mt-1 text-sm font-medium">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-ink-soft">Evidence-based findings</p>
                <h3 className="mt-1 font-semibold">风险发现与依据</h3>
              </div>
              <span className="text-xs text-ink-soft">更新于 {partner.updatedAt}</span>
            </div>
            {partner.risks.map((risk) => {
              const style = levelStyle[risk.level];
              const added = addedRiskIds.has(risk.id);
              return (
                <article key={risk.id} className="relative overflow-hidden rounded-2xl border border-line bg-panel/65 p-4">
                  <span className={`absolute inset-y-0 left-0 w-0.5 ${style.line}`} />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${style.className}`}>{style.label}</span>
                        <h4 className="text-sm font-semibold">{risk.title}</h4>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-ink-soft">{risk.description}</p>
                    </div>
                    {risk.level !== "low" && (
                      <button
                        type="button"
                        onClick={() => added ? onOpenVerifications() : onAddVerification(partner.id, risk)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
                          added ? "bg-emerald-400/10 text-emerald-300" : "border border-line text-ink-soft hover:border-emerald-400/30 hover:text-emerald-300"
                        }`}
                      >
                        {added ? "已加入核验 →" : "加入待办核验"}
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 border-t border-line pt-3 md:grid-cols-2">
                    <div className="text-[11px] leading-5"><span className="text-ink-soft">判断依据：</span>{risk.evidence}</div>
                    <div className="text-[11px] leading-5"><span className="text-ink-soft">建议动作：</span>{risk.action}</div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-[linear-gradient(145deg,rgba(52,211,153,0.09),rgba(19,28,54,0.7))] p-4">
              {summaryLoading && <span className="an-scan-line pointer-events-none absolute inset-x-0 top-0 h-px bg-emerald-300 shadow-[0_0_18px_3px_rgba(52,211,153,0.55)]" />}
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 text-xs text-emerald-300">安</span>
                <div>
                  <div className="text-sm font-semibold">安小二判断</div>
                  <div className="text-[10px] text-ink-soft">AI 整理 · 规则定级</div>
                </div>
              </div>
              {summaryLoading ? (
                <p className="mt-3 animate-pulse text-xs leading-6 text-emerald-300/80">正在结合基础资料与企业历史经验生成体检结论…</p>
              ) : (
                <p className="mt-3 text-xs leading-6 text-ink-soft">{partner.summary}</p>
              )}
              <div className="mt-3 rounded-xl bg-rice/50 p-3 text-[11px] leading-5">
                <span className="text-emerald-300">优先动作：</span>{importantRisks[0]?.action ?? "当前无需新增核验动作。"}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-panel/65 p-4">
              <div className="text-xs font-semibold">继续问安小二</div>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="例如：为什么不能直接继续推进？"
                rows={3}
                className="mt-3 w-full resize-none rounded-xl border border-line bg-rice/60 px-3 py-2 text-xs leading-5 outline-none placeholder:text-ink-soft/60 focus:border-emerald-400/30"
              />
              <button type="button" onClick={ask} disabled={asking} className="mt-2 w-full rounded-xl bg-emerald-500/90 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60">
                {asking ? "安小二正在核对证据…" : "结合当前证据回答"}
              </button>
              {answer && <p className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3 text-[11px] leading-5 text-ink-soft">{answer}</p>}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
