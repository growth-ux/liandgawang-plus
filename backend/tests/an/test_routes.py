from app.an import llm

PARTNER = {
    "name": "黑龙江北禾粮贸有限公司",
    "type_label": "粮源供应方",
    "source_agent": "粮小二",
    "source_task": "寻源结果 · LY-20260828-001",
    "region": "绥化",
    "business": "二等玉米供应",
    "verdict": "verify",
    "summary": "报价与质量有竞争力，但发运前需补充质量复检与排期确认。",
    "profile": [{"label": "报价", "value": "2380 元/吨"}],
    "risks": [
        {
            "title": "补充装车前复检报告",
            "level": "medium",
            "description": "检测时间应在装车前 48 小时内。",
            "evidence": "现有检测报告距今已 12 天",
            "action": "要求 48 小时内复检水分、容重与霉变粒",
        },
        {
            "title": "工商登记信息一致",
            "level": "low",
            "description": "无异常。",
            "evidence": "企业公示信息核对通过",
            "action": "无需动作",
        },
    ],
}


def test_explain_falls_back_to_rule_answer_without_llm(client, monkeypatch):
    monkeypatch.setattr(llm, "QWEN_API_KEY", "")
    response = client.post("/api/an/explain", json={
        "question": "为什么不能直接推进？",
        "partner": PARTNER,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["llm_available"] is False
    assert "黑龙江北禾粮贸有限公司" in data["answer"]
    assert "补充装车前复检报告" in data["answer"]
    # 低风险项不应出现在兜底回答里
    assert "工商登记" not in data["answer"]


def test_explain_returns_llm_answer_when_available(client, monkeypatch):
    monkeypatch.setattr(
        llm, "answer_partner_question",
        lambda question, partner, timeout_seconds=30: "因为检测报告已过期，需先完成复检再签约。",
    )
    response = client.post("/api/an/explain", json={
        "question": "为什么不能直接推进？",
        "partner": PARTNER,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["llm_available"] is True
    assert "检测报告已过期" in data["answer"]


def test_explain_rejects_empty_partner_name(client):
    response = client.post("/api/an/explain", json={
        "question": "有风险吗？",
        "partner": {**PARTNER, "name": ""},
    })
    assert response.status_code == 422
