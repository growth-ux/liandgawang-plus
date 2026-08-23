import { useEffect, useRef, useState } from "react";
import { getAgent } from "../../../data/agents";
import type { MarketOverview } from "../types";

const agent = getAgent("zhan")!;

interface Msg {
  role: "user" | "agent";
  text: string;
}

/** 开场推荐问题 */
const suggestions = ["今天行情怎么看？", "哪里价格最高？", "有什么需要关注的风险？"];

/** 基于当日行情生成回复：关键词匹配当日真实数据，不依赖后端 */
function buildReply(q: string, data: MarketOverview | null): string {
  if (!data) {
    return "行情还在整理中，稍等片刻再问我～";
  }
  const { judgment, spots, events, variety_name, price_date } = data;
  const dirLabel =
    judgment.direction === "bullish" ? "偏强" : judgment.direction === "bearish" ? "偏弱" : "震荡";
  const num = (p: string) => Number(p) || 0;

  if (/风险|关注|注意|建议/.test(q)) {
    const risks = judgment.opposing.map((e) => e.text);
    const watch = judgment.watch_suggestions.join("；");
    return [
      `当前${variety_name}市场需要留意：`,
      ...(risks.length ? risks.map((t) => `· ${t}`) : ["· 暂无明显风险因素"]),
      watch ? `建议关注：${watch}。` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (/最高|最贵|哪里贵|高点/.test(q)) {
    const top = [...spots].sort((a, b) => num(b.price) - num(a.price))[0];
    return top
      ? `${price_date} 报价最高的是${top.region_name}（${top.region_type}）：${top.price} 元/吨。${top.interpretation || ""}`
      : "暂无报价数据。";
  }

  if (/最低|最便宜|哪里低|低点/.test(q)) {
    const low = [...spots].sort((a, b) => num(a.price) - num(b.price))[0];
    return low
      ? `${price_date} 报价最低的是${low.region_name}（${low.region_type}）：${low.price} 元/吨。${low.interpretation || ""}`
      : "暂无报价数据。";
  }

  if (/港口|平仓|到港/.test(q)) {
    const ports = spots.filter((s) => s.region_type === "港口");
    if (!ports.length) return `当前监测的${variety_name}库点中没有港口报价。`;
    return (
      `港口方面：` +
      ports.map((p) => `${p.region_name} ${p.price} 元/吨（环比 ${p.change_pct}）`).join("；") +
      "。"
    );
  }

  if (/事件|消息|新闻|政策/.test(q)) {
    if (!events.length) return "今天暂无值得展开的市场事件。";
    return (
      "今天值得注意的市场事件：\n" +
      events.map((e) => `· ${e.title}（${e.event_at}）`).join("\n")
    );
  }

  const spotHit = spots.find((s) => q.includes(s.region_name));
  if (spotHit) {
    return `${spotHit.region_name}（${spotHit.region_type}）${price_date} 报价 ${spotHit.price} 元/吨，环比 ${spotHit.change_pct}。${spotHit.interpretation || ""}`;
  }

  // 默认：给出当日研判结论
  const support = judgment.supporting.map((e) => e.text);
  return [
    `${price_date} ${variety_name}整体${dirLabel}。${judgment.summary}`,
    ...(support.length ? support.slice(0, 3).map((t) => `· ${t}`) : []),
    judgment.watch_suggestions.length
      ? `建议关注：${judgment.watch_suggestions.join("；")}。`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** 市场全景页对话窗：点击右下角瞻小二唤起，基于当日行情应答 */
export default function ZhanChat({
  data,
  onClose,
}: {
  data: MarketOverview | null;
  onClose: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "agent",
      text: "我是瞻小二，今天的一手行情我已经整理好了。想先听听整体研判，还是看某个区域的报价？",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setTyping(true);
    // 模拟研判思考的短暂延迟
    setTimeout(() => {
      setMsgs((m) => [...m, { role: "agent", text: buildReply(q, data) }]);
      setTyping(false);
    }, 600);
  };

  return (
    <div className="fixed bottom-4 right-6 z-50 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <img
            src={agent.image}
            alt={agent.name}
            className="h-9 w-auto drop-shadow-[0_0_8px_rgba(47,127,184,0.4)]"
          />
          <span className="text-sm font-semibold">瞻小二</span>
          <span className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            行情研判 · 在线
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 text-ink-soft transition-colors hover:text-ink"
          aria-label="关闭对话"
        >
          ✕
        </button>
      </div>

      {/* 消息区 */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-line rounded-xl px-3 py-2 text-[13px] leading-6 ${
                m.role === "user"
                  ? "bg-brand text-white"
                  : "bg-tech/10 text-ink"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-xl bg-tech/10 px-3 py-2.5">
              <span className="ld-dot h-1.5 w-1.5 rounded-full bg-tech" />
              <span className="ld-dot h-1.5 w-1.5 rounded-full bg-tech" />
              <span className="ld-dot h-1.5 w-1.5 rounded-full bg-tech" />
            </div>
          </div>
        )}
      </div>

      {/* 推荐问题 */}
      {msgs.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-ink-soft transition-colors hover:border-tech hover:text-tech"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="问问今天的行情…"
          className="flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-soft/50 focus:border-tech"
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={!input.trim() || typing}
          className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
        >
          发送
        </button>
      </div>
    </div>
  );
}
