"""自然语言采购目标提取：规则兜底 + 模型补充 + 企业记忆引用。"""

import logging
import os
import re
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv

from app.zhanggui.schemas import GoalField, GoalPreview, MemoryReference, MissionGoal

logger = logging.getLogger("zhanggui.goal_parser")

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

VARIETY_CODES = {"玉米": "corn", "小麦": "wheat", "大豆": "soybean", "稻谷": "rice"}
# “到X”匹配时排除的非地点词
_DESTINATION_BLOCKLIST = {"到货", "到厂", "到期", "到位", "到底", "到达"}


def _extract_variety(text: str) -> tuple[str, str]:
    for name, code in VARIETY_CODES.items():
        if name in text:
            return code, name
    return "corn", "玉米"


def _extract_quantity(text: str) -> str | None:
    m = re.search(r"(\d+(?:\.\d+)?)\s*吨", text)
    if not m:
        return None
    value = m.group(1)
    return value.rstrip("0").rstrip(".") if "." in value else value


def _extract_deadline_days(text: str) -> int | None:
    m = re.search(r"(?:未来|今后)?\s*(\d{1,3})\s*天(?:内|以内)?", text)
    return int(m.group(1)) if m else None


def _extract_destination(text: str) -> str | None:
    m = re.search(r"(?:运到|发到|送到|到)([\u4e00-\u9fa5]{2,6})", text)
    if m and m.group(1) not in _DESTINATION_BLOCKLIST and m.group(1)[:2] not in _DESTINATION_BLOCKLIST:
        return m.group(1)
    return None


def _extract_budget(text: str) -> str | None:
    m = re.search(r"(\d{3,5})\s*元\s*/\s*吨", text)
    return m.group(1) if m else None


def _extract_stock_days(text: str) -> int | None:
    m = re.search(r"库存(?:仅)?(?:可|还能)?(?:用|支撑|可用)?\s*(\d{1,3})\s*天", text)
    return int(m.group(1)) if m else None


def _extract_financing_gap(text: str) -> str | None:
    m = re.search(r"资金缺口(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*(万元|元)", text)
    if not m:
        return None
    value = float(m.group(1))
    if m.group(2) == "万元":
        value *= 10000
    return f"{int(value)}"


def _extract_priority(text: str) -> str:
    if re.search(r"成本最低|越便宜越好|尽量压低成本|控制成本优先", text):
        return "cost"
    if re.search(r"保供|不能影响生产|保证生产|连续生产|优先保证到货|不能断供", text):
        return "supply"
    return "supply"


def _rule_goal(text: str, today: date) -> MissionGoal:
    variety_code, variety_name = _extract_variety(text)
    grade_match = re.search(r"([一二三四])等", text)
    deadline_days = _extract_deadline_days(text)
    grade = f"{grade_match.group(1)}等" if grade_match else None

    hard_constraints: list[str] = []
    if grade:
        hard_constraints.append(f"质量不低于{grade}")
    if re.search(r"不能影响生产|保供|不能断供", text):
        hard_constraints.append("不能影响生产连续性")

    return MissionGoal(
        variety_code=variety_code,
        variety_name=variety_name,
        grade=grade,
        quantity_tons=_extract_quantity(text),
        deadline_date=(today + timedelta(days=deadline_days)).isoformat() if deadline_days else None,
        destination=_extract_destination(text),
        budget_yuan_per_ton=_extract_budget(text),
        stock_days=_extract_stock_days(text),
        financing_gap_yuan=_extract_financing_gap(text),
        priority=_extract_priority(text),
        hard_constraints=hard_constraints,
    )


class _GoalExtractionPatch:
    """LLM 结构化输出补丁：只允许补齐规则未识别的字段。"""

    def __init__(self):
        from pydantic import BaseModel, Field

        class GoalPatch(BaseModel):
            grade: str | None = None
            quantity_tons: str | None = Field(default=None, pattern=r"^\d+(?:\.\d+)?$")
            deadline_days: int | None = Field(default=None, ge=1, le=180)
            destination: str | None = None
            budget_yuan_per_ton: str | None = Field(default=None, pattern=r"^\d{3,5}$")
            stock_days: int | None = Field(default=None, ge=0, le=365)

        self.schema = GoalPatch


