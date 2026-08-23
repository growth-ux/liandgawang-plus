"""粮小二候选粮源的 AI 解读层。"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

logger = logging.getLogger("liang.compare.llm")
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
DEFAULT_MODEL = "qwen-plus"
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"


class ItemReview(BaseModel):
    listing_id: int
    advantages: list[str] = Field(max_length=3)
    risks: list[str] = Field(max_length=3)


class ComparisonInterpretation(BaseModel):
    summary: str
    recommendation: str
    key_differences: list[str]
    item_reviews: list[ItemReview]


def _config() -> tuple[str, str, str]:
    load_dotenv(_ENV_PATH, override=True)
    return (
        os.getenv("QWEN_API_KEY", "").strip(),
        os.getenv("QWEN_MODEL", DEFAULT_MODEL),
        os.getenv("QWEN_BASE_URL", DEFAULT_BASE_URL),
    )


def _fallback(listings: list[dict]) -> dict:
    cheapest = min(listings, key=lambda item: float(item["price"]))
    largest = max(listings, key=lambda item: item["available_quantity_tons"])
    shippable = [item for item in listings if item.get("latest_ship_at")]
    earliest = min(shippable, key=lambda item: item["latest_ship_at"]) if shippable else None
    differences = [
        f"报价区间为 {min(float(item['price']) for item in listings):.0f}～{max(float(item['price']) for item in listings):.0f} 元/吨，最低报价为 {cheapest['listing_code']}。",
        f"可用量范围为 {min(item['available_quantity_tons'] for item in listings)}～{max(item['available_quantity_tons'] for item in listings)} 吨，{largest['listing_code']} 的可用量最高。",
    ]
    if earliest:
        differences.append(f"最早可确认发运窗口的是 {earliest['listing_code']}，最晚可发 {earliest['latest_ship_at']}。")
    reviews = []
    for item in listings:
        advantages = []
        risks = []
        if item["id"] == cheapest["id"]:
            advantages.append("当前候选中报价最低")
        if item["id"] == largest["id"]:
            advantages.append("当前候选中可用量最高")
        if earliest and item["id"] == earliest["id"]:
            advantages.append("当前候选中发运窗口更靠前")
        if not item.get("latest_ship_at"):
            risks.append("缺少最晚可发信息，需先确认装运窗口")
        if item.get("moisture_pct") is None or item.get("test_weight_g_l") is None:
            risks.append("质检字段不完整，需补充正式质检单")
        reviews.append({
            "listing_id": item["id"],
            "advantages": advantages or ["基础粮源信息完整，可纳入后续议价"],
            "risks": risks or ["报价有效期、库存锁定和质检单仍需交易前核验"],
        })
    return {
        "summary": f"已对 {len(listings)} 条候选粮源完成报价、可用量、发运和质检字段的横向核对。不同粮源在成本、供货规模与发运确定性之间存在取舍，应结合实际采购数量和到货要求决策。",
        "recommendation": f"若以降低采购单价为优先，可优先核验 {cheapest['listing_code']}；若以供货规模为优先，可重点关注 {largest['listing_code']}。确认前请同步核验库存锁定、报价口径与正式质检单。",
        "key_differences": differences,
        "item_reviews": reviews,
        "source": "rule",
    }


def interpret_comparison(listings: list[dict]) -> dict:
    """优先调用 Qwen，失败时回退为基于同一批字段的规则解读。"""
    fallback = _fallback(listings)
    api_key, model, base_url = _config()
    if not api_key:
        return fallback
    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(model=model, api_key=api_key, base_url=base_url, temperature=0.2, timeout=60, max_retries=1)
        prompt = (
            "请根据以下已选候选粮源做采购前横向解读。仅可使用给定字段，不得编造运费、信用、库存状态或行情预测；"
            "不做绝对承诺。每条粮源都必须给出优势和风险，风险至少包含交易前需要核验的信息。\n\n"
            f"候选粮源：{listings}"
        )
        result = llm.with_structured_output(ComparisonInterpretation).invoke([
            ("system", "你是粮达网 Plus 的粮小二，负责协助采购员对多条候选粮源做客观、专业、可执行的对比解读。"),
            ("human", prompt),
        ])
        return {**result.model_dump(), "source": "llm"} if result else fallback
    except Exception:
        logger.exception("候选粮源 AI 对比调用失败，回退规则解读")
        return fallback
