"""安小二适配器：独立审核候选供应方的履约证据，不修改粮小二结论。

风险项与异议由确定性规则判定；附带量化的履约风险折价（元/吨），
供算小二在定向复算时计入综合成本。审核解读由大模型生成，失败回退规则版。
"""

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.zhanggui import demo_data
from app.zhanggui.adapters import liang as liang_adapter
from app.zhanggui.adapters.base import AgentContext
from app.zhanggui.llm import interpret_risk_review
from app.zhanggui.schemas import AgentResult

# 履约证据新鲜度上限（天）与单次交付能力倍数上限
EVIDENCE_MAX_AGE_DAYS = 60
CAPACITY_RATIO_LIMIT = 2

# 履约风险折价口径（元/吨）：证据不足基础折价，随凭证过旧与交付能力缺口上浮，设上限防止过度惩罚
_RISK_PREMIUM_BASE = Decimal("8")
_RISK_PREMIUM_STALE_PER_DAY = Decimal("0.1")
_RISK_PREMIUM_SHORTAGE_MAX = Decimal("6")
_RISK_PREMIUM_CAP = Decimal("15")


def _risk_premium_yuan_per_ton(age_days: int, quantity: int, max_delivery: int) -> str:
    """量化履约风险折价：基础折价 + 凭证过旧附加 + 交付能力缺口附加。"""
    premium = _RISK_PREMIUM_BASE + Decimal(max(age_days - EVIDENCE_MAX_AGE_DAYS, 0)) * _RISK_PREMIUM_STALE_PER_DAY
    capacity_limit = max_delivery * CAPACITY_RATIO_LIMIT
    if quantity > capacity_limit:
        premium += min(Decimal(quantity - capacity_limit) / Decimal(quantity), Decimal("1")) * _RISK_PREMIUM_SHORTAGE_MAX
    return str(min(premium, _RISK_PREMIUM_CAP).quantize(Decimal("0.01")))


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
                "risk_premium_yuan_per_ton": _risk_premium_yuan_per_ton(age_days, quantity, max_delivery),
            })

    if not risks:
        return AgentResult(
            agent_id="an",
            status="completed",
            summary="候选供应方履约证据完整，未发现高风险事项",
            facts={
                "candidates_reviewed": len(candidates),
                "interpretation": "候选供应方的履约凭证均在有效期内，交付能力可覆盖本次候选量，本次审核未发现风险事项。",
                "interpretation_source": "rule",
            },
            evidence=evidence,
            impact_on_mission="综合方案可按成本排序直接推荐",
        )

    first = risks[0]
    # 解读层：规则定结论，模型只负责组织语言；失败自动回退规则版
    interpretation = interpret_risk_review(candidates, risks, evidence)
    interpretation_source = "qwen" if interpretation else "rule"
    if not interpretation:
        interpretation = (
            f"{first['supplier_name']}的履约证据不足（{first['detail']}），"
            f"已按规则量化为 {first['risk_premium_yuan_per_ton']} 元/吨的履约风险折价交给算小二复核；"
            "签约前必须先核验履约担保，今日无法完成核验或核验不通过时应切换交付证据更稳的备选供应方。"
        )
    return AgentResult(
        agent_id="an",
        status="completed_with_objection",
        summary=(
            f"对成本最优的 {first['supplier_name']} 提出风险异议：近半年履约证据不足，"
            "签约前必须先核验履约担保。"
        ),
        facts={
            "candidates_reviewed": len(candidates),
            "risk_codes": [r["code"] for r in risks],
            "interpretation": interpretation,
            "interpretation_source": interpretation_source,
        },
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
