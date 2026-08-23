import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { agents } from "../data/agents";
import AgentAvatar from "./AgentAvatar";

/** 切换小二：展开七位小二及动作化服务说明，标记当前角色 */
export default function AgentSwitcher({ currentId }: { currentId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 rounded-full border border-brand/30 bg-gradient-to-r from-brand-faint/90 to-panel px-4 py-2 text-sm text-ink shadow-[0_0_18px_rgba(238,123,31,0.12)] transition-all hover:border-brand/60 hover:shadow-[0_0_22px_rgba(238,123,31,0.3)] active:scale-[0.97]"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
        </span>
        切换小二
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 text-ink-soft transition-transform duration-300 ${
            open ? "rotate-180 text-brand" : "group-hover:text-brand"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
          <ul className="py-1.5">
            {agents.map((agent) => {
              const current = agent.id === currentId;
              return (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate(`/agent/${agent.id}`);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      current ? "bg-brand-faint" : "hover:bg-rice-deep"
                    }`}
                  >
                    <AgentAvatar agent={agent} size={32} />
                    <span className="flex-1">
                      <span className={`block text-sm ${current ? "font-semibold text-brand-deep" : "text-ink"}`}>
                        {agent.name}｜{agent.action}
                      </span>
                      <span className="block text-xs text-ink-soft">{agent.role}</span>
                    </span>
                    {current && <span className="text-sm text-brand">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
