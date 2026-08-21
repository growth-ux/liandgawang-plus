import { useState } from "react";
import { Link } from "react-router-dom";

const tabs = ["全部", "办理中", "待我确认", "已完成", "已终止"];

/** 我的办事：集中管理单小二任务和多小二协作任务（轻占位） */
export default function MyTasks() {
  const [active, setActive] = useState(0);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8">
      <h1 className="text-xl font-semibold">我的办事</h1>
      <p className="mt-1 text-sm text-ink-soft">
        集中查看小二正在办理的事项、待确认内容和历史结果
      </p>

      <div className="mt-5 flex gap-2">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              i === active
                ? "bg-brand font-medium text-white"
                : "border border-line bg-white text-ink-soft hover:text-ink"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-6 flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-white/70 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-faint text-2xl">
          📋
        </span>
        <h2 className="mt-4 text-base font-semibold">暂无{tabs[active]}的办事事项</h2>
        <p className="mt-2 text-sm text-ink-soft">
          从粮掌柜找一位小二开始办事后，任务会出现在这里
        </p>
        <Link
          to="/"
          className="mt-6 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep"
        >
          去粮掌柜找小二
        </Link>
      </div>
    </div>
  );
}
