"""Qwen 大模型解读层：把确定性研判骨架解释成自然语言。

分工与设计规格一致：行动建议、比例和时间窗由普通 Python 规则计算，
LangChain + Qwen 只负责组织自然语言解读，不允许改变确定性结论。
未配置 QWEN_API_KEY 或模型调用失败时返回 None，由规则版兜底。
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

logger = logging.getLogger("zhan.analysis.llm")

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

# 为 None 时每次调用重读 .env，填入 key 无需重启进程即可生效；
# 测试可通过 monkeypatch 该值模拟已/未配置。
QWEN_API_KEY: str | None = None

DEFAULT_MODEL = "qwen-plus"
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

SYSTEM_PROMPT = (
    "你是粮达网 Plus 的行情研判助手「瞻小二」。"
    "采购行动建议（行动类型、采购比例、时间窗）已由确定性规则算好，"
    "你的任务只是把这些结构化结论和证据解释成一段连贯、专业的中文解读。"
    "要求：不得更改或推翻规则结论；不得编造规则结论之外的数据；"
    "解读需覆盖建议理由、主要风险与需要继续观察的信号；150~250 字。"
)


class Interpretation(BaseModel):
    """大模型输出的结构化解读。"""

    interpretation: str = Field(description="对研判结论的综合解读段落")


def _config() -> tuple[str, str, str]:
    """返回 (api_key, model, base_url)；未打桩时重读 .env。"""
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


def qwen_available() -> bool:
    return bool(_config()[0])


def interpret_judgment(skeleton: dict, conditions: dict) -> str | None:
    """调用 Qwen 生成研判解读；未配置 key 或调用失败时返回 None。"""
    api_key, model, base_url = _config()
    if not api_key:
        return None
    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=base_url,
            temperature=0.3,
            timeout=180,
            max_retries=1,
        )
        prompt = (
            "【用户采购条件】\n"
            f"品种：{conditions.get('variety_name')}\n"
            f"数量：{conditions.get('quantity_tons')} 吨\n"
            f"最晚采购时间：{conditions.get('deadline_date')}\n"
            f"其他：{conditions.get('extra') or '无'}\n\n"
            "【规则研判结论】\n"
            f"行动建议：{skeleton['action_label']}"
            + (
                f"，先锁定 {skeleton['ratio_low']}%~{skeleton['ratio_high']}%"
                if skeleton.get("ratio_low") is not None
                else ""
            )
            + "\n"
            f"时间窗：{skeleton.get('time_window') or '无'}\n"
            f"结论摘要：{skeleton['summary']}\n"
            f"支持依据：{'; '.join(skeleton['supporting']) or '无'}\n"
            f"反对依据：{'; '.join(skeleton['opposing']) or '无'}\n"
            f"失效条件：{'; '.join(skeleton['invalidation']) or '无'}\n"
            f"观察指标：{'; '.join(skeleton['watch_metrics']) or '无'}\n"
            f"数据缺失：{'; '.join(skeleton['missing_data']) or '无'}\n"
            "注意：以上行情为演示数据。请输出解读段落。"
        )
        structured = llm.with_structured_output(Interpretation)
        result = structured.invoke(
            [("system", SYSTEM_PROMPT), ("human", prompt)]
        )
        text = result.interpretation.strip() if result else ""
        return text or None
    except Exception:
        # 模型失败不阻塞研判：规则化骨架仍然完整可用，仅记录日志便于排查
        logger.exception("Qwen 研判解读调用失败，回退规则版")
        return None
