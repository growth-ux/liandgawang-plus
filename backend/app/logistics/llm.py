"""运小二大模型层：自然语言需求抽取与方案解释。

数字与结论全部来自确定性规则；模型只负责理解与解释。
未配置 QWEN_API_KEY 或调用失败时返回 None / 回退规则版文案。
"""

import logging
import os
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field

logger = logging.getLogger("yun.logistics.llm")

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

# 为 None 时每次调用重读 .env；测试可 monkeypatch 该值模拟已/未配置。
QWEN_API_KEY: str | None = None

DEFAULT_MODEL = "qwen-plus"
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

VARIETY_CODES = {"corn", "wheat", "soybean", "rice"}

SYSTEM_PROMPT = (
    "你是粮达e销 的物流助手「运小二」。"
    "你的任务是把用户对一批粮食运输的自然语言描述抽取为结构化条件，"
    "或基于已给的结构化方案结论组织解释。"
    "不得编造节点、运价或承运方；起终点必须从给定节点列表中选择；"
    "对模糊表达（如'一周内到'）给出明确解释。"
)


class RequirementExtraction(BaseModel):
    origin: str | None = Field(None, description="发货地，必须来自节点列表，否则留空")
    destination: str | None = Field(None, description="收货地，必须来自节点列表，否则留空")
    variety_code: str | None = Field(
        None, description="品种代码：corn 玉米 / wheat 小麦 / soybean 大豆 / rice 稻谷"
    )
    quantity_tons: int | None = Field(None, description="数量（吨）")
    deadline_days: int | None = Field(None, description="从今天起到最晚到货的天数")
    assumptions: list[str] = Field(default_factory=list, description="对模糊表达的解释")
    question: str | None = Field(None, description="影响匹配的最关键缺失问题，无则留空")
    decision_preference: Literal["on_time", "cost", "balanced"] | None = Field(
        None,
        description="用户明确表达的决策偏好：准时 on_time、成本 cost、稳妥或综合 balanced",
    )


def _config() -> tuple[str, str, str]:
    if QWEN_API_KEY is not None:
        return (
            QWEN_API_KEY,
            os.getenv("QWEN_MODEL", DEFAULT_MODEL),
            os.getenv("QWEN_BASE_URL", DEFAULT_BASE_URL),
        )
    load_dotenv(_ENV_PATH, override=True)
    return (
        os.getenv("QWEN_API_KEY", "").strip(),
        os.getenv("QWEN_MODEL", DEFAULT_MODEL),
        os.getenv("QWEN_BASE_URL", DEFAULT_BASE_URL),
    )


def _build_llm(api_key: str, model: str, base_url: str):
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url=base_url,
        temperature=0.2,
        timeout=120,
        max_retries=1,
    )


def extract_requirements(text: str, nodes: list[str], today: date) -> dict | None:
    """从自然语言抽取结构化运输条件；不可用时返回 None。"""
    api_key, model, base_url = _config()
    if not api_key:
        return None
    try:
        llm = _build_llm(api_key, model, base_url)
        prompt = (
            f"节点列表（起终点只能从中选择）：{'、'.join(nodes)}\n"
            f"今天：{today.isoformat()}\n"
            f"用户描述：{text}\n"
            "请抽取结构化条件；'几天内到'请换算为 deadline_days。"
            "只有用户明确表达偏好时才填写 decision_preference，否则留空。"
        )
        result = llm.with_structured_output(RequirementExtraction).invoke(
            [("system", SYSTEM_PROMPT), ("human", prompt)]
        )
        if result is None:
            return None
        deadline_date = None
        if result.deadline_days:
            deadline_date = (today + timedelta(days=result.deadline_days)).isoformat()
        return {
            "fields": {
                "origin": result.origin if result.origin in nodes else None,
                "destination": result.destination if result.destination in nodes else None,
                "variety_code": result.variety_code
                if result.variety_code in VARIETY_CODES
                else None,
                "quantity_tons": result.quantity_tons,
                "deadline_date": deadline_date,
            },
            "assumptions": result.assumptions,
            "question": result.question,
            "decision_preference": result.decision_preference,
        }
    except Exception:
        logger.exception("Qwen 需求抽取失败")
        return None


def _fallback_explanation(context: dict) -> str:
    plans = context["plans"]
    parts = []
    primary = next((p for p in plans if p["plan_type"] == "primary"), None)
    if primary:
        parts.append(
            f"主推为{primary['title']}：{primary['price_low']}~{primary['price_high']} 元/吨、"
            f"预计 {primary['days_low']}~{primary['days_high']} 天。理由：{primary['reason']}。"
        )
    backup = next((p for p in plans if p["plan_type"] == "backup"), None)
    if backup:
        parts.append(f"备选为{backup['title']}：{backup['reason']}。")
    rejected = [p for p in plans if p["plan_type"] == "rejected"]
    if rejected:
        parts.append(
            "未入选：" + "；".join(f"{r['title']}——{r['reason']}" for r in rejected) + "。"
        )
    return "".join(parts) or "当前任务还没有生成方案，请先运行匹配。"


def explain_plans(question: str, context: dict) -> str:
    """解释方案取舍；模型不可用或失败时回退结构化模板。"""
    fallback = _fallback_explanation(context)
    api_key, model, base_url = _config()
    if not api_key:
        return fallback
    try:
        llm = _build_llm(api_key, model, base_url)
        task = context["task"]
        prompt = (
            f"【运输任务】{task['origin']} → {task['destination']}，"
            f"{task['variety_name']} {task['quantity_tons']} 吨，"
            f"最晚到货 {task['deadline_date'] or '未指定'}\n"
            f"【方案结论】{fallback}\n"
            f"【用户问题】{question or '为什么这样推荐？'}\n"
            "请基于以上结论回答，不得编造结论之外的数字。"
        )
        message = llm.invoke([("system", SYSTEM_PROMPT), ("human", prompt)])
        text = (message.content or "").strip()
        return text or fallback
    except Exception:
        logger.exception("Qwen 方案解释失败，回退规则版")
        return fallback
