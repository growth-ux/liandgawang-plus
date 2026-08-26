"""粮小二候选粮源的 AI 解读层。"""

import logging
import os
import re
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


class SourcingNeedExtraction(BaseModel):
    """LLM 从采购员自然语言中提取的寻源条件。"""

    variety: str | None = None
    quantity_tons: int | None = Field(default=None, ge=1)
    grade: str | None = None
    crop_year: int | None = Field(default=None, ge=2000, le=2100)
    deadline_days: int | None = Field(default=None, ge=1, le=90)
    budget_price: int | None = Field(default=None, ge=1)


class SourcingPickDecision(BaseModel):
    """LLM 从候选粮源中做出的主推/备选决策。"""

    primary_code: str
    backup_code: str | None = None
    summary: str
    decision_basis: list[str] = Field(min_length=1, max_length=3)
    procurement_advice: str


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


def extract_sourcing_need(text: str, fallback: dict) -> tuple[dict, str]:
    """优先由 LLM 理解自然语言需求；不可用时保留确定性解析结果。"""
    api_key, model, base_url = _config()
    if not api_key:
        return fallback, "rule"
    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(model=model, api_key=api_key, base_url=base_url, temperature=0, timeout=30, max_retries=1)
        logger.info("LLM 寻源需求解析请求开始: model=%s base_url=%s text=%s", model, base_url, text)
        result = llm.with_structured_output(SourcingNeedExtraction).invoke([
            ("system", "你是粮食采购需求解析助手。仅提取用户明确表达的品种、数量（吨）、等级、粮食年份、最晚发运天数和预算单价（元/吨）；未明确表达的字段必须为 null，禁止推测或补全。"),
            ("human", text),
        ])
        parsed = result.model_dump(exclude_none=True) if result else {}
        valid_varieties = {"玉米", "小麦", "大豆"}
        valid_grades = {"一等", "二等", "三等", "四等"}
        if parsed.get("variety") not in valid_varieties:
            parsed.pop("variety", None)
        if parsed.get("grade") not in valid_grades:
            parsed.pop("grade", None)
        return parsed or fallback, "llm"
    except Exception:
        logger.exception("寻源需求 LLM 解析失败，回退规则解析")
        return fallback, "rule"


def decide_sourcing_picks(need: dict | None, candidates: list[dict]) -> dict:
    """LLM 从规则排序后的候选粮源中真实决策主推与备选；不可用时回退规则前二。"""
    codes = [item["listing_code"] for item in candidates]

    def fallback() -> dict:
        primary, backup = candidates[0], (candidates[1] if len(candidates) > 1 else None)
        return {
            "primary_code": primary["listing_code"],
            "backup_code": backup["listing_code"] if backup else None,
            "summary": f"模型不可用，按规则排序选定主推 {primary['listing_code']}：信息完整度、综合到厂成本与发运条件优先。",
            "decision_basis": [
                f"主推综合到厂成本 {primary['delivered_price']} 元/吨，可用量 {primary['available_quantity_tons']} 吨",
                f"最晚可发 {primary['latest_ship_at'] or '待确认'}",
            ],
            "procurement_advice": f"优先向 {primary['supplier_name']} 确认库存锁定与正式质检单。" if not backup else f"成本优先可先核验 {primary['supplier_name']}；如更看重供应连续性，可同步保留 {backup['supplier_name']} 议价。",
            "source": "rule",
        }

    api_key, model, base_url = _config()
    if not api_key:
        return fallback()
    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(model=model, api_key=api_key, base_url=base_url, temperature=0.2, timeout=60, max_retries=1)
        logger.info("LLM 寻源比选决策请求开始: model=%s 候选=%s", model, codes)
        result = llm.with_structured_output(SourcingPickDecision).invoke([
            ("system", "你是粮食采购决策专家。请从候选粮源中选出主推与备选（候选不足两条时备选可为 null），综合权衡到厂成本、质量指标、发运窗口与信息完整度。只能使用给定字段，不得编造运费、库存、信用或行情；决策理由必须来自给定数据。所有 summary、decision_basis、procurement_advice 必须使用简体中文，禁止输出英文句子。预算为综合到厂价上限，严禁把高于预算的候选表述为满足预算。"),
            ("human", f"采购需求：{need or {}}\n候选粮源（已按规则预排序，仅供参考）：{candidates}\n请返回主推与备选的 listing_code 及决策说明。"),
        ])
        if not result:
            return fallback()
        decision = result.model_dump()
        # 只接受候选池内的选择，防止模型幻觉改变结果；备选与主推不能相同
        if decision.get("primary_code") not in codes:
            logger.warning("LLM 主推 %s 不在候选池内，回退规则决策", decision.get("primary_code"))
            return fallback()
        if decision.get("backup_code") not in codes or decision["backup_code"] == decision["primary_code"]:
            decision["backup_code"] = next((c for c in codes if c != decision["primary_code"]), None)
        # listing_code 可以保留英文编号；面向用户的解释不得出现英文句子。
        prose = " ".join([decision.get("summary", ""), *decision.get("decision_basis", []), decision.get("procurement_advice", "")])
        prose_without_codes = re.sub(r"\b[A-Z]+-[A-Z0-9-]+\b", "", prose)
        if re.search(r"[A-Za-z]{3,}", prose_without_codes):
            logger.warning("LLM 比选说明包含英文内容，回退规则决策")
            return fallback()
        return {**decision, "source": "llm"}
    except Exception:
        logger.exception("寻源比选 LLM 决策失败，回退规则前二")
        return fallback()


def interpret_comparison(listings: list[dict]) -> dict:
    """优先调用 Qwen，失败时回退为基于同一批字段的规则解读。"""
    fallback = _fallback(listings)
    api_key, model, base_url = _config()
    if not api_key:
        return fallback
    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(model=model, api_key=api_key, base_url=base_url, temperature=0.2, timeout=60, max_retries=1)
        logger.info("LLM 候选粮源对比解读请求开始: model=%s 候选=%s条", model, len(listings))
        prompt = (
            "请根据以下已选候选粮源做采购前横向解读。仅可使用给定字段，不得编造运费、信用、库存状态或行情预测；"
            "不做绝对承诺。每条粮源都必须给出优势和风险，风险至少包含交易前需要核验的信息。\n\n"
            f"候选粮源：{listings}"
        )
        result = llm.with_structured_output(ComparisonInterpretation).invoke([
            ("system", "你是粮达e销 的粮小二，负责协助采购员对多条候选粮源做客观、专业、可执行的对比解读。"),
            ("human", prompt),
        ])
        return {**result.model_dump(), "source": "llm"} if result else fallback
    except Exception:
        logger.exception("候选粮源 AI 对比调用失败，回退规则解读")
        return fallback
