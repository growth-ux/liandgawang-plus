import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const THEME_OPTIONS = [
  { value: "deep-space-presentation", label: "深空橙·讲解", group: "featured", mode: "dark", preview: "#ff8a1f", swatches: ["#0c1526", "#223653", "#ff8a1f", "#62e5f7"] },
  { value: "presentation-cyan", label: "科技青蓝·演示", group: "featured", mode: "light", preview: "#176b75", swatches: ["#f3f6f7", "#ffffff", "#176b75", "#1687a0"] },
  { value: "deep-space", label: "深空橙", group: "featured", mode: "dark", preview: "#ee7b1f", swatches: ["#0b1220", "#131c36", "#ee7b1f", "#22d3ee"] },
  { value: "cloud-sky", label: "云穹蓝", group: "featured", mode: "light", preview: "#0b7185", swatches: ["#f3f6fb", "#ffffff", "#b9540a", "#0b7185"] },
  { value: "black-gold", label: "曜石黑金", group: "featured", mode: "dark", preview: "#d4af37", swatches: ["#090806", "#1b170e", "#a16207", "#f0d98b"] },
  { value: "vivid-indigo", label: "活力靛蓝", group: "featured", mode: "light", preview: "#4338ca", swatches: ["#eef2ff", "#ffffff", "#4338ca", "#4338ca"] },
  { value: "mist-violet", label: "雾紫", group: "featured", mode: "light", preview: "#6d28d9", swatches: ["#f6f3ff", "#ffffff", "#6d28d9", "#6d28d9"] },
  { value: "orbit-silver", label: "轨道银橙", group: "projection", mode: "light", preview: "#b84d0b", swatches: ["#edf1f5", "#ffffff", "#b84d0b", "#16697a"] },
  { value: "command-white", label: "指挥舱白蓝", group: "projection", mode: "light", preview: "#b84d0b", swatches: ["#eff3f8", "#ffffff", "#b84d0b", "#164e79"] },
  { value: "porcelain-blue", label: "瓷白蓝橙", group: "projection", mode: "light", preview: "#c2410c", swatches: ["#f5f8fa", "#ffffff", "#c2410c", "#075985"] },
  { value: "steel-mist", label: "钢雾青橙", group: "projection", mode: "light", preview: "#b84d0b", swatches: ["#eef3f3", "#ffffff", "#b84d0b", "#236b6b"] },
  { value: "solar-white", label: "曜日白", group: "projection", mode: "light", preview: "#a83d08", swatches: ["#f6f6f4", "#ffffff", "#a83d08", "#1f5d73"] },

  { value: "sunrise-orange", label: "晨曦橙", group: "warm", mode: "light", preview: "#b45309", swatches: ["#fff7f0", "#fffdfb", "#b45309", "#075985"] },
  { value: "rose-mist", label: "樱雾红", group: "warm", mode: "light", preview: "#be123c", swatches: ["#fff3f6", "#fffdfd", "#be123c", "#9d174d"] },
  { value: "sand-gold", label: "沙金", group: "warm", mode: "light", preview: "#a16207", swatches: ["#faf7ef", "#fffdf8", "#a16207", "#0f766e"] },
  { value: "amber-night", label: "琥珀金", group: "warm", mode: "dark", preview: "#d97706", swatches: ["#171006", "#30230e", "#b45309", "#67e8f9"] },
  { value: "paper", label: "纸感米白", group: "warm", mode: "light", preview: "#9a3412", swatches: ["#f7f2e8", "#fffcf5", "#9a3412", "#3f6212"] },
  { value: "copper-paper", label: "赤铜纸白", group: "projection", mode: "light", preview: "#a94716", swatches: ["#f8f1ec", "#fffdfa", "#a94716", "#236a72"] },
  { value: "kiln-red", label: "窑火红", group: "projection", mode: "light", preview: "#a93f2b", swatches: ["#fbf2ef", "#fffdfc", "#a93f2b", "#176b68"] },
  { value: "wheat-field", label: "麦田金", group: "projection", mode: "light", preview: "#8f5d05", swatches: ["#f9f6e9", "#fffef8", "#8f5d05", "#426642"] },
  { value: "clay-slate", label: "陶土岩灰", group: "projection", mode: "light", preview: "#a84b2f", swatches: ["#f5f1ef", "#fffdfc", "#a84b2f", "#3f6473"] },
  { value: "wine-ivory", label: "酒红象牙", group: "projection", mode: "light", preview: "#8e2942", swatches: ["#faf3f4", "#fffdfd", "#8e2942", "#315f78"] },

  { value: "celadon", label: "青瓷绿", group: "fresh", mode: "light", preview: "#0f766e", swatches: ["#f0f8f3", "#fbfefc", "#0f766e", "#047857"] },
  { value: "sea-salt", label: "海盐青", group: "fresh", mode: "light", preview: "#0e7490", swatches: ["#eef9fb", "#fcfeff", "#0e7490", "#0e7490"] },
  { value: "glacier", label: "冰川灰", group: "fresh", mode: "light", preview: "#334155", swatches: ["#f4f7f9", "#ffffff", "#334155", "#0369a1"] },
  { value: "aurora-cyan", label: "极光青", group: "fresh", mode: "dark", preview: "#2dd4bf", swatches: ["#061416", "#0d292d", "#0f8f83", "#5eead4"] },
  { value: "jade-night", label: "墨玉绿", group: "fresh", mode: "dark", preview: "#22c55e", swatches: ["#07140e", "#112b1d", "#15803d", "#5eead4"] },
  { value: "pine-fog", label: "松雾绿", group: "projection", mode: "light", preview: "#276749", swatches: ["#eff5f1", "#fbfdfb", "#276749", "#187c82"] },
  { value: "ocean-mist", label: "海湾雾蓝", group: "projection", mode: "light", preview: "#0b6e69", swatches: ["#eef7f7", "#fcffff", "#0b6e69", "#0e7490"] },
  { value: "mint-white", label: "薄荷白", group: "projection", mode: "light", preview: "#276749", swatches: ["#f0f7f4", "#fcfffd", "#276749", "#12716b"] },
  { value: "ice-lake", label: "冰湖蓝", group: "projection", mode: "light", preview: "#176c8a", swatches: ["#eef6f9", "#fcfeff", "#176c8a", "#238a91"] },
  { value: "bamboo-white", label: "竹影白", group: "projection", mode: "light", preview: "#3f6b31", swatches: ["#f3f6ef", "#fffefb", "#3f6b31", "#27736d"] },

  { value: "nebula-violet", label: "星云紫", group: "atmosphere", mode: "dark", preview: "#8b5cf6", swatches: ["#0f0b1a", "#211735", "#7c3aed", "#c4b5fd"] },
  { value: "night-blue", label: "夜航蓝", group: "atmosphere", mode: "dark", preview: "#3b82f6", swatches: ["#071321", "#122a45", "#2563eb", "#38bdf8"] },
  { value: "crimson-night", label: "赤焰红", group: "atmosphere", mode: "dark", preview: "#e11d48", swatches: ["#170911", "#311522", "#be123c", "#f9a8d4"] },
  { value: "graphite", label: "石墨银", group: "atmosphere", mode: "dark", preview: "#94a3b8", swatches: ["#101214", "#22272d", "#475569", "#cbd5e1"] },
  { value: "executive-navy", label: "商务藏蓝", group: "atmosphere", mode: "dark", preview: "#2563eb", swatches: ["#06101e", "#102640", "#1d4ed8", "#67e8f9"] },
  { value: "cobalt-frost", label: "钴蓝霜白", group: "projection", mode: "light", preview: "#2848a8", swatches: ["#eef3ff", "#ffffff", "#2848a8", "#0b7185"] },
  { value: "lunar-paper", label: "月岩白", group: "projection", mode: "light", preview: "#8a4f1c", swatches: ["#f4f5f6", "#ffffff", "#8a4f1c", "#475569"] },
  { value: "plum-mist", label: "梅雾白", group: "projection", mode: "light", preview: "#8a3f6a", swatches: ["#f8f2f8", "#fffdfd", "#8a3f6a", "#416782"] },
  { value: "mars-sand", label: "火星浅沙", group: "projection", mode: "light", preview: "#a74428", swatches: ["#fbf1eb", "#fffdfb", "#a74428", "#526b78"] },
  { value: "polar-frost", label: "极地霜蓝", group: "projection", mode: "light", preview: "#0e6f82", swatches: ["#eef7f9", "#fcffff", "#0e6f82", "#287181"] },
] as const;

