"""确定性市场判断与价格解读：纯 Python，不访问数据库、不调用模型。"""

from decimal import Decimal


def fmt_chg(v: float) -> str:
    """涨跌百分比文案：保留 1 位小数，归一化 -0.0 避免显示负零。"""
    return f"{round(v, 1) + 0.0:+.1f}%"


def interpret_spot(region_type: str, change_pct: float) -> str:
    """单监测点一句话解读，用在价格表 AI 解读列。"""
    chg = float(change_pct)
    abs_chg = abs(chg)

    if region_type == "产区":
        if chg > 1:
            return "需求拉动，产区偏强"
        if chg > 0.3:
            return "收购偏紧，价格稳中有升"
        if chg > -0.3:
            return "供需平稳，窄幅震荡"
        if chg > -1:
            return "供应偏松，价格小幅回落"
        return "供应宽松，产区承压"

    if region_type == "港口":
        if chg > 1:
            return "到港偏少，平仓价走高"
        if chg > 0.3:
            return "集港偏紧，价格获支撑"
        if chg > -0.3:
            return "到货平稳，价格持稳"
        if chg > -1:
            return "到港增加，价格小幅回调"
        return "到货集中，平仓价承压"

    # 销区
    if chg > 1:
        return "到货偏紧，销区跟涨"
    if chg > 0.3:
        return "到货量偏低，价格小幅上行"
    if chg > -0.3:
        return "供需均衡，价格稳定"
    if chg > -1:
        return "到货恢复，价格小幅回落"
    return "供应充裕，销区价格走弱"


