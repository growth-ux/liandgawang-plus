import { useState } from "react";

const tabs = [
  "企业业务资料",
  "采购偏好",
  "质量标准",
  "合作供应方",
  "常用运输路线",
  "历史业务方案",
  "采购复盘",
];

/** 企业知识库：沉淀可被各位小二复用的企业业务信息（轻占位） */
export default function Knowledge() {
  const [active, setActive] = useState(0);

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

      <div className="mt-6 flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-faint text-2xl">
          📚
        </span>
        <h2 className="mt-4 text-base font-semibold">「{tabs[active]}」还没有内容</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
          沉淀的企业信息可被各位小二在服务过程中参考，你也可以随时查看、修正或停用
        </p>
      </div>
    </div>
  );
}
