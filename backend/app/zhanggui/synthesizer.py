"""综合建议生成：主推、备选、取舍与条件化行动草稿。"""

from app.zhanggui.schemas import (
    ActionDraft,
    AgentResult,
    MissionConflict,
    MissionGoal,
    MissionRecommendation,
)

FALLBACK_TRIGGER = "今日无法完成核验或核验不通过"


def _supplier_names(results: dict[str, AgentResult]) -> dict[str, tuple[str, str]]:
    """scheme_id -> (供应方名称, 供应方编码)。"""
    liang = results.get("liang")
    names: dict[str, tuple[str, str]] = {}
    if liang and liang.status != "failed":
        for candidate in liang.facts.get("candidates", []):
            scheme_id = candidate.get("scheme_id")
            if scheme_id:
                names[scheme_id] = (
                    candidate.get("supplier_name") or f"供应方{scheme_id}",
                    candidate.get("supplier_code") or "",
                )
    return names


def _action_drafts(
    primary: str,
    backup: str | None,
    names: dict[str, tuple[str, str]],
    gated: bool,
) -> list[ActionDraft]:
    a_name, a_code = names.get(primary, (f"方案{primary}供应方", ""))
    b_name, b_code = names.get(backup or "", (f"方案{backup}供应方" if backup else "备选供应方", ""))
    drafts = [
        ActionDraft(
            action_code="ACT-VERIFY-A",
            agent_id="an",
            title=f"核验{a_name}履约担保",
            payload={"supplier_code": a_code, "supplier_name": a_name, "scheme_id": primary},
            scheme_id=primary,
            requires_prerequisite=False,
        ),
        ActionDraft(
            action_code="ACT-INQUIRY-A",
            agent_id="liang",
            title=f"向{a_name}询价并锁定库存",
            payload={"supplier_code": a_code, "supplier_name": a_name, "scheme_id": primary},
            scheme_id=primary,
            requires_prerequisite=gated,
        ),
    ]
    if backup:
        drafts.append(ActionDraft(
            action_code="ACT-BACKUP-B",
            agent_id="liang",
            title=f"向{b_name}保留备选报价",
            payload={"supplier_code": b_code, "supplier_name": b_name, "scheme_id": backup},
            scheme_id=backup,
            requires_prerequisite=gated,
        ))
    drafts.append(ActionDraft(
        action_code="ACT-TRANSPORT-A",
        agent_id="yun",
        title="确认两批运输安排",
        payload={"scheme_id": primary},
        scheme_id=primary,
        requires_prerequisite=gated,
    ))
    return drafts


def build_recommendation(
    goal: MissionGoal,
    results: dict[str, AgentResult],
    conflicts: list[MissionConflict],
) -> MissionRecommendation:
    suan = results["suan"]
    facts = suan.facts
    primary = facts["recommended_scheme_id"]
    backup = facts.get("backup_scheme_id")
    names = _supplier_names(results)
    a_name = names.get(primary, (f"方案{primary}供应方", ""))[0]
    b_name = names.get(backup or "", ("备选供应方", ""))[0] if backup else None

    cost_risk = next((c for c in conflicts if c.kind == "cost_vs_risk"), None)
    gated = cost_risk is not None

    delivered = facts.get("delivered_cost_yuan_per_ton", {})
    saving = facts.get("saving_total_yuan", "0.00")
    delta = facts.get("delta_yuan_per_ton", "0.00")

    reasons = [
        f"方案 {primary} 到厂吨成本 {delivered.get(primary, '—')} 元，为两套组合中最低",
        f"两批运输安排均能满足 {goal.deadline_date or '约定'} 前到货",
    ]
    if backup:
        reasons.append(f"方案 {backup}（{b_name}）交付证据更稳，可随时切换")

    tradeoffs = []
    if backup:
        tradeoffs.append(f"方案 {backup} 每吨贵 {delta} 元，总计多花 {saving} 元，但交付稳定性更高")
    if gated:
        tradeoffs.append(f"方案 {primary} 需要先完成{a_name}履约担保核验，存在今日无法通过的可能")
    zhan = results.get("zhan")
    if zhan and zhan.status != "failed" and zhan.facts.get("time_window"):
        tradeoffs.append(f"行情节奏参考：{zhan.facts['time_window']}")

    if gated:
        condition = f"{a_name}补齐履约担保后优先执行方案 {primary}"
        summary = (
            f"主推方案 {primary}（{a_name}，成本最低）：先核验履约担保，通过后锁定询价与运输；"
            f"{FALLBACK_TRIGGER}时，立即切换方案 {backup}（{b_name}），保证 {goal.deadline_date or '按期'} 到货。"
        )
    else:
        condition = None
        summary = (
            f"主推方案 {primary}（{a_name}），综合成本最低；"
            + (f"方案 {backup}（{b_name}）作为备选保留。" if backup else "无备选方案。")
        )

    return MissionRecommendation(
        primary_scheme_id=primary,
        backup_scheme_id=backup,
        summary=summary,
        reasons=reasons,
        tradeoffs=tradeoffs,
        condition=condition,
        fallback_trigger=FALLBACK_TRIGGER if gated else None,
        next_actions=_action_drafts(primary, backup, names, gated),
    )
