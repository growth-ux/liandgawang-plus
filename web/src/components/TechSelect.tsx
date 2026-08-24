import { useEffect, useId, useRef, useState } from "react";

export interface TechSelectOption {
  value: string;
  label: string;
}

interface TechSelectProps {
  label: string;
  value: string;
  options: TechSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** 深空科技风单选器：统一替代浏览器原生 select，并保留完整键盘操作。 */
export default function TechSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "请选择",
  className = "",
}: TechSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (open) setActiveIndex(Math.max(0, selectedIndex));
  }, [open, selectedIndex]);

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) return;
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + step + options.length) % options.length);
    } else if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      if (options.length === 0) return;
      setActiveIndex(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      if (options.length === 0) return;
      setActiveIndex(options.length - 1);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <span className="mb-1.5 block text-[11px] font-medium tracking-[0.04em] text-ink-soft">
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-activedescendant={open && options.length > 0 ? `${menuId}-${activeIndex}` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className={`group flex h-11 w-full items-center justify-between gap-3 rounded-xl border px-3.5 text-left text-sm outline-none transition-all duration-200 ${
          open
            ? "border-tech/55 bg-rice-deep shadow-[0_0_0_3px_rgba(34,211,238,0.08),0_12px_30px_rgba(0,0,0,0.24)]"
            : "border-line bg-rice/75 hover:border-tech/30 hover:bg-rice-deep/80 focus-visible:border-tech/55 focus-visible:shadow-[0_0_0_3px_rgba(34,211,238,0.08)]"
        }`}
      >
        <span className="flex min-w-0 items-center">
          <span className={`truncate ${selectedOption ? "text-ink" : "text-ink-soft/70"}`}>
            {selectedOption?.label ?? placeholder}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`h-4 w-4 shrink-0 text-ink-soft transition-transform duration-200 group-hover:text-tech ${open ? "rotate-180 text-tech" : ""}`}
        >
          <path d="m5.5 7.75 4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="listbox"
          aria-label={label}
          className="ld-select-menu absolute left-0 right-0 top-full z-[70] mt-2 overflow-hidden rounded-2xl border border-tech/20 bg-[#101a31]/95 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.48),0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1 text-[10px] tracking-[0.12em] text-ink-soft/70">
            <span>选择{label}</span>
            <span>{options.length} 项</span>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {options.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-ink-soft">选项加载中…</div>
            )}
            {options.map((option, index) => {
              const selected = option.value === value;
              const active = index === activeIndex;
              return (
                <button
                  id={`${menuId}-${index}`}
                  key={option.value || "__empty"}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(index)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    selected
                      ? "bg-brand-faint text-brand-deep"
                      : active
                        ? "bg-tech/10 text-ink"
                        : "text-ink-soft hover:bg-tech/10 hover:text-ink"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {selected && (
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-brand">
                      <path d="m4.5 10.25 3.25 3.25 7.75-7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
