"""粮小二寻源任务的 LangGraph 状态机。"""

import re
from datetime import date, timedelta
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from app.liang.llm import extract_sourcing_need, review_sourcing_ranking


GRADE_ORDER = ["一等", "二等", "三等", "四等"]
FREIGHT_ADJUSTMENT = {"出厂价": 90, "港口价": 40, "到库价": 0}
VARIETY_STD = {
    "玉米": {"moisture": 14.0, "test_weight": 685},
    "小麦": {"moisture": 12.5, "test_weight": 770},
    "大豆": {"moisture": 13.0, "test_weight": 680},
}
FIXED_VERIFICATIONS = [
    "确认可锁定库存",
    "获取正式质检单",
    "确认报价有效期与含税口径",
    "确认装运窗口",
    "核验供应方主体与联系人",
]


class TraceItem(TypedDict):
    node: Literal["parse", "load", "filter", "sort", "eliminate", "pick", "review", "verify"]
    status: Literal["done", "skipped"]
    detail: str


class SourcingState(TypedDict, total=False):
    raw_text: str
    listings: list[dict]
    need: dict | None
    passed: list[dict]
    ranked: list[dict]
    eliminated: list[dict]
    plan: dict
    trace: list[TraceItem]
    parser_source: Literal["llm", "rule"]


def _append_trace(state: SourcingState, node: TraceItem["node"], status: TraceItem["status"], detail: str) -> list[TraceItem]:
    return [*state.get("trace", []), {"node": node, "status": status, "detail": detail}]


def _parse_need(text: str) -> dict:
    need: dict = {}
    for variety in VARIETY_STD:
        if variety in text:
            need["variety"] = variety
            break
    grade = re.search(r"([一二三四])等", text)
    if grade:
        need["grade"] = f"{grade.group(1)}等"
    quantity = re.search(r"(\d+)\s*吨", text)
    if quantity:
        need["quantity_tons"] = int(quantity.group(1))
    deadline = re.search(r"(\d+)\s*天(?:内|以内)?(?:可发|发运|到货)?", text)
    if deadline:
        need["deadline_days"] = int(deadline.group(1))
    year = re.search(r"(20\d{2})\s*年", text)
    if year:
        need["crop_year"] = int(year.group(1))
    budget = re.search(r"(?:预算|不超过|低于|≤)\s*(\d{3,5})", text)
    if budget:
        need["budget_price"] = int(budget.group(1))
    return need


def _grade_rank(value: str) -> int:
    return GRADE_ORDER.index(value) if value in GRADE_ORDER else 99


def _hard_fail(listing: dict, need: dict) -> tuple[str, str] | None:
    if need.get("variety") and listing["variety_name"] != need["variety"]:
        return "VARIETY_MISMATCH", f"品种为{listing['variety_name']}，与需求的{need['variety']}不符"
    if need.get("quantity_tons") is not None and listing["available_quantity_tons"] < need["quantity_tons"]:
        return "QUANTITY_INSUFFICIENT", f"可用量 {listing['available_quantity_tons']} 吨，不足需求的 {need['quantity_tons']} 吨"
    if need.get("grade") and _grade_rank(listing["grade"]) > _grade_rank(need["grade"]):
        return "GRADE_BELOW_REQUIREMENT", f"等级为{listing['grade']}，低于需求的{need['grade']}"
    if need.get("crop_year") is not None and listing["crop_year"] != need["crop_year"]:
        return "CROP_YEAR_MISMATCH", f"年份为{listing['crop_year']}，与需求的{need['crop_year']}不符"
    if need.get("budget_price") is not None and float(listing["price"]) > need["budget_price"]:
        return "PRICE_OVER_BUDGET", f"报价 {listing['price']} 元/吨，超过预算 {need['budget_price']} 元/吨"
    if need.get("deadline_days") is not None:
        latest = listing.get("latest_ship_at")
        if not latest:
            return "REQUIRED_FIELD_MISSING", "缺少发运窗口，无法确认能否按时交付"
        deadline = date.today() + timedelta(days=need["deadline_days"])
        if date.fromisoformat(latest) > deadline:
            return "SHIP_WINDOW_MISSED", f"最晚可发 {latest}，晚于需求期限"
    return None