export const THEME_GROUP_LABELS = {
  featured: "网站精选",
  projection: "投屏浅色",
  warm: "橙黄暖色",
  fresh: "清爽浅色",
  atmosphere: "氛围深色",
} as const;

export const THEME_GROUP_DESCRIPTIONS = {
  featured: "兼顾品牌辨识与演示效果，深空橙·讲解版更适合现场投屏。",
  projection: "专为 PPT 截图、会议室投影和现场讲解设计的高亮度浅色主题。",
  warm: "温暖、亲和且醒目，适合业务讲解和重点信息呈现。",
  fresh: "清透低压的色彩关系，适合长时间阅读与投屏展示。",
  atmosphere: "沉浸感更强的深色方案，保留数字化与科技氛围。",
} as const;

export type AppTheme = (typeof THEME_OPTIONS)[number]["value"];
export type ThemeMode = (typeof THEME_OPTIONS)[number]["mode"];
export type ThemeGroup = (typeof THEME_OPTIONS)[number]["group"];

const STORAGE_KEY = "liangda-theme";
const DEFAULT_THEME: AppTheme = "deep-space";

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return THEME_OPTIONS.some((option) => option.value === value);
}

export function getThemeDefinition(theme: AppTheme) {
  return THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];
}

function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark") return "deep-space";
  if (stored === "light") return "cloud-sky";
  return isAppTheme(stored) ? stored : DEFAULT_THEME;
}

