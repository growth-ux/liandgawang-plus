import json
import logging
import os
import re
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv

from app.costing.schemas import CostComparison

logger = logging.getLogger("suan.costing.llm")
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
QWEN_API_KEY: str | None = None
DEFAULT_MODEL = "qwen-plus"
DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"


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


# ─── 规则降级：报价提取 ──────────────────────────────────────────────────────

# 方案分隔：按"方案X"、分号、或明确分隔切分
_SCHEME_SPLIT = re.compile(r"(?:方案\s*[A-Zａ-ｚＡ-Ｚ\d]+|；\s*(?:方案|[A-Z\d]))")

_VARIETY_KEYWORDS = ["玉米", "大豆", "小麦", "水稻", "稻谷", "高粱", "粳稻", "籼稻"]
_QUANTITY_RE = re.compile(r"(\d+(?:\.\d+)?)\s*吨")
_PRICE_RE = re.compile(r"(?:含税|出厂|到厂|平仓)?\s*(\d+(?:\.\d+)?)\s*元\s*/\s*吨")
_FREIGHT_RE = re.compile(r"(?:运费|运输|物流)\s*(\d+(?:\.\d+)?)\s*元\s*/\s*吨")
_LOADING_RE = re.compile(r"(?:装卸|装车|卸车)\s*(\d+(?:\.\d+)?)\s*元\s*/\s*吨")
_LOSS_RE = re.compile(r"(?:损耗|损耗率|途耗)\s*(\d+(?:\.\d+)?)\s*%")
_QUALITY_RE = re.compile(r"(?:扣价|质量折价|水分折价|杂质折价|容重扣价)\s*(\d+(?:\.\d+)?)\s*元")
_FINANCING_RE = re.compile(r"(?:资金|融资|利息|资金成本|资金占用)\s*(\d+(?:\.\d+)?)\s*(?:元|万)")


def _extract_one(text: str) -> dict:
    variety = next((v for v in _VARIETY_KEYWORDS if v in text), None)
    qty_m = _QUANTITY_RE.search(text)
    price_matches = _PRICE_RE.findall(text)
    freight_m = _FREIGHT_RE.search(text)
    loading_m = _LOADING_RE.search(text)
    loss_m = _LOSS_RE.search(text)
    quality_m = _QUALITY_RE.search(text)
    fin_m = _FINANCING_RE.search(text)

    # 含税判断
    tax_included = True if "含税" in text else (False if "不含税" in text else None)

    fin_val = None
    if fin_m:
        val = Decimal(fin_m.group(1))
        if "万" in text[fin_m.start():fin_m.end() + 2]:
            val = val * Decimal("10000")
        fin_val = str(val)

    return {
        "variety_name": variety,
        "quantity_tons": qty_m.group(1) if qty_m else None,
        "purchase_price_yuan_per_ton": price_matches[0] if price_matches else None,
        "tax_included": tax_included,
        "quality_discount_yuan_per_ton": quality_m.group(1) if quality_m else None,
        "freight_yuan_per_ton": freight_m.group(1) if freight_m else None,
        "loading_yuan_per_ton": loading_m.group(1) if loading_m else None,
        "loss_rate_pct": loss_m.group(1) if loss_m else None,
        "financing_cost_yuan": fin_val,
        "other_cost_yuan": None,
    }


def _split_schemes(text: str) -> list[str]:
    # 优先按"方案A/B/C"模式切分
    parts = re.split(r"(?=(?:方案\s*[A-ZＡ-Ｚ\d]))", text)
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) >= 2:
        return parts
    # 退而用分号或换行切分
    parts = re.split(r"[;；\n]", text)
    parts = [p.strip() for p in parts if p.strip() and _QUANTITY_RE.search(p)]
    return parts if len(parts) >= 2 else [text]


# ─── 高影响补问 ──────────────────────────────────────────────────────────────

