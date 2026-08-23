// web/src/features/liang/NeedInputBar.tsx
import { useState } from "react";
import { parseNeed } from "./parseNeed";
import type { NeedInput } from "./types";

export default function NeedInputBar({ onSubmit }: { onSubmit: (need: NeedInput, raw: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSubmit(parseNeed(text), text);
        setText("");
      }}
      className="flex items-center gap-3"
    >
      <span className="shrink-0 text-sm font-medium text-ink">我要找粮</span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="描述你的采购需求，如：120吨二等玉米，7天内可发"
        className="h-11 flex-1 rounded-full border border-line bg-rice px-5 text-sm text-ink placeholder:text-ink-soft/70"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="h-11 rounded-full bg-brand px-7 text-sm font-medium text-white disabled:opacity-50"
      >
        发送
      </button>
    </form>
  );
}
