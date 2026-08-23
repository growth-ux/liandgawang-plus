import type { TransportPlan } from "./types";

const midPrice = (plan: TransportPlan) => (plan.price_low + plan.price_high) / 2;

export function selectPlanReferences(
  primary: TransportPlan,
  plans: TransportPlan[]
): { faster: TransportPlan | null; cheaper: TransportPlan | null } {
  const others = plans.filter((plan) => plan.id !== primary.id);
  const faster = [...others]
    .filter((plan) => plan.days_high < primary.days_high)
    .sort((a, b) => a.days_high - b.days_high || midPrice(a) - midPrice(b))[0] ?? null;
  const cheaper = [...others]
    .filter((plan) => plan.id !== faster?.id && midPrice(plan) < midPrice(primary))
    .sort((a, b) => midPrice(a) - midPrice(b) || a.days_high - b.days_high)[0] ?? null;
  return { faster, cheaper };
}