QUESTION_FIELDS = [
    ("tax_included", "这些报价是否都是含税价？"),
    ("loading_yuan_per_ton", "运费是否已经包含装卸费用？"),
    ("quality_discount_yuan_per_ton", "是否有水分、杂质或容重扣价？"),
    ("loss_rate_pct", "本次预计运输损耗率是多少？"),
    ("financing_cost_yuan", "是否需要计入本次资金占用成本？"),
]


def _high_impact_questions(schemes: list[dict]) -> list[str]:
    questions = []
    for field, question in QUESTION_FIELDS:
        if any(item.get(field) is None for item in schemes):
            questions.append(question)
        if len(questions) == 2:
            break
    return questions


# ─── 入口：报价提取 ──────────────────────────────────────────────────────────

def extract_schemes(text: str) -> dict:
    parts = _split_schemes(text)
    schemes = []
    for i, part in enumerate(parts[:3]):
        extracted = _extract_one(part)
        extracted["scheme_id"] = chr(65 + i)  # A, B, C
        # 自动命名
        name_parts = []
        if extracted["variety_name"]:
            name_parts.append(extracted["variety_name"])
        qty = extracted["quantity_tons"]
        if qty:
            name_parts.append(f"{qty}吨")
        extracted["name"] = "方案" + chr(65 + i) + (" " + " ".join(name_parts) if name_parts else "")
        schemes.append(extracted)

    questions = _high_impact_questions(schemes)
    return {
        "llm_available": False,
        "schemes": schemes,
        "questions": questions,
    }


# ─── 入口：结果解释 ──────────────────────────────────────────────────────────

def _fallback_explain(comparison: CostComparison) -> str:
    results = comparison.results
    if comparison.recommended_scheme_id is None:
        return "所有方案均不满足硬性条件，无法推荐。请检查数量、质量或到货条件。"

    best = next(r for r in results if r.scheme_id == comparison.recommended_scheme_id)
    parts = [f"推荐方案 {best.scheme_id}（{best.name}），到厂吨成本 {best.delivered_cost_yuan_per_ton} 元/吨。"]

    if comparison.differences:
        for diff in comparison.differences:
            other = next(r for r in results if r.scheme_id == diff.scheme_id)
            parts.append(
                f"方案 {other.scheme_id} 到厂吨成本高出 {diff.delivered_cost_delta_yuan_per_ton} 元/吨，"
                f"整单差额 {diff.total_cost_delta_yuan} 元。"
            )

    if comparison.contains_estimates:
        parts.append("当前结果包含估算项，建议确认后重新测算。")

    return "".join(parts)


def explain_comparison(comparison: CostComparison) -> str:
    fallback = _fallback_explain(comparison)
    api_key, model, base_url = _config()
    if not api_key:
        return fallback
    try:
        prompt = (
            "你是粮达e销 的算小二。以下数据已由确定性规则计算完成。"
            "只引用方案 ID 和已有字段进行解释，不得重新计算或生成新数字，"
            "不得使用'预计节省'等未经确认的表述。\n"
            + json.dumps(comparison.model_dump(mode="json"), ensure_ascii=False)
        )
        result = _build_llm(api_key, model, base_url).invoke(
            [("system", "你是粮达e销 的算小二，解释已完成的成本测算结果。"), ("human", prompt)]
        )
        text = result.content.strip() if hasattr(result, "content") else ""
        if not text or "预计节省" in text:
            return fallback
        return text
    except Exception:
        logger.exception("算小二解释失败，回退规则解释")
        return fallback


# ─── 入口：盈亏问题提取 ─────────────────────────────────────────────────────