export function applyTheme(theme: AppTheme) {
  const definition = getThemeDefinition(theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeMode = definition.mode;
  document.documentElement.style.colorScheme = definition.mode;
}

/** 在 React 挂载前恢复主题，避免刷新时出现颜色闪烁。 */
export function initializeTheme(): AppTheme {
  const theme = readStoredTheme();
  applyTheme(theme);
  return theme;
}

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const current = document.documentElement.dataset.theme;
    return isAppTheme(current) ? current : readStoredTheme();
  });

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    // 先更新 DOM 主题，再触发组件渲染，确保 ECharts 读取到新色板。
    applyTheme(nextTheme);
    setThemeState(nextTheme);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme }),
    [setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return context;
}

export type ThemePalette = {
  surface: string;
  surfaceMuted: string;
  text: string;
  muted: string;
  line: string;
  grid: string;
  tech: string;
  techArea: string;
  mapArea: string;
  mapEmphasis: string;
};

function withAlpha(color: string, alpha: number): string {
  const hex = color.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const parts = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

/** ECharts 画布无法继承 CSS，自当前主题的语义色生成画布色板。 */
export function readThemePalette(): ThemePalette {
  const styles = getComputedStyle(document.documentElement);
  const value = (name: string) => styles.getPropertyValue(name).trim();
  const surface = value("--color-panel");
  const surfaceMuted = value("--color-rice-deep");
  const text = value("--color-ink");
  const muted = value("--color-ink-soft");
  const line = value("--color-line");
  const tech = value("--color-tech");
  return {
    surface,
    surfaceMuted,
    text,
    muted,
    line,
    grid: withAlpha(muted, 0.16),
    tech,
    techArea: withAlpha(tech, 0.2),
    mapArea: surfaceMuted,
    mapEmphasis: withAlpha(tech, 0.18),
  };
}
