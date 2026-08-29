import type { ReactNode } from "react";
import type { AgentRun } from "./types";
import { getAgent } from "../../data/agents";
import AgentFactList from "./AgentFactList";

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
  const interpretation = typeof output?.facts?.interpretation === "string" ? output.facts.interpretation : null;
  const interpretationByQwen = output?.facts?.interpretation_source === "qwen";
  const pending = run.status === "pending";
  const running = run.status === "running";
  const failed = run.status === "failed" || (!output && !pending && !running);

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
          <p>{run.participation_reason || "暂无说明"}</p>
          {Object.keys(run.input_snapshot ?? {}).length > 0 && (
            <div className="mt-2 rounded-xl border border-line bg-rice-deep/50 px-3 py-2.5">
              <AgentFactList facts={run.input_snapshot} />
            </div>
          )}
        </Section>

        {pending ? (
          <Section title="待启动">
            <p className="text-ink-soft">该小二尚未启动办理，请耐心等待。</p>
          </Section>
        ) : running ? (
          <Section title="办理中">
            <p className="text-tech">
              <span className="zg-pod-status-dot inline-block mr-2 align-middle" style={{ background: "var(--color-tech)", animation: "zg-pulse 1.4s ease-in-out infinite" }} />
              {agent?.name ?? run.agent_id} 正在办理中，完成后即可查看专业结果。
            </p>
          </Section>
        ) : failed ? (
          <Section title="结果缺失">
            <p className="text-red-300">{run.error_message || output?.summary || "该专业结果暂时不可用"}</p>
            <p className="mt-2 text-ink-soft">
              可返回指挥舱重新运行任务进行重试；综合方案会标注该专业结果缺失。
            </p>
          </Section>
        ) : output ? (
          <>
            <Section title="核心结论">
              <p>{output.summary}</p>
            </Section>

            {interpretation && (
              <Section title={interpretationByQwen ? "AI 解读 · 大模型生成" : "AI 解读 · 规则生成"}>
                <p className="leading-6 text-ink">{interpretation}</p>
              </Section>
            )}

            {Object.keys(output.facts ?? {}).length > 0 && (
              <Section title="关键事实">
                <AgentFactList facts={output.facts} />
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
              <p>{output.impact_on_mission || "暂无说明"}</p>
            </Section>

            <p className="mt-4 text-xs text-ink-soft">
              更新时间：{run.finished_at?.replace("T", " ").slice(0, 19) ?? "未记录"}
            </p>
          </>
        ) : null}
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