_PRICE_CHANGE_RE = re.compile(r"(?:售价|销售价|卖价)\s*(?:跌|降|下降|低|减)\s*(\d+(?:\.\d+)?)\s*元")
_PRICE_UP_RE = re.compile(r"(?:售价|销售价|卖价)\s*(?:涨|上涨|升|高|加)\s*(\d+(?:\.\d+)?)\s*元")
_FREIGHT_CHANGE_RE = re.compile(r"(?:运费|运输|物流)\s*(?:涨|上涨|升|高|加|增加)\s*(\d+(?:\.\d+)?)\s*元")
_FREIGHT_DOWN_RE = re.compile(r"(?:运费|运输|物流)\s*(?:跌|降|下降|低|减|降)\s*(\d+(?:\.\d+)?)\s*元")
_LOSS_CHANGE_RE = re.compile(r"(?:损耗|损耗率|途耗)\s*(?:增加|涨|升|高)\s*(\d+(?:\.\d+)?)\s*%")
_LOSS_DOWN_RE = re.compile(r"(?:损耗|损耗率|途耗)\s*(?:减少|降|下降|低)\s*(\d+(?:\.\d+)?)\s*%")


def extract_profit_change(question: str) -> dict:
    result = {}
    m = _PRICE_CHANGE_RE.search(question)
    if m:
        result["selling_price_delta_yuan_per_ton"] = f"-{m.group(1)}"
    else:
        m = _PRICE_UP_RE.search(question)
        if m:
            result["selling_price_delta_yuan_per_ton"] = m.group(1)
    m = _FREIGHT_CHANGE_RE.search(question)
    if m:
        result["freight_delta_yuan_per_ton"] = m.group(1)
    else:
        m = _FREIGHT_DOWN_RE.search(question)
        if m:
            result["freight_delta_yuan_per_ton"] = f"-{m.group(1)}"
    m = _LOSS_CHANGE_RE.search(question)
    if m:
        result["loss_delta_pct"] = m.group(1)
    else:
        m = _LOSS_DOWN_RE.search(question)
        if m:
            result["loss_delta_pct"] = f"-{m.group(1)}"
    return result


# ─── 入口：上下文问答 ────────────────────────────────────────────────────────

def answer_with_context(tab: str, question: str, record: dict | None) -> str:
    api_key, model, base_url = _config()
    if not api_key:
        if tab == "costing":
            return "请提供需要比较的方案数据，或使用粘贴报价开始测算。"
        if tab == "profit":
            return "请先选择意向方案并输入预计销售价，即可计算盈亏。"
        return "可以在测算记录中查看历史测算，选择继续或复制。"
    try:
        system = "你是粮达e销 的算小二。基于当前业务上下文回答用户问题，不编造数字。"
        context = ""
        if record:
            context = f"\n当前记录：{json.dumps(record, ensure_ascii=False, default=str)}"
        prompt = f"当前 Tab：{tab}{context}\n用户问题：{question}"
        result = _build_llm(api_key, model, base_url).invoke(
            [("system", system), ("human", prompt)]
        )
        return result.content.strip() if hasattr(result, "content") else ""
    except Exception:
        logger.exception("算小二问答失败")
        return "当前 AI 服务暂不可用，请稍后重试或手动操作。"


# ─── 入口：经验摘要 ──────────────────────────────────────────────────────────

def summarize_experience(record: dict) -> str:
    """从已完成的测算记录中提炼一句可复用经验（不超过 80 字）。"""
    calc = record.get("calculation") or {}
    results = calc.get("results", [])
    diffs = calc.get("differences", [])
    selected = record.get("selected_scheme_id")
    profit = record.get("profit") or {}

    # 规则版：从差异中提取最大两项成本差异
    if not results:
        return f"{record.get('title', '测算')}完成，无足够数据提炼经验。"

    best_id = calc.get("recommended_scheme_id") or selected
    best = next((r for r in results if r["scheme_id"] == best_id), results[0])

    parts = [f"方案 {best['scheme_id']}（{best['name']}）到厂成本 {best['delivered_cost_yuan_per_ton']} 元/吨"]

    if diffs:
        main_diff = max(diffs, key=lambda d: abs(float(d.get("delivered_cost_delta_yuan_per_ton", 0))))
        parts.append(f"方案 {main_diff['scheme_id']} 高出 {main_diff['delivered_cost_delta_yuan_per_ton']} 元/吨")

    if profit:
        parts.append(f"吨毛利 {profit.get('profit_yuan_per_ton', '?')} 元")

    text = "，".join(parts)
    return text[:80] if len(text) > 80 else text
