"""Qwen 大模型解读层：把确定性研判骨架解释成自然语言。

分工与设计规格一致：行动建议、比例和时间窗由普通 Python 规则计算，
LangChain + Qwen 只负责组织自然语言解读，不允许改变确定性结论。
未配置 QWEN_API_KEY 或模型调用失败时返回 None，由规则版兜底。
"""

import logging
import os
import re
from datetime import date, timedelta
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


def interpret_judgment(skeleton: dict, conditions: dict, timeout_seconds: float = 180) -> str | None:
    """调用 Qwen 生成研判解读；未配置 key 或调用失败时返回 None。

    粮掌柜编排内调用时传更短的超时（worker 有 30 秒上限）。
    """
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
            timeout=timeout_seconds,
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


# ─── 一句话采购需求 → 结构化条件（确定性规则提取，不依赖大模型） ────────────────
# 与算小二报价提取同模式：正则抽取可识别字段，未识别的留给用户在表单里确认补全。

_VARIETY_CODES = {"玉米": "corn", "小麦": "wheat", "大豆": "soybean", "稻谷": "rice", "水稻": "rice"}
_QUANTITY_RE = re.compile(r"(\d+(?:\.\d+)?)\s*吨")
_WITHIN_DAYS_RE = re.compile(r"(\d+)\s*天内")
_FULL_DATE_RE = re.compile(r"(\d{4})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})")
_MD_DATE_RE = re.compile(r"(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]")
_GRADE_RE = re.compile(r"(一等|二等|三等)")
_REGIONS = [
    "东北", "华北", "黄淮", "锦州", "鲅鱼圈", "北方港", "南方港",
    "黑龙江", "吉林", "辽宁", "内蒙古", "山东", "河南", "河北",
    "广东", "蛇口", "广西", "四川", "云南", "长江沿线",
]
_BUDGET_RE = re.compile(r"(?:预算|不超过|不高于|控制在|低于)\s*(?:约|在)?\s*(\d{3,5}(?:\.\d+)?)")
_STOCK_DAYS_RE = re.compile(r"(?:库存|余粮|厂里)\s*(?:还|也)?\s*(?:能|可)?\s*(?:用|撑|支撑|够用)\s*(\d+)\s*天")
_RISK_MAP = {"稳健": "稳健", "保守": "保守", "积极": "积极", "激进": "积极"}
_REMARK_KEYWORDS = re.compile(r"水分|杂质|容重|霉变|到货|到厂|卸车|运输方式|袋装|散装")
# 缺失字段的展示名称，前端按此提示用户补全；前四项为研判必填
MISSING_LABELS = [
    ("variety_code", "品种"),
    ("quantity_tons", "采购数量"),
    ("deadline_date", "最晚采购时间"),
    ("target_region", "目标地区"),
    ("budget_price", "目标预算"),
    ("stock_days", "库存可用天数"),
    ("risk_preference", "风险偏好"),
]


def _resolve_deadline(text: str, today: date) -> date | None:
    """识别绝对日期（2026-09-30 / 9月30日）、月底、相对天数（10天内）。"""
    m = _FULL_DATE_RE.search(text)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    m = _MD_DATE_RE.search(text)
    if m:
        try:
            d = date(today.year, int(m.group(1)), int(m.group(2)))
        except ValueError:
            return None
        return d if d >= today else date(today.year + 1, d.month, d.day)
    if "月底" in text:
        if today.month == 12:
            return date(today.year, 12, 31)
        return date(today.year, today.month + 1, 1) - timedelta(days=1)
    m = _WITHIN_DAYS_RE.search(text)
    if m:
        return today + timedelta(days=int(m.group(1)))
    return None


def extract_conditions(text: str) -> dict:
    """把一句话采购需求拆成结构化条件，返回 fields 与缺失项标签列表。"""
    today = date.today()

    variety = next((code for name, code in _VARIETY_CODES.items() if name in text), None)
    qty_m = _QUANTITY_RE.search(text)
    deadline = _resolve_deadline(text, today)
    grade_m = _GRADE_RE.search(text)
    region = next((r for r in _REGIONS if r in text), None)
    budget_m = _BUDGET_RE.search(text)
    stock_m = _STOCK_DAYS_RE.search(text)
    risk = next((v for k, v in _RISK_MAP.items() if k in text), None)

    # 备注：取含质量/到货要求且非“N 天内”期限的子句，避免与最晚时间重复
    clauses = [c.strip() for c in re.split(r"[，,。；;]", text) if c.strip()]
    remark_parts = [
        c for c in clauses
        if _REMARK_KEYWORDS.search(c) and not _WITHIN_DAYS_RE.search(c)
    ]
    remark = "，".join(remark_parts)[:256] or None

    fields = {
        "variety_code": variety,
        "quantity_tons": qty_m.group(1) if qty_m else None,
        "deadline_date": deadline.isoformat() if deadline else None,
        "grade": grade_m.group(1) if grade_m else None,
        "target_region": region,
        "budget_price": budget_m.group(1) if budget_m else None,
        "stock_days": int(stock_m.group(1)) if stock_m else None,
        "risk_preference": risk,
        "remark": remark,
    }
    missing = [label for key, label in MISSING_LABELS if fields[key] is None]
    return {"fields": fields, "missing": missing}
