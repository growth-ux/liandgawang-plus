import { useRef } from "react";

interface StartInputProps {
  text: string;
  onChange(value: string): void;
  onSubmit(): void;
  busy: boolean;
  error: string | null;
  onFillExample(): void;
}

/** 目标输入卡片：自然语言输入 + 附加资料 + 提交按钮 */
export default function StartInput({
  text,
  onChange,
  onSubmit,
  busy,
  error,
  onFillExample,
}: StartInputProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      onChange(`${text.trim()}\n${content.trim()}`.trim());
    } catch {
      /* 资料读取失败静默忽略 */
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="zg-start-input">
      <div className="zg-start-input-label">
        <span className="zg-start-input-label-left">采购目标</span>
        <span className="zg-start-input-hint">支持自然语言描述，也可粘贴报价单 / 采购计划</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="例如：未来15天采购200吨二等玉米到潍坊，不能影响生产"
        className="zg-start-input-textarea"
      />
      <div className="zg-start-input-footer">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="zg-start-input-attach"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          附加资料
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.csv,.md"
          className="hidden"
          onChange={handleFile}
        />
        <div className="zg-start-input-actions">
          <button type="button" onClick={onFillExample} className="zg-start-input-example-link">
            填入示例
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !text.trim()}
            className="zg-start-submit-btn"
          >
            {busy ? "正在理解目标…" : "开始办理"}
          </button>
        </div>
      </div>
      {error && <p className="zg-start-input-error">{error}</p>}
    </div>
  );
}
