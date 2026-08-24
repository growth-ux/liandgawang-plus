"""粮小二寻源任务的 LangGraph 状态机。"""

import logging
import re
import time
from datetime import date, timedelta
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from app.liang.llm import decide_sourcing_picks, extract_sourcing_need

logger = logging.getLogger("liang.sourcing")


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
    decision: dict | None
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
    if need.get("budget_price") is not None:
        delivered = float(listing["price"]) + FREIGHT_ADJUSTMENT.get(listing["price_type"], 0) + _quality_penalty(listing)
        if delivered > need["budget_price"]:
            return "PRICE_OVER_BUDGET", f"综合到厂价 {delivered:.0f} 元/吨，超过预算 {need['budget_price']} 元/吨"
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


def _delivered_price(listing: dict) -> str:
    return f"{float(listing['price']) + FREIGHT_ADJUSTMENT.get(listing['price_type'], 0) + _quality_penalty(listing):.2f}"


# 交给 LLM 比选的最大候选数与字段投影（只给决策需要的信息）
DECIDE_POOL_SIZE = 4
DECIDE_FIELDS = ("listing_code", "variety_name", "grade", "crop_year", "origin_province", "supplier_name", "price", "price_type", "available_quantity_tons", "latest_ship_at", "moisture_pct", "test_weight_g_l", "impurity_pct")


def _candidate_view(listing: dict) -> dict:
    view = {key: listing.get(key) for key in DECIDE_FIELDS}
    view["delivered_price"] = _delivered_price(listing)
    return view


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
        "reasons": reasons, "risks": risks, "delivered_price": _delivered_price(listing),
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
    raw_text = state["raw_text"]
    logger.info("[parse] 开始解析寻源需求: %s", raw_text)
    rule_need = _parse_need(raw_text)
    logger.info("[parse] 规则预解析结果: %s，即将调用 LLM 解析", rule_need)
    started = time.perf_counter()
    need, source = extract_sourcing_need(raw_text, rule_need)
    logger.info("[parse] 需求解析完成: source=%s need=%s 耗时%.1fs", source, need, time.perf_counter() - started)
    detail = "LLM 已提取采购需求字段" if source == "llm" and need else "已通过规则提取采购需求字段" if need else "未提取到可执行条件"
    return {"need": need or None, "parser_source": source, "trace": _append_trace(state, "parse", "done", detail)}


def route_after_parse(state: SourcingState) -> Literal["load", "empty"]:
    logger.info("[route] 解析后路由: %s", "load" if state.get("need") else "empty")
    return "load" if state.get("need") else "empty"


def load_node(state: SourcingState) -> dict:
    logger.info("[load] 读取粮源 %s 条", len(state["listings"]))
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
    logger.info("[filter] 硬条件过滤完成: 通过 %s 条，淘汰 %s 条", len(passed), len(eliminated))
    return {"passed": passed, "eliminated": eliminated, "trace": _append_trace(state, "filter", "done", f"{len(passed)} 条通过硬条件")}


def sort_node(state: SourcingState) -> dict:
    ranked = sorted(state.get("passed", []), key=_sort_key)
    logger.info("[sort] 排序完成: %s 条，前二: %s", len(ranked), [item["listing_code"] for item in ranked[:2]])
    return {"ranked": ranked, "trace": _append_trace(state, "sort", "done", "按信息完整度、年份和综合到厂成本排序")}


def eliminate_node(state: SourcingState) -> dict:
    logger.info("[eliminate] 淘汰归因完成: %s 条", len(state.get("eliminated", [])))
    return {"trace": _append_trace(state, "eliminate", "done", f"已归因 {len(state.get('eliminated', []))} 条未入选粮源")}


