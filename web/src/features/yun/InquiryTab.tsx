import { useCallback, useEffect, useState } from "react";
import { fetchTaskDetail, submitInquiry } from "./api";
import type { TaskDetail } from "./types";

interface Props {
  taskId: number | null;
}

/** 询运对接：标准询运单编辑 + 提交人工对接 + 反馈展示 */
export default function InquiryTab({ taskId }: Props) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (taskId == null) return;
    fetchTaskDetail(taskId).then((d) => {
      setDetail(d);
      if (d.inquiry) setContent(d.inquiry.content);
    });
  }, [taskId]);

  useEffect(load, [load]);

  if (taskId == null || !detail) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
        请先在「运输方案」选定方案并生成询运单。
      </div>
    );
  }
  const inquiry = detail.inquiry;
  if (!inquiry) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
        还没有询运单。请在「运输方案」选定方案后生成。
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      await submitInquiry(inquiry.id);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border border-line bg-panel p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">标准询运单</h2>
          <span className="text-xs text-ink-soft">
            状态：{inquiry.status === "draft" ? "待用户确认" : inquiry.status === "feedback" ? "已反馈" : "已提交"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.entries(content).map(([k, v]) => (
            <label key={k} className="block text-xs">
              <span className="text-ink-soft">{k}</span>
              <input
                value={v}
                disabled={inquiry.status !== "draft"}
                onChange={(e) => setContent((c) => ({ ...c, [k]: e.target.value }))}
                className="mt-1 h-10 w-full rounded-xl border border-line bg-rice px-3 text-sm text-ink disabled:opacity-60"
              />
            </label>
          ))}
        </div>
        {inquiry.status === "draft" && (
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-5 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            确认并提交人工对接
          </button>
        )}
        <p className="mt-2 text-[11px] text-ink-soft">
          提交后进入人工对接流程，不代表承运方已接单或运力已锁定。
        </p>
      </section>

      {inquiry.feedback && (
        <section className="rounded-3xl border border-emerald-500/40 bg-panel p-6">
          <h3 className="text-sm font-semibold">人工反馈</h3>
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            {Object.entries(inquiry.feedback).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-ink-soft">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
