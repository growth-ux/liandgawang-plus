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
        className="flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm text-ink transition-colors hover:border-brand hover:text-brand-deep"
      >
        切换小二
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
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
                      current ? "bg-brand-faint" : "hover:bg-rice"
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