def _llm_patch(text: str, goal: MissionGoal, today: date) -> bool:
    """用模型补齐缺失字段；任何失败都保留规则结果。返回是否可用。"""
    load_dotenv(_ENV_PATH, override=True)
    api_key = os.getenv("QWEN_API_KEY", "").strip()
    if not api_key:
        return False
    try:
        from langchain_openai import ChatOpenAI

        patch_cls = _GoalExtractionPatch().schema
        llm = ChatOpenAI(
            model=os.getenv("QWEN_MODEL", "qwen-plus"),
            api_key=api_key,
            base_url=os.getenv("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            temperature=0,
            timeout=20,
            max_retries=1,
        )
        patch = llm.with_structured_output(patch_cls).invoke([
            ("system", "你是粮食采购目标解析助手。仅提取用户明确表达的条件；未明确的字段必须为 null，禁止推测。"),
            ("human", f"今天是{today.isoformat()}。采购目标描述：{text}"),
        ])
        if patch is None:
            return True
        data = patch.model_dump(exclude_none=True)
        if goal.grade is None and data.get("grade") in {"一等", "二等", "三等", "四等"}:
            goal.grade = data["grade"]
        if goal.quantity_tons is None and data.get("quantity_tons"):
            goal.quantity_tons = data["quantity_tons"]
        if goal.deadline_date is None and data.get("deadline_days"):
            goal.deadline_date = (today + timedelta(days=data["deadline_days"])).isoformat()
        if goal.destination is None and data.get("destination"):
            goal.destination = data["destination"]
        if goal.budget_yuan_per_ton is None and data.get("budget_yuan_per_ton"):
            goal.budget_yuan_per_ton = data["budget_yuan_per_ton"]
        if goal.stock_days is None and data.get("stock_days") is not None:
            goal.stock_days = data["stock_days"]
        return True
    except Exception:
        logger.exception("目标解析 LLM 补充失败，回退规则结果")
        return False


_FIELD_LABELS = [
    ("variety_name", "品种"),
    ("grade", "质量等级"),
    ("quantity_tons", "数量（吨）"),
    ("deadline_date", "最晚到货日期"),
    ("destination", "到货地点"),
    ("budget_yuan_per_ton", "综合成本预算（元/吨）"),
    ("stock_days", "现有库存可用天数"),
    ("financing_gap_yuan", "资金缺口（元）"),
]

# 缺少时需要向用户确认的高影响字段（按优先级）
_HIGH_IMPACT_KEYS = ["budget_yuan_per_ton", "deadline_date", "destination", "quantity_tons"]

_QUESTIONS = {
    "budget_yuan_per_ton": "本次采购的预算大约是多少元/吨？",
    "deadline_date": "这批粮最晚需要在什么时间到厂？",
    "destination": "请确认到货地点（到厂城市）。",
    "quantity_tons": "请确认本次采购数量（吨）。",
    "grade": "质量底线按哪个等级执行？",
}


def _build_fields(goal: MissionGoal, memory_priority: bool) -> list[GoalField]:
    fields = []
    for key, label in _FIELD_LABELS:
        value = getattr(goal, key)
        if value is not None:
            fields.append(GoalField(key=key, label=label, value=str(value), source="user"))
        elif key == "budget_yuan_per_ton":
            fields.append(GoalField(key=key, label=label, value=None, source="estimated", note="暂按估算，建议确认"))
        elif key in ("stock_days", "financing_gap_yuan"):
            fields.append(GoalField(key=key, label=label, value=None, source="estimated", note="未提及，暂不涉及"))
        else:
            fields.append(GoalField(key=key, label=label, value=None, source="estimated", note="待确认"))
    fields.append(GoalField(
        key="priority",
        label="采购优先级",
        value={"supply": "优先保供，再比较综合成本", "balanced": "保供与成本平衡", "cost": "成本优先"}[goal.priority],
        source="memory" if memory_priority else "user",
        note="来自企业过往经验" if memory_priority else "",
    ))
    return fields


def parse_goal(text: str, *, today: date, memories: list) -> GoalPreview:
    """规则提取目标字段，模型只补缺失项；记忆只作为引用，不覆盖用户输入。"""
    goal = _rule_goal(text, today)
    llm_available = _llm_patch(text, goal, today)

    memory_references = []
    for item in memories:
        if isinstance(item, str):
            memory_references.append(MemoryReference(content=item))
        elif isinstance(item, MemoryReference):
            memory_references.append(item)
        elif hasattr(item, "model_dump"):
            memory_references.append(MemoryReference.model_validate(item.model_dump()))
        elif isinstance(item, dict):
            memory_references.append(MemoryReference.model_validate(item))
    memory_priority = any("保供" in item.content for item in memory_references) and not re.search(r"成本优先|成本最低", text)

    questions = []
    for key in _HIGH_IMPACT_KEYS:
        if getattr(goal, key) in (None, ""):
            questions.append(_QUESTIONS[key])
        if len(questions) >= 2:
            break

    return GoalPreview(
        goal=goal,
        fields=_build_fields(goal, memory_priority),
        questions=questions,
        memory_references=memory_references,
        llm_available=llm_available,
    )
