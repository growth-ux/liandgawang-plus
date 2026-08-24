import { useEffect, useRef, useState } from "react";
import { createMission, fetchMission, fetchMissions, previewGoal } from "./api";
import type { MissionSnapshot, MissionSummary } from "./types";
import { STATUS_LABELS } from "./types";

const DEMO_EXAMPLE = "未来15天采购200吨二等玉米到潍坊，不能影响生产";

interface MissionStartProps {
  onCreated(next: MissionSnapshot): void;
  onOpenMission(next: MissionSnapshot): void;
  onOpenHistory(): void;
}

/** 新任务首页：自然语言目标输入、资料粘贴/上传与最近任务入口。 */
export default function MissionStart({ onCreated, onOpenMission, onOpenHistory }: MissionStartProps) {
  const [text, setText] = useState(DEMO_EXAMPLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<MissionSummary[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMissions()
      .then((items) => setRecents(items.slice(0, 4)))
      .catch(() => setRecents([]));
  }, []);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setText((prev) => `${prev.trim()}\n${content.trim()}`.trim());
    } catch {
      setError("资料读取失败，请直接粘贴文本");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const preview = await previewGoal(trimmed);
      const mission = await createMission(trimmed, preview.goal, preview.memory_references);
      onCreated(mission);
    } catch (err) {
      setError(err instanceof Error ? err.message : "目标解析失败，请稍后重试");
      setBusy(false);
    }
  }

  function openRecent(item: MissionSummary) {
    fetchMission(item.id).then(onOpenMission).catch(() => setError("任务打开失败"));
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 py-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs tracking-[0.3em] text-tech">LIANG-ZHANGGUI · 任务主理人</p>
          <h1 className="mt-2 text-2xl font-semibold">粮掌柜｜复杂采购指挥舱</h1>
          <p className="mt-2 text-sm text-ink-soft">
            描述你的采购目标，粮掌柜负责组队、并行办理、冲突会商，并在关键节点等你拍板。
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenHistory}
          className="rounded-full border border-line bg-panel px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          历史任务
        </button>
      </div>

      <div className="mt-8 rounded-3xl border border-line bg-panel p-6">
        <label className="text-sm font-medium">采购目标</label>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          placeholder="例如：未来15天采购200吨二等玉米到潍坊，不能影响生产；也可以直接粘贴报价或采购计划…"
          className="mt-3 w-full resize-none rounded-2xl border border-line bg-rice px-4 py-3 text-sm leading-6 text-ink placeholder:text-ink-soft/60 focus:border-tech/60 focus:outline-none"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || !text.trim()}
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
          >
            {busy ? "正在理解目标…" : "让粮掌柜开始拆解"}
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-full border border-dashed border-line px-4 py-2 text-xs text-ink-soft transition-colors hover:text-ink"
          >
            附加资料（.txt / .csv / .md）
          </button>
          <button
            type="button"
            onClick={() => setText(DEMO_EXAMPLE)}
            className="text-xs text-tech/80 underline-offset-4 hover:underline"
          >
            填入示例：200 吨玉米补库
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.csv,.md"
            className="hidden"
            onChange={handleFile}
          />
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>

      {recents.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-ink-soft">最近任务</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {recents.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openRecent(item)}
                className="rounded-2xl border border-line bg-panel/70 px-4 py-3 text-left transition-colors hover:border-tech/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="shrink-0 rounded-full bg-rice-deep px-2.5 py-0.5 text-xs text-tech">
                    {STATUS_LABELS[item.status]}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-ink-soft">
                  {item.mission_code} · 更新于 {item.updated_at?.slice(0, 16).replace("T", " ") ?? "—"}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
