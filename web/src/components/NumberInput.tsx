/**
 * 全站公共数字输入框：隐藏原生白色上下箭头，将步进按钮嵌入输入框内部，
 * 与深色输入框视觉融合。后续所有数字输入统一使用该组件。
 */
export default function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const clamp = (n: number) =>
    Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

  // 按 step 的小数位数取整，避免浮点误差（如 0.1 + 0.2）
  const decimals = String(step).split(".")[1]?.length ?? 0;

  const apply = (delta: number) => {
    const base = Number(value);
    const start = Number.isFinite(base) && value !== "" ? base : (min ?? 0);
    onChange(String(Number(clamp(start + delta).toFixed(decimals))));
  };

  const btnCls =
    "flex flex-1 items-center justify-center px-1.5 text-ink-soft transition-colors hover:bg-rice-deep hover:text-tech disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-soft";

  return (
    <div
      className={`flex w-full items-stretch overflow-hidden rounded-xl border border-line bg-rice transition-colors focus-within:border-tech ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        className="w-full min-w-0 bg-transparent px-3.5 py-2 text-sm text-ink placeholder:text-ink-soft/50 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <div className="flex shrink-0 flex-col border-l border-line">
        <button
          type="button"
          tabIndex={-1}
          aria-label="增加"
          disabled={disabled}
          onClick={() => apply(step)}
          className={`${btnCls} border-b border-line`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-2.5 w-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="m6 15 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="减少"
          disabled={disabled}
          onClick={() => apply(-step)}
          className={btnCls}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-2.5 w-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
