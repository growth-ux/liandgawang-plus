from datetime import date

from app.zhanggui.goal_parser import parse_goal
from app.zhanggui.team_rules import recommend_team
from app.knowledge.schemas import KnowledgeReference


def test_demo_goal_extracts_fields_and_cites_memory():
    preview = parse_goal(
        "未来15天采购200吨二等玉米到潍坊，不能影响生产",
        today=date(2026, 8, 24),
        memories=["企业采购通常优先保供，再比较综合成本。"],
    )
    assert preview.goal.variety_code == "corn"
    assert preview.goal.quantity_tons == "200"
    assert preview.goal.deadline_date == "2026-09-08"
    assert preview.goal.destination == "潍坊"
    assert preview.memory_references[0].source == "企业过往经验"
    assert any("预算" in q for q in preview.questions)


def test_no_financing_gap_keeps_qian_out_of_team():
    preview = parse_goal("15天采购200吨玉米到潍坊", today=date(2026, 8, 24), memories=[])
    team = recommend_team(preview.goal)
    ids = [item.agent_id for item in team if item.selected]
    assert ids == ["zhan", "liang", "yun", "suan", "an"]
    qian = next(item for item in team if item.agent_id == "qian")
    assert qian.selected is False
    assert qian.reason == "当前未发现资金缺口或账期需求"


def test_financing_gap_selects_qian():
    preview = parse_goal(
        "未来20天采购300吨玉米到潍坊，资金缺口约80万元",
        today=date(2026, 8, 24),
        memories=[],
    )
    assert preview.goal.financing_gap_yuan == "800000"
    team = recommend_team(preview.goal)
    qian = next(item for item in team if item.agent_id == "qian")
    assert qian.selected is True
    assert "资金" in qian.reason


def test_budget_and_hard_constraints_extracted():
    preview = parse_goal(
        "未来15天采购200吨二等玉米到潍坊，综合成本控制在2500元/吨以内，不能影响生产",
        today=date(2026, 8, 24),
        memories=[],
    )
    assert preview.goal.budget_yuan_per_ton == "2500"
    assert any("二等" in item for item in preview.goal.hard_constraints)
    assert preview.goal.priority == "supply"
    assert not any("预算" in q for q in preview.questions)


def test_demo_goal_cites_structured_memory(client, monkeypatch):
    monkeypatch.setattr("app.zhanggui.goal_parser._llm_patch", lambda *args: False)
    monkeypatch.setattr(
        "app.knowledge.service.search_for_task",
        lambda *args, **kwargs: [
            KnowledgeReference(
                knowledge_id=3,
                title="安全库存不足优先保供",
                content="库存不足七天时优先保供",
                source_agent="suan",
                source_title="玉米成本复盘",
                applicable_reason="本次库存仅 5 天",
                reliability_label="已确认 · 多次验证",
            )
        ],
    )
    preview = client.post(
        "/api/zhanggui/missions/preview",
        json={"text": "库存只够5天，采购200吨玉米到潍坊"},
    ).json()
    assert preview["memory_references"][0]["knowledge_id"] == 3
    assert preview["memory_references"][0]["applicable_reason"] == "本次库存仅 5 天"
