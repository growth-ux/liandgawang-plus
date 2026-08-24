import { useEffect, useState } from "react";
import type { SharedExperience } from "../features/suan/types";
import { fetchExperiences, updateExperience, ignoreExperience } from "../features/suan/api";

const tabs = [
  "企业业务资料",
  "采购偏好",
  "质量标准",
  "合作供应方",
  "常用运输路线",
  "历史业务方案",
  "采购复盘",
];

/** 企业知识库：沉淀可被各位小二复用的企业业务信息 */
export default function Knowledge() {
  const [active, setActive] = useState(0);
  const [experiences, setExperiences] = useState<SharedExperience[]>([]);
  const [loadingExp, setLoadingExp] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const loadExperiences = async () => {
    setLoadingExp(true);
    setExpError(null);
    try {
      const res = await fetchExperiences();
      setExperiences(res.items);
    } catch (e) {
      setExpError(e instanceof Error ? e.message : "加载经验失败");
    } finally {
      setLoadingExp(false);
    }
  };

  useEffect(() => {
    if (active === 5) loadExperiences();
  }, [active]);

  const handleEdit = async (id: number) => {
    if (!editContent.trim()) return;
    try {
      await updateExperience(id, editContent);
      setEditingId(null);
      loadExperiences();
    } catch (e) {
      setExpError(e instanceof Error ? e.message : "保存失败");
    }
  };

  const handleIgnore = async (id: number) => {
    try {
      await ignoreExperience(id);
      loadExperiences();
    } catch (e) {
      setExpError(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8">
      <h1 className="text-xl font-semibold">企业知识库</h1>
      <p className="mt-1 text-sm text-ink-soft">
        管理企业资料、采购偏好和业务经验，让小二更懂你的业务
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              i === active
                ? "bg-brand font-medium text-white"
                : "border border-line bg-panel text-ink-soft hover:text-ink"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 历史业务方案 Tab */}
      {active === 5 ? (
        <div className="mt-6">
          {expError && (
            <div className="mb-4 flex items-center gap-2">
              <p className="rounded-xl bg-red-900/20 px-4 py-2 text-sm text-red-400">{expError}</p>
              <button onClick={loadExperiences} className="text-xs text-tech hover:text-tech/80">重试</button>
            </div>
          )}

          {loadingExp ? (
            <p className="mt-8 text-center text-sm text-ink-soft">加载中…</p>
          ) : experiences.length === 0 ? (
            <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
              <p className="text-sm text-ink-soft">
                还没有业务经验。完成一笔成本测算后，系统会自动沉淀可复用经验。
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {experiences.map((exp) => (
                <div key={exp.id} className="rounded-2xl border border-line bg-panel/70 p-4">
                  {editingId === exp.id ? (
                    <div className="flex gap-2">
                      <input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="flex-1 rounded-lg border border-line bg-rice-deep px-3 py-1.5 text-sm text-ink outline-none focus:border-brand"
                      />
                      <button
                        onClick={() => handleEdit(exp.id)}
                        className="rounded-full bg-brand px-4 py-1.5 text-xs text-white"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm">{exp.content}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-ink-soft">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            exp.source_type === "zhanggui"
                              ? "bg-brand-soft text-brand-deep"
                              : "bg-tech/10 text-tech"
                          }`}
                        >
                          {exp.source_type === "zhanggui" ? "粮掌柜办事经验" : "成本测算经验"}
                        </span>
                        <span>来源记录 #{exp.source_record_id}</span>
                        <span>{exp.created_at?.slice(0, 10)}</span>
                        {exp.tags.map((t) => (
                          <span key={t} className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[10px] text-violet-300">
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => { setEditingId(exp.id); setEditContent(exp.content); }}
                          className="text-xs text-tech hover:text-tech/80"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleIgnore(exp.id)}
                          className="text-xs text-ink-soft hover:text-red-400"
                        >
                          忽略
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-faint text-2xl">
            📚
          </span>
          <h2 className="mt-4 text-base font-semibold">「{tabs[active]}」还没有内容</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
            沉淀的企业信息可被各位小二在服务过程中参考，你也可以随时查看、修正或停用
          </p>
        </div>
      )}
    </div>
  );
}
