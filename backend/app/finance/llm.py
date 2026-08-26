import json
import logging
import os
import re
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from app.finance.schemas import MatchPreview

logger = logging.getLogger("qian.finance.llm")
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
QWEN_API_KEY: str | None = None
DEFAULT_MODEL = "qwen-plus"
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"


# ─── LangChain 结构化模型 ────────────────────────────────────────────────────

class RequirementExtraction(BaseModel):
    purpose: str | None = None
    amount_yuan: Decimal | None = None
    duration_days: int | None = None
    business_years: Decimal | None = None
    guarantee_modes: list[str] | None = None
    credentials: list[str] | None = None
    assumptions: list[str] = Field(default_factory=list)
    question: str | None = None


class MatchExplanation(BaseModel):
    referenced_product_codes: list[str] = Field(default_factory=list)
    summary: str


SYSTEM_PROMPT = (
    "你是粮达e销 的资金服务助手钱小二。只把用户描述抽取为资金需求字段，"
    "不得推荐金融产品，不得编造额度、利率、期限、授信或放款结果。"
    "purpose 只能是 grain_purchase、inventory_turnover、receivable_turnover；"
    "guarantee_modes 和 credentials 只能使用提示中给定的枚举。"
)

EXPLANATION_SYSTEM_PROMPT = (
    "你是粮达e销 的资金服务助手钱小二。你的任务是解释已经由确定性规则形成的"
    "金融产品匹配结果。不得新增产品、数字、条件，不得承诺授信、审批或放款。"
)


# ─── 配置与 LLM 构建 ─────────────────────────────────────────────────────────

def _config() -> tuple[str, str, str]:
    if QWEN_API_KEY is not None:
        return QWEN_API_KEY, os.getenv("QWEN_MODEL", DEFAULT_MODEL), os.getenv("QWEN_BASE_URL", DEFAULT_BASE_URL)
    load_dotenv(_ENV_PATH, override=True)
    return (
        os.getenv("QWEN_API_KEY", "").strip(),
        os.getenv("QWEN_MODEL", DEFAULT_MODEL),
        os.getenv("QWEN_BASE_URL", DEFAULT_BASE_URL),
    )


def _build_llm(api_key: str, model: str, base_url: str):
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(model=model, api_key=api_key, base_url=base_url,
                      temperature=0.1, timeout=120, max_retries=1)


# ─── 固定补问顺序 ────────────────────────────────────────────────────────────

def _question_for(fields: dict) -> str | None:
    if fields["amount_yuan"] is None:
        return "本次资金缺口是多少？"
    if fields["duration_days"] is None:
        return "预计需要使用资金多久？"
    if fields["purpose"] is None:
        return "这笔资金主要用于采购、库存周转还是应收周转？"
    if fields["business_years"] is None:
        return "企业持续经营多久了？"
    return None


# ─── 规则降级抽取 ────────────────────────────────────────────────────────────

def _fallback_extract(text: str) -> dict:
    amount = None
    amount_match = re.search(r"(?:缺口|还缺|缺|需要|融资)\s*(\d+(?:\.\d+)?)\s*万", text)
    if amount_match:
        amount = Decimal(amount_match.group(1)) * Decimal("10000")
    days_match = re.search(r"(\d+)\s*天", text)
    years_match = re.search(r"(?:经营|成立)\D{0,4}(\d+(?:\.\d+)?)\s*年", text)
    credentials = []
    for keyword, code in {
        "采购合同": "purchase_contract", "采购订单": "purchase_order",
        "仓单": "warehouse_receipt", "货权": "controlled_goods",
        "应收账款": "receivable_invoice", "交货单": "delivery_receipt",
        "银行流水": "bank_flow", "营业执照": "business_license",
    }.items():
        if keyword in text:
            credentials.append(code)
    guarantee_modes = ["credit"] if "没有抵押" in text or "无抵押" in text else None
    fields = {
        "purpose": "grain_purchase" if "采购" in text else None,
        "amount_yuan": str(amount.quantize(Decimal("1"))) if amount is not None else None,
        "duration_days": int(days_match.group(1)) if days_match else None,
        "business_years": years_match.group(1) if years_match else None,
        "guarantee_modes": guarantee_modes,
        "credentials": credentials or None,
    }
    question = _question_for(fields)
    return {"llm_available": False, "fields": fields, "assumptions": [], "question": question}


