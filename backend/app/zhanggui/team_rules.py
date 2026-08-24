"""确定性组队规则：按采购目标选择参与的专业小二。"""

from app.zhanggui.schemas import MissionGoal, TeamMember

AGENT_ORDER = ["zhan", "liang", "yun", "suan", "qian", "an"]

AGENT_NAMES = {
    "zhan": "瞻小二",
    "liang": "粮小二",
    "yun": "运小二",
    "suan": "算小二",
    "qian": "钱小二",
    "an": "安小二",
}

AGENT_EXPECTED_OUTPUT = {
    "zhan": "采购时机与分批节奏建议",
    "liang": "候选粮源与主推、备选、淘汰归因",
    "yun": "分批运输方案、时效与吨运费",
    "suan": "多套组合的综合吨成本对比",
    "qian": "资金产品匹配与参考资金成本",
    "an": "合作方履约风险与可核验动作",
}

QIAN_STANDBY_REASON = "当前未发现资金缺口或账期需求"


def _has_financing_gap(goal: MissionGoal) -> bool:
    return goal.financing_gap_yuan not in (None, "", "0")


def reason_for(agent_id: str, goal: MissionGoal, selected: bool) -> str:
    if agent_id == "zhan":
        return "有明确到货期限，需要研判采购时机和分批节奏" if selected else "本次未提出时间要求，暂不研判采购时机"
    if agent_id == "liang":
        return f"需要为 {goal.quantity_tons or '本次'} 吨{goal.variety_name}寻找并筛选粮源"
    if agent_id == "yun":
        return f"需要安排到{goal.destination}的分批运输并核对时效" if selected else "未提供到货地点，暂不规划运输"
    if agent_id == "suan":
        return "需要把粮源和运输结果组合成多套方案比较综合成本"
    if agent_id == "qian":
        if selected:
            return f"存在约 {goal.financing_gap_yuan} 元资金缺口，需要匹配资金产品"
        return QIAN_STANDBY_REASON
    if agent_id == "an":
        return "需要审核供应方履约证据与质量、交付风险"
    return ""


def recommend_team(goal: MissionGoal) -> list[TeamMember]:
    """顺序固定为 zhan、liang、yun、suan、qian、an；执行图只运行 selected 成员。"""
    selected = {
        "zhan": goal.deadline_date is not None,
        "liang": True,
        "yun": goal.destination is not None,
        "suan": True,
        "qian": _has_financing_gap(goal),
        "an": True,
    }
    return [
        TeamMember(
            agent_id=agent_id,
            name=AGENT_NAMES[agent_id],
            selected=selected[agent_id],
            reason=reason_for(agent_id, goal, selected[agent_id]),
            expected_output=AGENT_EXPECTED_OUTPUT[agent_id],
        )
        for agent_id in AGENT_ORDER
    ]
