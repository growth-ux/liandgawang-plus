import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "粮掌柜", end: true },
  { to: "/tasks", label: "我的办事", end: false },
  { to: "/knowledge", label: "企业知识库", end: false },
];

export default function TopNav() {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-line bg-panel">
      <div className="relative mx-auto flex h-full max-w-[1440px] items-center justify-between px-6">
        {/* 品牌标识，点击返回首页 */}
        <NavLink to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-deep text-lg font-semibold text-white shadow-[0_0_14px_rgba(238,123,31,0.45)]">
            粮
          </span>
          <span className="text-lg font-semibold tracking-wide">
            粮达网
            <span className="ml-1 text-brand">Plus</span>
          </span>
        </NavLink>

        {/* 一级入口：绝对定位严格居中 */}
        <nav className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full px-5 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-brand-faint font-semibold text-brand-deep"
                    : "text-ink-soft hover:bg-rice-deep hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* 右侧：消息与头像（竞赛演示用占位） */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="消息"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-rice-deep hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.7 20a2 2 0 0 1-3.4 0" strokeLinecap="round" />
            </svg>
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand" />
          </button>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rice-deep text-sm font-medium text-ink-soft">
            客
          </span>
        </div>
      </div>
    </header>
  );
}