# ─── 入口：抽取需求 ───────────────────────────────────────────────────────────

def extract_requirement(text: str) -> dict:
    fallback = _fallback_extract(text)
    api_key, model, base_url = _config()
    if not api_key:
        return fallback
    try:
        result = _build_llm(api_key, model, base_url).with_structured_output(
            RequirementExtraction
        ).invoke([("system", SYSTEM_PROMPT), ("human", text)])
        if result is None:
            return fallback
        purpose = result.purpose if result.purpose in {
            "grain_purchase", "inventory_turnover", "receivable_turnover"
        } else None
        guarantees = [item for item in (result.guarantee_modes or []) if item in {
            "credit", "guarantee", "order", "warehouse_receipt", "controlled_goods", "receivable"
        }] or None
        credentials = [item for item in (result.credentials or []) if item in {
            "purchase_contract", "purchase_order", "warehouse_receipt", "controlled_goods",
            "receivable_invoice", "delivery_receipt", "business_license", "bank_flow"
        }] or None
        fields = {
            "purpose": purpose,
            "amount_yuan": str(result.amount_yuan) if result.amount_yuan and result.amount_yuan > 0 else None,
            "duration_days": result.duration_days if result.duration_days and result.duration_days > 0 else None,
            "business_years": str(result.business_years) if result.business_years is not None else None,
            "guarantee_modes": guarantees,
            "credentials": credentials,
        }
        return {
            "llm_available": True,
            "fields": fields,
            "assumptions": result.assumptions,
            "question": _question_for(fields),
        }
    except Exception:
        logger.exception("钱小二需求抽取失败，回退规则抽取")
        return fallback


# ─── 规则版解释 ───────────────────────────────────────────────────────────────

def _fallback_explanation(preview: MatchPreview) -> str:
    if preview.primary is None:
        return "当前产品池中没有完全符合本次金额、期限和办理条件的产品，请调整条件或咨询金融顾问。"
    primary = preview.primary
    text = (
        f"主推{primary.product.name}："
        + "；".join(primary.matched_reasons[:3])
        + f"。参考资金成本约{primary.estimated_cost_yuan}元。"
    )
    if primary.pending_conditions:
        text += "仍需确认：" + "；".join(primary.pending_conditions) + "。"
    if preview.backups:
        text += "备选为" + "、".join(x.product.name for x in preview.backups) + "。"
    return text


# ─── 解释匹配结果 ─────────────────────────────────────────────────────────────

def explain_match(preview: MatchPreview) -> str:
    fallback = _fallback_explanation(preview)
    api_key, model, base_url = _config()
    if not api_key:
        return fallback
    allowed_codes = {
        item.product.product_code
        for item in ([preview.primary] if preview.primary else []) + preview.backups + preview.rejected
    }
    prompt = (
        "以下是确定性规则形成的金融产品匹配结果。只能解释已有结论，不得新增产品、"
        "额度、利率、期限、授信或放款承诺。\n"
        + json.dumps(preview.model_dump(mode="json"), ensure_ascii=False)
    )
    try:
        result = _build_llm(api_key, model, base_url).with_structured_output(
            MatchExplanation
        ).invoke([("system", EXPLANATION_SYSTEM_PROMPT), ("human", prompt)])
        if result is None or not result.summary.strip():
            return fallback
        if not set(result.referenced_product_codes).issubset(allowed_codes):
            return fallback
        return result.summary.strip()
    except Exception:
        logger.exception("钱小二匹配解释失败，回退规则解释")
        return fallback
