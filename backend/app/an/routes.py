"""安小二路由：合作方体检追问问答。

证据（业务档案、风险发现、结论）由前端体检结果带入；
大模型只基于证据组织回答，不可用时返回规则版兜底文案。
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.an import llm

router = APIRouter(prefix="/api/an", tags=["an"])


class RiskItemIn(BaseModel):
    title: str = Field(default="", max_length=128)
    level: str = Field(default="low", max_length=16)
    description: str = Field(default="", max_length=500)
    evidence: str = Field(default="", max_length=500)
    action: str = Field(default="", max_length=500)


class ProfileItem(BaseModel):
    label: str = Field(default="", max_length=64)
    value: str = Field(default="", max_length=256)


class PartnerIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    type_label: str = Field(default="", max_length=64)
    source_agent: str = Field(default="", max_length=64)
    source_task: str = Field(default="", max_length=256)
    region: str = Field(default="", max_length=128)
    business: str = Field(default="", max_length=256)
    verdict: str = Field(default="", max_length=32)
    summary: str = Field(default="", max_length=1000)
    profile: list[ProfileItem] = Field(default_factory=list)
    risks: list[RiskItemIn] = Field(default_factory=list)


class ExplainRequest(BaseModel):
    question: str = Field(default="", max_length=500)
    partner: PartnerIn


@router.post("/explain")
def explain(body: ExplainRequest):
    partner = body.partner.model_dump()
    answer = llm.answer_partner_question(body.question, partner)
    llm_available = answer is not None
    if not llm_available:
        answer = llm.fallback_answer(partner)
    return {"answer": answer, "llm_available": llm_available}


class ReviewRequest(BaseModel):
    partner: PartnerIn


@router.post("/review")
def review(body: ReviewRequest):
    """独立发起的合作方体检：风险项由确定性数据给定，大模型生成体检结论段落。"""
    partner = body.partner.model_dump()
    summary = llm.summarize_partner_review(partner)
    llm_available = summary is not None
    if not llm_available:
        summary = llm.fallback_answer(partner)
    return {"summary": summary, "llm_available": llm_available}
