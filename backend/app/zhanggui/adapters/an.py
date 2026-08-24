"""安小二适配器：独立审核候选供应方的履约证据，不修改粮小二结论。"""

from datetime import date

from sqlalchemy.orm import Session

from app.zhanggui import demo_data
from app.zhanggui.adapters import liang as liang_adapter
from app.zhanggui.adapters.base import AgentContext
from app.zhanggui.schemas import AgentResult

# 履约证据新鲜度上限（天）与单次交付能力倍数上限
EVIDENCE_MAX_AGE_DAYS = 60
CAPACITY_RATIO_LIMIT = 2


def run(db: Session, context: AgentContext) -> AgentResult:
    liang_result = context.prior_results.get("liang")
    if liang_result is None or liang_result.status == "failed":
        raise RuntimeError("缺少粮小二结果，无法审核供应方")
    candidates = liang_adapter.candidate_briefs(liang_result)

    risks = []
    evidence = []
    for candidate in candidates:
        supplier_code = candidate.get("supplier_code") or ""
        record = demo_data.FULFILLMENT_EVIDENCE.get(supplier_code)
        if record is None:
            continue
        evidence_at = date.fromisoformat(record["last_delivery_evidence_at"])
        age_days = (demo_data.DEMO_TODAY - evidence_at).days
        quantity = int(candidate["available_quantity_tons"])
        max_delivery = record["max_single_delivery_tons"]
        evidence.append({
            "item": f"{record['supplier_name']}：近半年最大单次交付 {max_delivery} 吨，最近凭证 {record['last_delivery_evidence_at']}（{record['evidence_note']}）",
            "source": "企业采购资料",
        })
        if age_days > EVIDENCE_MAX_AGE_DAYS or quantity > max_delivery * CAPACITY_RATIO_LIMIT:
            risks.append({
                "code": "supplier_delivery_evidence_missing",
                "scheme_id": candidate.get("scheme_id"),
                "supplier_code": supplier_code,
                "supplier_name": record["supplier_name"],
                "severity": "high",
                "detail": (
                    f"{record['supplier_name']}近半年最大单次交付 {max_delivery} 吨，"
                    f"本次候选量 {quantity} 吨，且最近履约凭证距今 {age_days} 天"
                ),
            })

    if not risks:
        return AgentResult(
            agent_id="an",
            status="completed",
            summary="候选供应方履约证据完整，未发现高风险事项",
            facts={"candidates_reviewed": len(candidates)},
            evidence=evidence,
            impact_on_mission="综合方案可按成本排序直接推荐",
        )

    first = risks[0]
    return AgentResult(
        agent_id="an",
        status="completed_with_objection",
        summary=(
            f"对成本最优的 {first['supplier_name']} 提出风险异议：近半年履约证据不足，"
            "签约前必须先核验履约担保。"
        ),
        facts={"candidates_reviewed": len(candidates), "risk_codes": [r["code"] for r in risks]},
        recommendations=[
            f"先核验 {first['supplier_name']} 的履约担保或近期交付凭证",
            "今日无法完成核验或核验不通过时，切换到交付证据更稳的备选供应方",
        ],
        risks=risks,
        missing_information=[f"{first['supplier_name']}近 3 个月的交付凭证与担保材料"],
        evidence=evidence,
        impact_on_mission="主推方案必须附加履约担保核验条件，否则应切换备选",
        available_actions=[{"action": "verify_a", "label": f"核验 {first['supplier_name']} 履约担保"}],
    )
