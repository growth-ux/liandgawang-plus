import { useEffect, useState } from "react";
import { fetchAnalysisList } from "./api";
import { ACTION_LABELS, ACTION_TONE } from "./ProcurementAnalysisTab";
import type { AnalysisRecord } from "./types";

function fmtCreatedAt(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16).replace("T", " ");
}

function EvidenceBlock({
  title,
  items,
  dot,
}: {
  title: string;
  items: string[];
  dot: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-ink-soft">{title}</div>
      <ul className="flex flex-col gap-1">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-xs leading-5 text-ink">
            <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${dot}`} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecordCard({
  record,
  onReuse,
}: {
  record: AnalysisRecord;
  onReuse: (r: AnalysisRecord) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const conditionTags = [
    record.grade && `等级 ${record.grade}`,
    record.target_region && `目标 ${record.target_region}`,
    record.budget_price && `预算 ${record.budget_price} 元/吨`,
    record.stock_days !== null && `库存可用 ${record.stock_days} 天`,
    record.risk_preference && `偏好 ${record.risk_preference}`,
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-2xl border border-line bg-panel">
      {/* 头部：摘要行 */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-rice-deep/40"
      >
        <span className="text-sm font-semibold text-ink">
          {record.variety_name} {record.quantity_tons} 吨
        </span>
        <span className="text-xs text-ink-soft">
          最晚 {record.deadline_date}
        </span>
        <span
          className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${ACTION_TONE[record.action]}`}
        >
          {ACTION_LABELS[record.action]}
        </span>
        {record.ratio_low !== null && record.ratio_high !== null && (
          <span className="text-xs text-ink">
            首批{" "}
            <span className="font-semibold text-tech">
              {record.ratio_low}%~{record.ratio_high}%
            </span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          <span className="text-xs text-ink-soft">
            {fmtCreatedAt(record.created_at)}
          </span>
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 text-ink-soft transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {/* 展开：条件快照 + 结论详情 */}
      {expanded && (
        <div className="flex flex-col gap-4 border-t border-line px-5 py-4">
          {/* 条件快照 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-soft">采购条件：</span>
            {conditionTags.length > 0 ? (
              conditionTags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-line bg-rice-deep/60 px-2.5 py-0.5 text-xs text-ink"
                >
                  {t}
                </span>
              ))
            ) : (
              <span className="text-xs text-ink-soft">仅必填条件</span>
            )}
            {record.remark && (
              <span className="text-xs text-ink-soft">备注：{record.remark}</span>
            )}
          </div>

          {/* 结论 + 时间窗 */}
          <div className="rounded-xl border border-line bg-rice-deep/60 px-4 py-3">
            <p className="text-sm leading-6 text-ink">{record.summary}</p>
            {record.time_window && (
              <p className="mt-1.5 text-xs text-ink-soft">
                时间窗口：{record.time_window}
              </p>
            )}
          </div>

          {/* 大模型解读 */}
          {record.interpretation && (
            <div className="rounded-xl border border-tech/30 bg-tech/5 px-4 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-semibold text-tech">
                  瞻小二综合解读
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    record.ai_source === "qwen"
                      ? "bg-tech/15 text-tech"
                      : "bg-rice-deep text-ink-soft"
                  }`}
                >
                  {record.ai_source === "qwen"
                    ? "Qwen 大模型生成"
                    : "规则引擎生成"}
                </span>
              </div>
              <p className="text-sm leading-6 text-ink">
                {record.interpretation}
              </p>
            </div>
          )}

          {/* 证据 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <EvidenceBlock
              title="支持依据"
              items={record.supporting}
              dot="bg-emerald-400"
            />
            <EvidenceBlock
              title="反对依据与不确定因素"
              items={record.opposing}
              dot="bg-red-400"
            />
            <EvidenceBlock
              title="失效条件"
              items={record.invalidation}
              dot="bg-amber-400"
            />
            <EvidenceBlock
              title="继续观察指标"
              items={record.watch_metrics}
              dot="bg-tech"
            />
          </div>

          {/* 操作 */}
          <div className="flex items-center justify-end border-t border-line pt-3">
            <button
              type="button"
              onClick={() => onReuse(record)}
              className="rounded-xl border border-tech/40 px-4 py-2 text-sm text-tech transition-colors hover:bg-tech/10"
            >
              按此条件再次研判
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalysisRecordsTab({
  onReuse,
}: {
  onReuse: (r: AnalysisRecord) => void;
}) {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAnalysisList()
      .then((d) => {
        if (!cancelled) setRecords(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">研判记录</span>
        <span className="text-xs text-ink-soft">
          重新研判会新建记录，历史研判不会被覆盖
        </span>
      </div>

      {error ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-line bg-panel/60 text-center">
          <p className="text-sm text-red-400">记录加载失败：{error}</p>
          <p className="mt-2 text-xs text-ink-soft">
            请确认后端服务已启动。
          </p>
        </div>
      ) : loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-tech" />
            正在读取研判记录…
          </div>
        </div>
      ) : records.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-line bg-panel/60 text-center">
          <p className="text-sm text-ink-soft">还没有保存过研判</p>
          <p className="mt-2 max-w-md text-xs leading-5 text-ink-soft/70">
            到「采购研判」输入采购条件生成建议，确认后点击「保存研判」，
            这里会保留每次研判的条件与结论快照。
          </p>
        </div>
      ) : (
        records.map((r) => (
          <RecordCard key={r.id} record={r} onReuse={onReuse} />
        ))
      )}
    </div>
  );
}
