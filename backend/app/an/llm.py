"""安小二 LLM 层：合作方体检的追问问答。

体检的风险发现、判断依据与结论均为页面既有的结构化证据，
模型只负责基于这些证据组织连贯回答，不得编造证据之外的数据；
未配置 QWEN_API_KEY 或调用失败时返回 None，由调用方回退规则版文案。
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger("an.llm")

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

# 为 None 时每次调用重读 .env，填入 key 无需重启进程即可生效；
# 测试可通过 monkeypatch 该值模拟已/未配置。
QWEN_API_KEY: str | None = None

DEFAULT_MODEL = "qwen-plus"
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

VERDICT_NAMES = {
    "proceed": "建议继续接洽",
    "verify": "补充核验后继续",
    "pause": "建议暂缓",
}

SYSTEM_PROMPT = (
    "你是粮达e销的风控助手「安小二」。"
    "合作方体检的证据已经给定（业务档案、风险发现与判断依据、当前结论），"
    "你的任务是结合这些证据回答用户的追问。"
    "要求：只基于给定证据作答，不得编造证据之外的数据或结论；"
    "先回应问题本身，再点出当前最关键的风险与下一步核验动作；中文作答，80~150 字。"
)

REVIEW_SYSTEM_PROMPT = (
    "你是粮达e销的风控助手「安小二」。"
    "本次是独立发起的合作方体检，不关联具体业务方案；"
    "合作方的基础资料与风险发现已经给定，你的任务是生成体检结论段落。"
    "要求：只基于给定证据作答，不得编造证据之外的数据或结论；"
    "内容需覆盖总体判断、当前最关键的风险、进入交易前应补充的核验动作，"
    "并提醒本次结论不替代交易场景核验；中文，100~180 字。"
)


def format_context(partner: dict) -> str:
    """把合作方体检上下文组织为提示词证据段。"""
    profile_lines = "；".join(
        f"{p.get('label')}：{p.get('value')}" for p in partner.get("profile", [])
    ) or "无"
    risk_lines = "；".join(
        f"【{r.get('level')}】{r.get('title')}"
        f"（依据：{r.get('evidence')}；建议：{r.get('action')}）"
        for r in partner.get("risks", [])
    ) or "无"
    verdict = VERDICT_NAMES.get(partner.get("verdict"), partner.get("verdict")) or "未知"
    return (
        f"【合作方】{partner.get('name')}（{partner.get('type_label')}，"
        f"{partner.get('region')}，业务：{partner.get('business')}）\n"
        f"【来源】{partner.get('source_agent')}交接 · {partner.get('source_task')}\n"
        f"【业务档案】{profile_lines}\n"
        f"【风险发现】{risk_lines}\n"
        f"【当前结论】{verdict}：{partner.get('summary')}"
    )


def fallback_answer(partner: dict) -> str:
    """规则版回答：结论 + 最需优先处理的风险项，供模型不可用时兜底。"""
    verdict = VERDICT_NAMES.get(partner.get("verdict"), partner.get("verdict")) or "待定"
    parts = [f"基于当前体检证据，{partner.get('name')}的结论为「{verdict}」：{partner.get('summary')} "]
    important = [r for r in partner.get("risks", []) if r.get("level") != "low"]
    if important:
        first = important[0]
        parts.append(f"需优先处理“{first.get('title')}”（{first.get('evidence')}），建议动作：{first.get('action')}。")
    else:
        parts.append("当前没有需要新增核验的风险事项。")
    return "".join(parts)


def _build_llm(api_key: str, timeout_seconds: float):
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=os.getenv("QWEN_MODEL", DEFAULT_MODEL),
        api_key=api_key,
        base_url=os.getenv("QWEN_BASE_URL", DEFAULT_BASE_URL),
        temperature=0.3,
        timeout=timeout_seconds,
        max_retries=1,
    )


def _api_key() -> str:
    if QWEN_API_KEY is not None:
        return QWEN_API_KEY
    load_dotenv(_ENV_PATH, override=True)
    return os.getenv("QWEN_API_KEY", "").strip()


def answer_partner_question(question: str, partner: dict, timeout_seconds: float = 30) -> str | None:
    """调用 Qwen 基于体检证据回答追问；未配置 key 或调用失败时返回 None。"""
    api_key = _api_key()
    if not api_key:
        return None
    try:
        llm = _build_llm(api_key, timeout_seconds)
        prompt = (
            format_context(partner) + "\n"
            f"【用户追问】{question or '为什么给出这样的体检结论？'}\n"
            "请基于以上证据作答。"
        )
        message = llm.invoke([("system", SYSTEM_PROMPT), ("human", prompt)])
        text = (message.content or "").strip()
        return text or None
    except Exception:
        # 模型失败不阻塞问答：规则版回答仍完整可用，仅记录日志便于排查
        logger.exception("Qwen 体检追问回答失败，回退规则版")
        return None


def summarize_partner_review(partner: dict, timeout_seconds: float = 30) -> str | None:
    """调用 Qwen 生成独立体检的结论段落；未配置 key 或调用失败时返回 None。"""
    api_key = _api_key()
    if not api_key:
        return None
    try:
        llm = _build_llm(api_key, timeout_seconds)
        prompt = (
            format_context(partner) + "\n"
            "请输出本次独立体检的结论段落。"
        )
        message = llm.invoke([("system", REVIEW_SYSTEM_PROMPT), ("human", prompt)])
        text = (message.content or "").strip()
        return text or None
    except Exception:
        # 模型失败不阻塞体检：规则版结论仍完整可用，仅记录日志便于排查
        logger.exception("Qwen 体检结论生成失败，回退规则版")
        return None
