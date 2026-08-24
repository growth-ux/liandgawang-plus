"""从已确认办事结果中提炼可复用知识，大模型不可用时使用业务规则降级。"""

import json
import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from app.knowledge.schemas import KnowledgeDraft

logger = logging.getLogger("knowledge.extractor")

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

SYSTEM_PROMPT = (
    "你是企业知识提炼助手。只从已确认的办事结果提炼可跨任务复用的知识；"
    "保留当时的选择逻辑，不得把临时价格、一次性数量写成长期规律；"
    "每条必须给出适用场景，最多两条；没有可复用内容时返回空列表。"
    "所有标题、正文、标签必须是面向业务人员的中文，不得出现 action、verify_a、choose_b、"
    "ACT- 等内部动作码、接口名、字段名或编排实现细节。"
)

_INTERNAL_CODE = re.compile(r"\b(?:verify_a|choose_b|ACT-[A-Z0-9-]+|action)\b", re.IGNORECASE)


class KnowledgeExtraction(BaseModel):
    items: list[KnowledgeDraft] = Field(default_factory=list, max_length=2)


def _extract_with_llm(source_agent: str, payload: dict) -> list[KnowledgeDraft]:
    load_dotenv(_ENV_PATH, override=False)
    api_key = os.getenv("QWEN_API_KEY", "").strip()
    if not api_key:
        return []
    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            model=os.getenv("QWEN_MODEL", "qwen-plus"),
            api_key=api_key,
            base_url=os.getenv(
                "QWEN_BASE_URL",
                "https://dashscope.aliyuncs.com/compatible-mode/v1",
            ),
            temperature=0.1,
            timeout=120,
            max_retries=1,
        )
        result = llm.with_structured_output(KnowledgeExtraction).invoke(
            [
                ("system", SYSTEM_PROMPT),
                (
                    "human",
                    f"来源小二：{source_agent}\n已确认办事结果："
                    f"{json.dumps(payload, ensure_ascii=False, default=str)}",
                ),
            ]
        )
        items = result.items[:2] if result else []
        # 即使模型没有完全遵从提示词，也不让内部编排术语进入企业知识库。
        return [item for item in items if not _INTERNAL_CODE.search(json.dumps(item.model_dump(), ensure_ascii=False))]
    except Exception:
        logger.exception("知识提炼失败，使用规则降级")
        return []


def _fallback(source_agent: str, payload: dict) -> list[KnowledgeDraft]:
    if source_agent == "zhanggui":
        variety = payload.get("variety_name") or "粮食"
        condition = payload.get("condition") or "库存紧张"
        return [
            KnowledgeDraft(
                knowledge_type="decision",
                title=f"{variety}紧急补库优先保障稳定到货",
                content=f"{condition}时，优先保障稳定到货，再比较综合成本。",
                applicable_context=[f"{variety}采购", condition, "紧急补库"],
                tags=[variety, "保供", "综合决策"],
            )
        ]
    if source_agent == "suan":
        variety = payload.get("variety_name") or "粮食"
        return [
            KnowledgeDraft(
                knowledge_type="decision",
                title=f"{variety}方案需比较综合到厂成本",
                content="采购价较低的方案仍需同时比较运费、损耗、资金和质量折价。",
                applicable_context=[f"{variety}采购", "成本测算"],
                tags=[variety, "到厂成本"],
            )
        ]
    if source_agent == "an" and payload.get("title") and payload.get("experience"):
        partner_type = payload.get("partner_type") or "合作方"
        return [
            KnowledgeDraft(
                knowledge_type="risk",
                title=payload["title"],
                content=payload["experience"],
                applicable_context=[partner_type, "合作方审查"],
                tags=["安小二", partner_type],
            )
        ]
    return []


def extract_drafts(source_agent: str, payload: dict) -> list[KnowledgeDraft]:
    items = _extract_with_llm(source_agent, payload)
    business_items = [item for item in items if not _INTERNAL_CODE.search(json.dumps(item.model_dump(), ensure_ascii=False))]
    return business_items[:2] if business_items else _fallback(source_agent, payload)
