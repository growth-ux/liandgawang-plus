import { useEffect, useRef, useState } from "react";
import { assessPurchaseMarket } from "./marketAssessment";
import type { PurchaseNeed } from "./purchaseModel";
import type { MarketSelection, PurchaseAdvice } from "./purchaseAdvice";

export default function PurchaseAdvicePanel({ need, selection, readonly, savedAdvice, onAdvice }: {
  need: PurchaseNeed;
  selection: MarketSelection;
  readonly: boolean;
  savedAdvice?: PurchaseAdvice;
  onAdvice(advice: PurchaseAdvice | null): void;
}) {
  const [result, setResult] = useState<{ key: string; advice: PurchaseAdvice } | null>(null);
  const [retry, setRetry] = useState(0);
  const cache = useRef(new Map<string, PurchaseAdvice>());
  const request = {
    variety_code: need.variety === "玉米" ? "corn" : "wheat",
    quantity_tons: need.quantity, destination: need.destination,
    deadline_days: need.days, stock_days: need.stockDays ?? 7, budget_price: need.budget,
    ...(typeof selection === "object" ? selection : {}),
  };
  const requestKey = JSON.stringify([request, selection]);

  useEffect(() => {
    if (readonly) return;
    onAdvice(null);
    if (selection === "loading") return;
    let cancelled = false;
    const controller = new AbortController();
    const publish = (advice: PurchaseAdvice) => {
      if (cancelled) return;
      setResult({ key: requestKey, advice });
      onAdvice(advice);
      if (advice.source === "qwen") cache.current.set(requestKey, advice);
    };
    const fallback = () => {
      const assessment = assessPurchaseMarket(need);
      publish({ title: assessment.title, reasoning: assessment.timing, caution: assessment.cost,
        source: "rule", model: null, elapsed_ms: 0,
        ...(typeof selection === "object" ? { context: selection } : {}),
      });
    };
    if (selection === "unavailable") { fallback(); return; }
    const cached = cache.current.get(requestKey);
    if (cached) { publish(cached); return; }
    // 快速切换地区或周期时只请求最后一次选择。
    const timer = window.setTimeout(async () => {
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch("/api/analysis/purchase-advice", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request), signal: controller.signal,
        });
        if (!response.ok) throw new Error("建议生成失败");
        const advice = await response.json() as PurchaseAdvice;
        if (!advice.title || !advice.reasoning || !advice.caution || !["qwen", "rule"].includes(advice.source)) {
          throw new Error("建议内容不完整");
        }
        publish(advice);
      } catch { if (!cancelled) fallback(); }
      finally { window.clearTimeout(timeout); }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
  }, [requestKey, retry, readonly, onAdvice]);

  const advice = readonly ? savedAdvice : result?.key === requestKey ? result.advice : null;
  return (
    <section className="pw-market-judgment" aria-label="本次采购建议" aria-busy={!readonly && !advice}>
      <h3>本次采购建议</h3>
      {advice ? <>
        <h4>{advice.title}</h4>
        <p>{advice.reasoning}</p>
        <p>{advice.caution}</p>
        {!readonly && advice.source === "rule" && <div className="pw-advice-fallback" role="status">
          <span>AI 建议暂不可用，当前为采购条件核对结果。</span>
          {typeof selection === "object" && <button type="button" className="pw-text-button" onClick={() => setRetry((value) => value + 1)}>重新生成</button>}
        </div>}
      </> : <p role="status">{readonly ? "本笔采购未保存 AI 建议，请查看当时的决策记录。" : selection === "loading" ? "正在读取行情…" : "正在结合行情生成采购建议…"}</p>}
    </section>
  );
}