def compute_judgment(
    spots: list,
    variety_name: str,
    events: list,
) -> dict:
    """根据监测点现货和事件生成市场速览判断（无采购任务时使用）。

    返回结构：
    {
        "summary": str,
        "direction": "bullish" | "bearish" | "neutral",
        "supporting": [{"text", "type"}],
        "opposing":   [{"text", "type"}],
        "evidence_completeness": "high" | "medium" | "low",
        "watch_suggestions": [str],
    }
    """
    if not spots:
        return {
            "summary": f"{variety_name}暂无行情数据",
            "direction": "neutral",
            "supporting": [],
            "opposing": [],
            "evidence_completeness": "low",
            "watch_suggestions": [],
        }

    # ── 价格信号分析 ──
    # 涨跌口径与前端概览条一致：>0 为涨、<0 为跌，避免证据与统计数字对不上
    up_spots = [s for s in spots if float(s.change_pct) > 0]
    down_spots = [s for s in spots if float(s.change_pct) < 0]
    producing = [s for s in spots if s.region_type == "产区"]
    ports = [s for s in spots if s.region_type == "港口"]

    total = len(spots)
    up_count = len(up_spots)
    down_count = len(down_spots)

    producing_avg_chg = (
        sum(float(s.change_pct) for s in producing) / len(producing) if producing else 0
    )
    port_avg_chg = (
        sum(float(s.change_pct) for s in ports) / len(ports) if ports else 0
    )

    # 事件多空
    bullish_events = [e for e in events if e.direction == "bullish"]
    bearish_events = [e for e in events if e.direction == "bearish"]

    # ── 方向判定 ──
    bullish_signals = 0
    bearish_signals = 0

    if up_count > total * 0.5:
        bullish_signals += 2
    elif up_count > total * 0.3:
        bullish_signals += 1
    if down_count > total * 0.5:
        bearish_signals += 2
    elif down_count > total * 0.3:
        bearish_signals += 1

    if producing_avg_chg > 0.3:
        bullish_signals += 1
    elif producing_avg_chg < -0.3:
        bearish_signals += 1
    if port_avg_chg > 0.3:
        bullish_signals += 1
    elif port_avg_chg < -0.3:
        bearish_signals += 1

    bullish_signals += len(bullish_events)
    bearish_signals += len(bearish_events)

    if bullish_signals > bearish_signals + 1:
        direction = "bullish"
    elif bearish_signals > bullish_signals + 1:
        direction = "bearish"
    else:
        direction = "neutral"

    # ── 生成证据 ──
    supporting: list[dict] = []
    opposing: list[dict] = []

    if direction == "bullish":
        if producing and producing_avg_chg > 0:
            supporting.append({
                "text": f"产区平均涨跌 {fmt_chg(producing_avg_chg)}，整体偏强",
                "type": "price",
            })
        if up_count > total * 0.4:
            supporting.append({
                "text": f"{up_count}/{total} 个监测点价格上涨",
                "type": "price",
            })
        if port_avg_chg > 0:
            supporting.append({
                "text": f"港口均价涨跌 {fmt_chg(port_avg_chg)}，平仓价获支撑",
                "type": "price",
            })
        for e in bullish_events:
            supporting.append({"text": e.title, "type": "event"})
        for e in bearish_events:
            opposing.append({"text": e.title, "type": "event"})
        if down_count > 0:
            opposing.append({
                "text": f"仍有 {down_count} 个监测点价格回落",
                "type": "price",
            })
    elif direction == "bearish":
        if producing and producing_avg_chg < 0:
            supporting.append({
                "text": f"产区平均涨跌 {fmt_chg(producing_avg_chg)}，整体偏弱",
                "type": "price",
            })
        if down_count > total * 0.4:
            supporting.append({
                "text": f"{down_count}/{total} 个监测点价格下跌",
                "type": "price",
            })
        for e in bearish_events:
            supporting.append({"text": e.title, "type": "event"})
        for e in bullish_events:
            opposing.append({"text": e.title, "type": "event"})
        if up_count > 0:
            opposing.append({
                "text": f"仍有 {up_count} 个监测点价格上涨",
                "type": "price",
            })
    else:
        if producing:
            supporting.append({
                "text": f"产区均价涨跌 {fmt_chg(producing_avg_chg)}，波动有限",
                "type": "price",
            })
        supporting.append({
            "text": f"上涨 {up_count} 个、下跌 {down_count} 个，多空交织",
            "type": "price",
        })
        for e in bullish_events:
            supporting.append({"text": e.title, "type": "event"})
        for e in bearish_events:
            opposing.append({"text": e.title, "type": "event"})

    # ── 一句话总结 ──
    if direction == "bullish":
        if opposing:
            summary = f"{variety_name}市场阶段性偏强，但上行空间可能有限"
        else:
            summary = f"{variety_name}市场整体偏强，价格重心持续上移"
    elif direction == "bearish":
        if opposing:
            summary = f"{variety_name}市场偏弱运行，短期反弹动力不足"
        else:
            summary = f"{variety_name}市场承压下行，供应宽松格局未改"
    else:
        summary = f"{variety_name}市场多空交织，短期维持震荡格局"

    # ── 证据完整度 ──
    evidence_score = len(spots) + len(events) * 3
    if evidence_score >= 30:
        completeness = "high"
    elif evidence_score >= 15:
        completeness = "medium"
    else:
        completeness = "low"

    # ── 关注建议 ──
    watch: list[str] = []
    if direction == "bullish":
        watch.append("关注产区到货量是否持续偏低")
        watch.append("关注进口替代及政策调控动向")
    elif direction == "bearish":
        watch.append("关注下游需求是否回暖")
        watch.append("关注产区收储政策变化")
    else:
        watch.append("关注产区天气与物流对供应的影响")
        watch.append("关注下游开工率和库存变化")
    if port_avg_chg != 0 and producing_avg_chg != 0:
        spread = abs(port_avg_chg - producing_avg_chg)
        if spread > 0.5:
            watch.append("关注产销区价差收窄或扩大趋势")

    return {
        "summary": summary,
        "direction": direction,
        "supporting": supporting,
        "opposing": opposing,
        "evidence_completeness": completeness,
        "watch_suggestions": watch,
    }