def pick_node(state: SourcingState) -> dict:
    ranked = state.get("ranked", [])
    decision = state.get("decision") or {}
    by_code = {item["listing_code"]: item for item in ranked}
    primary_listing = by_code.get(decision.get("primary_code"), ranked[0] if ranked else None)
    backup_listing = by_code.get(decision.get("backup_code")) if decision.get("backup_code") else None
    if backup_listing is primary_listing:
        backup_listing = None
    plan = {"need_summary": _need_summary(state["need"] or {}), "primary": _pick(primary_listing) if primary_listing else None, "backup": _pick(backup_listing) if backup_listing else None, "eliminated": [], "verifications": []}
    if decision:
        plan["ranking_review"] = {key: decision.get(key) for key in ("summary", "decision_basis", "procurement_advice", "source")}
    detail = ("已按 AI 决策" if decision.get("source") == "llm" else "已按规则排序") + ("生成主推与备选" if ranked else "，无粮源通过硬条件")
    logger.info("[pick] 主推 %s，备选 %s（依据 %s）", (plan["primary"] or {}).get("listing_code"), (plan["backup"] or {}).get("listing_code") or "无", decision.get("source") or "无决策")
    return {"plan": plan, "trace": _append_trace(state, "pick", "done", detail)}


def review_node(state: SourcingState) -> dict:
    ranked = state.get("ranked", [])
    if not ranked:
        logger.info("[review] 无候选粮源，跳过 AI 比选")
        return {"decision": None, "trace": _append_trace(state, "review", "skipped", "无候选粮源，无需 AI 比选")}
    candidates = [_candidate_view(item) for item in ranked[:DECIDE_POOL_SIZE]]
    logger.info("[review] 即将调用 LLM 比选决策: 候选 %s", [item["listing_code"] for item in candidates])
    started = time.perf_counter()
    decision = decide_sourcing_picks(_need_summary(state["need"] or {}), candidates)
    logger.info("[review] AI 比选完成: source=%s 主推=%s 备选=%s 耗时%.1fs", decision.get("source"), decision.get("primary_code"), decision.get("backup_code") or "无", time.perf_counter() - started)
    detail = f"AI 已选定主推 {decision['primary_code']}" if decision.get("source") == "llm" else f"规则选定主推 {decision['primary_code']}（模型不可用）"
    return {"decision": decision, "trace": _append_trace(state, "review", "done", detail)}


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
    graph.add_edge("eliminate", "review")
    graph.add_edge("review", "pick")
    graph.add_edge("pick", "verify")
    graph.add_edge("verify", END)
    graph.add_edge("empty", END)
    return graph.compile()


SOURCING_GRAPH = _build_graph()


def run_sourcing_graph(raw_text: str, listings: list[dict]) -> dict:
    logger.info("[sourcing] 寻源流程开始: 需求=%s 粮源=%s条", raw_text, len(listings))
    started = time.perf_counter()
    state = SOURCING_GRAPH.invoke({"raw_text": raw_text, "listings": listings, "trace": []})
    logger.info("[sourcing] 寻源流程结束: 总耗时%.1fs", time.perf_counter() - started)
    return {"need": state.get("plan", {}).get("need_summary"), "plan": state["plan"], "listing_count": len(listings), "trace": state["trace"], "parser_source": state.get("parser_source", "rule")}


def run_sourcing_graph_stream(raw_text: str, listings: list[dict]):
    """流式执行寻源流程：每完成一个节点即推送其轨迹事件，最后推送完整结果。"""
    logger.info("[sourcing] 寻源流程开始(流式): 需求=%s 粮源=%s条", raw_text, len(listings))
    started = time.perf_counter()
    seen = 0
    final_state: dict = {}
    for update in SOURCING_GRAPH.stream({"raw_text": raw_text, "listings": listings, "trace": []}, stream_mode="updates"):
        for node_output in update.values():
            trace = node_output.get("trace") or []
            for event in trace[seen:]:
                yield {"type": "trace", "event": event}
            seen = len(trace)
            final_state.update(node_output)
    logger.info("[sourcing] 寻源流程结束(流式): 总耗时%.1fs", time.perf_counter() - started)
    yield {"type": "done", "result": {
        "need": final_state.get("plan", {}).get("need_summary"),
        "plan": final_state.get("plan"),
        "listing_count": len(listings),
        "trace": final_state.get("trace", []),
        "parser_source": final_state.get("parser_source", "rule"),
    }}
