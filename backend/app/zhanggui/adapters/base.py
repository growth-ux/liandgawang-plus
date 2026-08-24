"""专业小二统一协议与适配器注册表。

粮掌柜只依赖 AgentResult 外层结构；适配器内部调用现有专业规则，
不复制专业业务逻辑。
"""

from dataclasses import dataclass, field
from typing import Callable

from sqlalchemy.orm import Session

from app.zhanggui.schemas import AgentResult, MissionGoal


@dataclass
class AgentContext:
    """单次专业办理的输入：任务、目标与上游小二结果。"""

    mission_id: int
    goal: MissionGoal
    prior_results: dict[str, AgentResult] = field(default_factory=dict)


Adapter = Callable[[Session, AgentContext], AgentResult]


def failed_result(agent_id: str, error: Exception) -> AgentResult:
    """专业失败的结构化降级：不阻塞整体，标记缺失原因。"""
    return AgentResult(
        agent_id=agent_id,
        status="failed",
        summary="该专业结果暂时不可用",
        facts={},
        recommendations=[],
        risks=[],
        missing_information=[str(error)],
        evidence=[],
        impact_on_mission="综合方案将标记该专业结果缺失",
        available_actions=[{"action": "retry", "label": "重试该小二"}],
    )


def run_agent(agent_id: str, db: Session, context: AgentContext, *, supplement: bool = False) -> AgentResult:
    adapter = ADAPTERS.get(agent_id)
    if adapter is None:
        raise ValueError(f"未知小二：{agent_id}")
    try:
        return adapter(db, context)
    except Exception as exc:  # 单个专业失败不拖垮整条链路
        return failed_result(agent_id, exc)


# ADAPTERS 在文件底部填充，避免循环导入
ADAPTERS: dict[str, Adapter] = {}


def _register() -> None:
    from app.zhanggui.adapters import an, liang, qian, suan, yun, zhan

    ADAPTERS.update({
        "zhan": zhan.run,
        "liang": liang.run,
        "yun": yun.run,
        "suan": suan.run,
        "qian": qian.run,
        "an": an.run,
    })


_register()