def _missing_count(listing: dict) -> int:
    return sum(value is None for value in (listing.get("earliest_ship_at"), listing.get("latest_ship_at"), listing.get("moisture_pct"), listing.get("test_weight_g_l")))


def _quality_penalty(listing: dict) -> int:
    standard = VARIETY_STD.get(listing["variety_name"], VARIETY_STD["玉米"])
    penalty = 0.0
    if listing.get("moisture_pct") is not None:
        penalty += max(0, float(listing["moisture_pct"]) - standard["moisture"]) * 30
    if listing.get("impurity_pct") is not None:
        penalty += max(0, float(listing["impurity_pct"]) - 1) * 20
    if listing.get("test_weight_g_l") is not None:
        penalty += max(0, standard["test_weight"] - float(listing["test_weight_g_l"]))
    return round(penalty)


def _sort_key(listing: dict) -> tuple:
    latest = listing.get("latest_ship_at") or "9999-12-31"
    total_cost = float(listing["price"]) + FREIGHT_ADJUSTMENT.get(listing["price_type"], 0) + _quality_penalty(listing)
    return _missing_count(listing), -listing["crop_year"], total_cost, latest, listing["id"]


def _pick(listing: dict) -> dict:
    standard = VARIETY_STD.get(listing["variety_name"])
    penalty = _quality_penalty(listing)
    reasons = [f"{listing['crop_year']} 年新粮，{listing['grade']}，{listing['origin_province']}产区"]
    if standard and listing.get("moisture_pct") is not None and float(listing["moisture_pct"]) <= standard["moisture"]:
        reasons.append(f"水分 {listing['moisture_pct']}% 优于标准 {standard['moisture']}%")
    if standard and listing.get("test_weight_g_l") is not None and float(listing["test_weight_g_l"]) >= standard["test_weight"]:
        reasons.append(f"容重 {listing['test_weight_g_l']} g/L 达标")
    risks = []
    if _missing_count(listing):
        risks.append("部分关键字段待核验")
    if penalty:
        risks.append(f"质量折价 {penalty} 元/吨已计入")
    return {
        "listing_code": listing["listing_code"], "variety_name": listing["variety_name"], "grade": listing["grade"],
        "crop_year": listing["crop_year"], "origin": f"{listing['origin_province']} {listing['origin_city']}",
        "supplier_name": listing["supplier_name"], "price": listing["price"], "price_type": listing["price_type"],
        "available_quantity_tons": listing["available_quantity_tons"], "latest_ship_at": listing.get("latest_ship_at"),
        "reasons": reasons, "risks": risks, "delivered_price": f"{float(listing['price']) + FREIGHT_ADJUSTMENT.get(listing['price_type'], 0) + penalty:.2f}",
        "quality_penalty": str(penalty), "moisture_pct": listing.get("moisture_pct"),
        "test_weight_g_l": listing.get("test_weight_g_l"), "impurity_pct": listing.get("impurity_pct"),
    }


def _need_summary(need: dict) -> dict:
    return {
        "variety": need.get("variety"), "quantity_tons": need.get("quantity_tons"), "grade": need.get("grade"),
        "crop_year": need.get("crop_year"), "deadline": (date.today() + timedelta(days=need["deadline_days"])).isoformat() if need.get("deadline_days") is not None else None,
        "budget_price": need.get("budget_price"),
    }


def parse_node(state: SourcingState) -> dict:
    rule_need = _parse_need(state["raw_text"])
    need, source = extract_sourcing_need(state["raw_text"], rule_need)
    detail = "LLM 已提取采购需求字段" if source == "llm" and need else "已通过规则提取采购需求字段" if need else "未提取到可执行条件"
    return {"need": need or None, "parser_source": source, "trace": _append_trace(state, "parse", "done", detail)}


def route_after_parse(state: SourcingState) -> Literal["load", "empty"]:
    return "load" if state.get("need") else "empty"


def load_node(state: SourcingState) -> dict:
    return {"trace": _append_trace(state, "load", "done", f"读取 {len(state['listings'])} 条粮源")}


