"""粮掌柜 LLM 解读层：把安小二的风险审核结论解释成自然语言。

与 app/analysis/llm.py 同模式：审核结论与风险项由确定性规则算好，
模型只负责组织表达，不允许改变结论；未配置 QWEN_API_KEY 或调用失败
时返回 None，由规则版兜底。
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

logger = logging.getLogger("zhanggui.llm")

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

# 为 None 时每次调用重读 .env，填入 key 无需重启进程即可生效；
# 测试可通过 monkeypatch 该值模拟已/未配置。
QWEN_API_KEY: str | None = None

DEFAULT_MODEL = "qwen-plus"
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

SYSTEM_PROMPT = (
    "你是粮达网 Plus 的风控审核助手「安小二」。"
    "风险审核结论（风险项、履约证据、异议意见）已由确定性规则算好，"
    "你的任务只是把这些结构化结论和证据解释成一段连贯、专业的中文解读。"
    "要求：不得更改或推翻规则结论；不得编造规则结论之外的数据；"
    "解读需覆盖风险来源、为什么重要、以及签约前必须先做的核验动作；100~200 字。"
)


class Interpretation(BaseModel):
    """大模型输出的结构化解读。"""

    interpretation: str = Field(description="对风险审核结论的综合解读段落")


def interpret_risk_review(
    candidates: list[dict],
    risks: list[dict],
    evidence: list[dict],
    timeout_seconds: float = 20,
) -> str | None:
    """调用 Qwen 生成风险审核解读；未配置 key 或调用失败时返回 None。"""
    if QWEN_API_KEY is not None:
        api_key = QWEN_API_KEY
    else:
        load_dotenv(_ENV_PATH, override=True)
        api_key = os.getenv("QWEN_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            model=os.getenv("QWEN_MODEL", DEFAULT_MODEL),
            api_key=api_key,
            base_url=os.getenv("QWEN_BASE_URL", DEFAULT_BASE_URL),
            temperature=0.3,
            timeout=timeout_seconds,
            max_retries=1,
        )
        candidate_lines = "；".join(
            f"{c.get('supplier_name')}（方案 {c.get('scheme_id')}）"
            f"可供 {c.get('available_quantity_tons')} 吨，报价 {c.get('price')} 元/吨"
            for c in candidates
        ) or "无"
        risk_lines = "；".join(r.get("detail", "") for r in risks) or "无"
        evidence_lines = "；".join(e.get("item", "") for e in evidence) or "无"
        prompt = (
            "【审核的候选供应方】\n" + candidate_lines + "\n"
            "【履约证据】\n" + evidence_lines + "\n"
            "【规则审核风险项】\n" + risk_lines + "\n"
            "请输出解读段落。"
        )
        structured = llm.with_structured_output(Interpretation)
        result = structured.invoke([("system", SYSTEM_PROMPT), ("human", prompt)])
        text = result.interpretation.strip() if result else ""
        return text or None
    except Exception:
        # 模型失败不阻塞审核：规则结论仍完整可用，仅记录日志便于排查
        logger.exception("Qwen 风险审核解读调用失败，回退规则版")
        return None
