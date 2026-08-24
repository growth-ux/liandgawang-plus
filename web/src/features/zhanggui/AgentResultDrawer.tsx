import type { ReactNode } from "react";
import type { AgentRun } from "./types";
import { getAgent } from "../../data/agents";

export interface AgentResultDrawerProps {
  run: AgentRun | null;
  onClose(): void;
}

/** 专业结果抽屉：任务、结论、事实、建议、异议、证据与对综合方案的影响。 */
export default function AgentResultDrawer({ run, onClose }: AgentResultDrawerProps) {
  if (!run) return null;
  const agent = getAgent(run.agent_id);
  const accent = agent?.accent ?? "#22d3ee";
  const output = run.output_snapshot;
  const failed = run.status === "failed" || !output;

  return (
    <>
      <div className="zg-drawer-mask" onClick={onClose} />
      <div className="zg-drawer">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: accent }}>
            {agent?.name ?? run.agent_id} · 专业结果
          </h2>
          <button type="button" onClick={onClose} className="text-sm text-ink-soft hover:text-ink">
            关闭
          </button>
        </div>

        <Section title="接收的子任务">
          <p>{run.participation_reason || "—"}</p>
          {Object.keys(run.input_snapshot ?? {}).length > 0 && (
            <ul className="mt-2 space-y-1">
              {Object.entries(run.input_snapshot).map(([key, value]) => (
                <li key={key} className="flex justify-between gap-3">
                  <span className="text-ink-soft">{key}</span>
                  <span>{String(value)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {failed ? (
          <Section title="结果缺失">
            <p className="text-red-300">{run.error_message || output?.summary || "该专业结果暂时不可用"}</p>
            <p className="mt-2 text-ink-soft">
              可返回指挥舱重新运行任务进行重试；综合方案会标注该专业结果缺失。
            </p>
          </Section>
        ) : (
          <>
            <Section title="核心结论">
              <p>{output.summary}</p>
            </Section>

            {Object.keys(output.facts ?? {}).length > 0 && (
              <Section title="关键事实">
                <ul className="space-y-1">
                  {Object.entries(output.facts).slice(0, 10).map(([key, value]) => (
                    <li key={key} className="flex justify-between gap-3">
                      <span className="text-ink-soft">{key}</span>
                      <span className="max-w-[60%] truncate text-right">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {output.recommendations.length > 0 && (
              <Section title="专业建议">
                <ul className="list-disc space-y-1 pl-5">
                  {output.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Section>
            )}

            {output.risks.length > 0 && (
              <Section title="风险与异议">
                <ul className="space-y-2">
                  {output.risks.map((risk, index) => (
                    <li key={index} className="rounded-xl border border-brand/40 bg-brand-faint px-3 py-2">
                      <p className="text-brand-deep">{risk.supplier_name ?? risk.code}</p>
                      <p className="mt-0.5 text-ink-soft">{risk.detail}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {output.missing_information.length > 0 && (
              <Section title="缺失信息">
                <ul className="list-disc space-y-1 pl-5">
                  {output.missing_information.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Section>
            )}

            {output.evidence.length > 0 && (
              <Section title="证据来源">
                <ul className="space-y-1.5">
                  {output.evidence.map((item, index) => (
                    <li key={index} className="flex items-start justify-between gap-3">
                      <span className="leading-5">{item.item}</span>
                      <span className="shrink-0 rounded-full bg-rice-deep px-2 py-0.5 text-[11px] text-tech">
                        {item.source}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="对综合方案的影响">
              <p>{output.impact_on_mission || "—"}</p>
            </Section>

            <p className="mt-4 text-xs text-ink-soft">
              更新时间：{run.finished_at?.replace("T", " ").slice(0, 19) ?? "—"}
            </p>
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 border-t border-line pt-4 text-sm leading-6">
      <h3 className="mb-2 text-xs tracking-[0.2em] text-tech">{title}</h3>
      {children}
    </section>
  );
}
