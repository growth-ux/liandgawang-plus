import { Link } from "react-router-dom";
import { purchaseMemory, readPurchases } from "./purchaseModel";

/** 已完成采购生成的成本基线，与企业知识服务并列展示。 */
export default function PurchaseKnowledge() {
  const purchases = readPurchases().filter((item) => item.learned);
  if (!purchases.length) return null;
  return (
    <section className="mb-6 rounded-2xl border border-tech/20 bg-tech/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-tech">
          历史采购成本基线
        </h2>
        <span className="text-xs text-ink-soft">
          {purchases.length} 条 · 后续采购可引用
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {purchases.slice(0, 6).map((purchase) => (
          <article
            key={purchase.id}
            className="rounded-xl border border-line bg-rice/70 p-4"
          >
            <h3 className="text-sm">
              {purchase.need.destination} · {purchase.need.variety}成本基线
            </h3>
            <p className="mt-2 text-xs leading-6 text-ink-soft">
              {purchaseMemory(purchase)}
            </p>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px]">
              <span className="text-ink-soft">来源：算小二 · 已结算订单</span>
              <Link
                to={`/agent/da?purchase=${purchase.id}`}
                className="text-tech"
              >
                查看来源采购 {purchase.id} →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