def filter_node(state: SourcingState) -> dict:
    passed, eliminated = [], []
    for listing in state["listings"]:
        failed = _hard_fail(listing, state["need"] or {})
        if failed:
            code, reason = failed
            eliminated.append({"listing": listing, "reason_code": code, "reason_text": reason})
        else:
            passed.append(listing)
    return {"passed": passed, "eliminated": eliminated, "trace": _append_trace(state, "filter", "done", f"{len(passed)} 条通过硬条件")}


def sort_node(state: SourcingState) -> dict:
    ranked = sorted(state.get("passed", []), key=_sort_key)
    return {"ranked": ranked, "trace": _append_trace(state, "sort", "done", "按信息完整度、年份和综合到厂成本排序")}


def eliminate_node(state: SourcingState) -> dict:
    return {"trace": _append_trace(state, "eliminate", "done", f"已归因 {len(state.get('eliminated', []))} 条未入选粮源")}


def pick_node(state: SourcingState) -> dict:
    ranked = state.get("ranked", [])
    plan = {"need_summary": _need_summary(state["need"] or {}), "primary": _pick(ranked[0]) if ranked else None, "backup": _pick(ranked[1]) if len(ranked) > 1 else None, "eliminated": [], "verifications": []}
    return {"plan": plan, "trace": _append_trace(state, "pick", "done", "已生成主推与备选" if ranked else "无粮源通过硬条件")}


def review_node(state: SourcingState) -> dict:
    plan = dict(state["plan"])
    primary = plan.get("primary")
    if not primary:
        return {"plan": plan, "trace": _append_trace(state, "review", "skipped", "无主推粮源，无需排序复核")}
    review = review_sourcing_ranking(plan.get("need_summary"), primary, plan.get("backup"))
    plan["ranking_review"] = review
    detail = "LLM 已完成排序取舍复核" if review["source"] == "llm" else "已生成规则版排序说明"
    return {"plan": plan, "trace": _append_trace(state, "review", "done", detail)}


def verify_node(state: SourcingState) -> dict:
    plan = dict(state["plan"])
    plan["eliminated"] = [{"listing_code": item["listing"]["listing_code"], "variety_name": item["listing"]["variety_name"], "grade": item["listing"]["grade"], "supplier_name": item["listing"]["supplier_name"], "reason_code": item["reason_code"], "reason_text": item["reason_text"]} for item in state.get("eliminated", [])]
    plan["verifications"] = FIXED_VERIFICATIONS if plan.get("primary") else []
    return {"plan": plan, "trace": _append_trace(state, "verify", "done", "已生成交易前核验清单")}


def empty_node(state: SourcingState) -> dict:
    trace = _append_trace(state, "load", "skipped", "未形成可执行条件")
    for node in ("filter", "sort", "eliminate", "pick", "verify"):
        trace.append({"node": node, "status": "skipped", "detail": "等待补充需求"})
    return {"plan": {"need_summary": None, "primary": None, "backup": None, "eliminated": [], "verifications": []}, "trace": trace}


def _build_graph():
    graph = StateGraph(SourcingState)
    graph.add_node("parse", parse_node)
    graph.add_node("load", load_node)
    graph.add_node("filter", filter_node)
    graph.add_node("sort", sort_node)
    graph.add_node("eliminate", eliminate_node)
    graph.add_node("pick", pick_node)
    graph.add_node("review", review_node)
    graph.add_node("verify", verify_node)
    graph.add_node("empty", empty_node)
    graph.add_edge(START, "parse")
    graph.add_conditional_edges("parse", route_after_parse, {"load": "load", "empty": "empty"})
    graph.add_edge("load", "filter")
    graph.add_edge("filter", "sort")
    graph.add_edge("sort", "eliminate")
    graph.add_edge("eliminate", "pick")
    graph.add_edge("pick", "review")
    graph.add_edge("review", "verify")
    graph.add_edge("verify", END)
    graph.add_edge("empty", END)
    return graph.compile()


SOURCING_GRAPH = _build_graph()


def run_sourcing_graph(raw_text: str, listings: list[dict]) -> dict:
    state = SOURCING_GRAPH.invoke({"raw_text": raw_text, "listings": listings, "trace": []})
    return {"need": state.get("plan", {}).get("need_summary"), "plan": state["plan"], "listing_count": len(listings), "trace": state["trace"], "parser_source": state.get("parser_source", "rule")}
