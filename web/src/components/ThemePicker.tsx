import { useEffect, useRef, useState } from "react";
import {
  getThemeDefinition,
  THEME_GROUP_DESCRIPTIONS,
  THEME_GROUP_LABELS,
  THEME_OPTIONS,
  useTheme,
  type ThemeGroup,
} from "../theme/ThemeContext";

const themeGroups: ThemeGroup[] = ["featured", "projection", "warm", "fresh", "atmosphere"];

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 1.2-3.15 1.8 1.8 0 0 1 1.2-3.15H18A3 3 0 0 0 21 12a9 9 0 0 0-9-9Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="6.8" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="m5 10 3.2 3.2L15 6.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ThemeMiniPreview({ swatches }: { swatches: readonly string[] }) {
  const [canvas, panel, brand, tech] = swatches;

  return (
    <div
      className="theme-card-preview h-[76px] overflow-hidden rounded-[10px] p-2"
      style={{ backgroundColor: canvas }}
      aria-hidden
    >
      <div className="h-full rounded-[7px] p-2 shadow-sm" style={{ backgroundColor: panel }}>
        <div className="mb-2 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brand }} />
          <span className="h-1 w-8 rounded-full opacity-50" style={{ backgroundColor: tech }} />
        </div>
        <div className="grid h-[34px] grid-cols-[1.2fr_0.8fr] gap-1.5">
          <span className="rounded-[5px] opacity-90" style={{ background: `linear-gradient(135deg, ${brand}, ${tech})` }} />
          <span className="flex flex-col justify-center gap-1 rounded-[5px] px-1.5" style={{ backgroundColor: canvas }}>
            <i className="h-1 w-full rounded-full not-italic opacity-70" style={{ backgroundColor: tech }} />
            <i className="h-1 w-2/3 rounded-full not-italic opacity-40" style={{ backgroundColor: brand }} />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const currentTheme = getThemeDefinition(theme);
  const [isOpen, setIsOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<ThemeGroup>(currentTheme.group);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const togglePicker = () => {
    if (!isOpen) setActiveGroup(currentTheme.group);
    setIsOpen((open) => !open);
  };

  const visibleThemes = THEME_OPTIONS.filter((option) => option.group === activeGroup);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={togglePicker}
        className="theme-picker-trigger flex h-9 items-center gap-2 rounded-full border border-line bg-rice-deep px-2.5 text-ink-soft outline-none transition hover:border-tech/40 hover:text-ink focus-visible:ring-2 focus-visible:ring-tech/40"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="切换界面主题"
      >
        <PaletteIcon />
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-panel"
          style={{ backgroundColor: currentTheme.preview }}
          aria-hidden
        />
        <span className="max-w-20 truncate text-[11px] font-medium text-ink xl:max-w-24">{currentTheme.label}</span>
        <svg
          viewBox="0 0 20 20"
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <section
          className="theme-picker-panel absolute right-0 top-[calc(100%+0.65rem)] z-[80] w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_24px_70px_var(--app-shadow)]"
          role="dialog"
          aria-label="选择界面主题"
        >
          <div className="border-b border-line bg-rice p-2.5 pb-0">
            <div className="grid grid-cols-5 gap-1 rounded-xl bg-rice-deep p-1" role="tablist" aria-label="主题分类">
              {themeGroups.map((group) => {
                const count = THEME_OPTIONS.filter((option) => option.group === group).length;
                const active = group === activeGroup;
                return (
                  <button
                    key={group}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveGroup(group)}
                    className={`min-w-0 rounded-lg px-1.5 py-2 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tech/40 sm:text-xs ${
                      active
                        ? "border border-line bg-panel font-semibold text-ink shadow-sm"
                        : "border border-transparent text-ink-soft hover:bg-panel/60 hover:text-ink"
                    }`}
                  >
                    <span className="truncate">{THEME_GROUP_LABELS[group]}</span>
                    <span className="ml-1 text-[10px] font-normal opacity-65">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-start justify-between gap-4 px-1 py-3">
              <p className="text-xs leading-5 text-ink-soft">{THEME_GROUP_DESCRIPTIONS[activeGroup]}</p>
              <span className="shrink-0 rounded-full bg-brand-faint px-2 py-1 text-[10px] font-medium text-brand-deep">
                {visibleThemes.length} 套
              </span>
            </div>
          </div>

          <div className="theme-picker-scroll grid max-h-[420px] grid-cols-2 gap-2.5 overflow-y-auto p-3">
            {visibleThemes.map((option) => {
              const selected = option.value === theme;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={`group rounded-xl border p-1.5 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-tech/40 ${
                    selected
                      ? "border-brand bg-brand-faint shadow-[0_0_0_1px_var(--color-brand)]"
                      : "border-line bg-rice hover:-translate-y-0.5 hover:border-tech/40 hover:shadow-md"
                  }`}
                  aria-pressed={selected}
                  title={`切换为${option.label}`}
                >
                  <ThemeMiniPreview swatches={option.swatches} />
                  <span className="flex items-center justify-between gap-2 px-1.5 pb-1 pt-2">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <strong className="block min-w-0 truncate text-xs font-semibold text-ink">{option.label}</strong>
                        {option.value === "deep-space-presentation" && (
                          <em className="shrink-0 rounded-full bg-tech/10 px-1.5 py-0.5 text-[9px] font-semibold not-italic text-tech">
                            投屏推荐
                          </em>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-ink-soft">{option.mode === "light" ? "亮色界面" : "深色界面"}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="flex -space-x-1" aria-hidden>
                        {option.swatches.map((color, index) => (
                          <i
                            key={`${color}-${index}`}
                            className="h-3.5 w-3.5 rounded-full border border-white/30 not-italic shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                      {selected && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                          <CheckIcon />
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
