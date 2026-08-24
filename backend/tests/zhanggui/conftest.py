"""粮掌柜测试工厂：主演示目标与 Agent 结果。"""

from datetime import date

import pytest

from app.zhanggui.schemas import MissionGoal

DEMO_RAW_REQUEST = "未来15天采购200吨二等玉米到潍坊，不能影响生产"


@pytest.fixture()
def demo_goal() -> MissionGoal:
    """主演示目标：目标确认闸门后的口径（补充了预算）。"""
    return MissionGoal(
        variety_code="corn",
        variety_name="玉米",
        grade="二等",
        quantity_tons="200",
        deadline_date="2026-09-08",
        destination="潍坊",
        budget_yuan_per_ton="2500",
        priority="supply",
        hard_constraints=["不能影响生产连续性", "质量不低于二等"],
    )


@pytest.fixture()
def demo_today() -> date:
    return date(2026, 8, 24)


@pytest.fixture()
def base_agent_results(db_session, demo_goal):
    """瞻、粮、运三个前置小二的结果，供算/钱/安测试复用。"""
    from app.zhanggui.adapters.base import AgentContext, run_agent

    prior: dict = {}
    for agent_id in ["zhan", "liang", "yun"]:
        prior[agent_id] = run_agent(agent_id, db_session, AgentContext(1, demo_goal, prior))
    return prior


@pytest.fixture()
def all_agent_results(db_session, demo_goal, base_agent_results):
    """主演示五位小二的完整结果。"""
    from app.zhanggui.adapters.base import AgentContext, run_agent

    results = dict(base_agent_results)
    results["suan"] = run_agent("suan", db_session, AgentContext(1, demo_goal, results))
    results["an"] = run_agent("an", db_session, AgentContext(1, demo_goal, results))
    return results
