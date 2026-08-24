from app.knowledge import extractor


def test_zhanggui_fallback_keeps_decision_logic(monkeypatch):
    monkeypatch.setattr(extractor, "_extract_with_llm", lambda *args, **kwargs: [])

    drafts = extractor.extract_drafts(
        "zhanggui",
        {
            "variety_name": "玉米",
            "priority": "supply",
            "condition": "雨季车源紧张",
        },
    )

    assert len(drafts) == 1
    assert drafts[0].knowledge_type == "decision"
    assert "稳定到货" in drafts[0].content
    assert "雨季车源紧张" in drafts[0].applicable_context


def test_an_fallback_creates_risk_rule(monkeypatch):
    monkeypatch.setattr(extractor, "_extract_with_llm", lambda *args, **kwargs: [])

    drafts = extractor.extract_drafts(
        "an",
        {
            "title": "大额集中采购需确认装车排期",
            "experience": "超过 150 吨时，提前确认装车排期并临近装车复检。",
            "partner_type": "粮源供应方",
        },
    )

    assert drafts[0].knowledge_type == "risk"
    assert drafts[0].title == "大额集中采购需确认装车排期"


def test_llm_draft_with_internal_action_code_is_discarded(monkeypatch):
    monkeypatch.setattr(
        extractor,
        "_extract_with_llm",
        lambda *args, **kwargs: [
            extractor.KnowledgeDraft(
                knowledge_type="decision",
                title="verify_a 规则",
                content="当选择 verify_a 行动时执行核验。",
            )
        ],
    )

    drafts = extractor.extract_drafts("zhanggui", {"variety_name": "玉米"})

    assert len(drafts) == 1
    assert "verify_a" not in drafts[0].content
