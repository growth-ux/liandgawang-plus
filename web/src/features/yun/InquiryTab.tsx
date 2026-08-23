import { useCallback, useEffect, useState } from "react";
import { fetchTaskDetail, listInquiries, submitInquiry } from "./api";
import type { InquiryListItem, TaskDetail } from "./types";

const STATUS_LABEL: Record<string, string> = {
  draft: "待用户确认",
  submitted: "已提交",
  feedback: "已反馈",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-amber-400/15 text-amber-300",
  submitted: "bg-brand-soft text-brand-deep",
  feedback: "bg-emerald-400/15 text-emerald-300",
};

/** 询运对接：询运单列表 → 点击进入详情编辑/提交/反馈 */
export default function InquiryTab() {
  const [items, setItems] = useState<InquiryListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // 加载列表
  const reloadList = useCallback(() => {
    setLoading(true);
    listInquiries()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(reloadList, [reloadList]);

  // 加载某条询运单详情
  const loadDetail = useCallback((inqTaskId: number) => {
    fetchTaskDetail(inqTaskId).then((d) => {
      setDetail(d);
      if (d.inquiry) {
        setSelectedId(d.inquiry.id);
        setContent(d.inquiry.content);
      }
    });
  }, []);

  // 返回列表
  const backToList = () => {
    setSelectedId(null);
    setDetail(null);
    reloadList();
  };

  // 提交对接
  const submit = async () => {
    if (!detail?.inquiry) return;
    setBusy(true);
    try {
      await submitInquiry(detail.inquiry.id);
      await loadDetail(detail.task.id);
      reloadList();
    } finally {
      setBusy(false);
    }
  };

  /* ---------- 详情视图 ---------- */
  if (selectedId != null && detail) {
    const inquiry = detail.inquiry;
    if (!inquiry) return null;

    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={backToList}
          className="self-start rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft hover:border-tech hover:text-ink"
        >
          ← 返回列表
        </button>

        <section className="rounded-3xl border border-line bg-panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">标准询运单</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS_TONE[inquiry.status] ?? ""}`}>
              {STATUS_LABEL[inquiry.status] ?? inquiry.status}
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

  /* ---------- 列表视图 ---------- */
  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
        加载中…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-line bg-panel/60 text-sm text-ink-soft">
        还没有询运单。请在「运输方案」选定方案后生成。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="text-base font-semibold">询运单</h2>
        <ul className="mt-3 divide-y divide-line/60">
          {items.map((inq) => {
            const t = inq.task;
            return (
              <li key={inq.id}>
                <button
                  type="button"
                  onClick={() => loadDetail(inq.task_id)}
                  className="flex w-full items-center justify-between py-3 text-left text-sm hover:text-brand-deep"
                >
                  <span>
                    {t
                      ? `${t.origin} → ${t.destination} · ${t.variety_name} ${t.quantity_tons} 吨`
                      : `任务 #${inq.task_id}`}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${STATUS_TONE[inq.status] ?? ""}`}>
                    {STATUS_LABEL[inq.status] ?? inq.status}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
