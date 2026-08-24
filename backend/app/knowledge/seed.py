"""企业初始化资料：少量、可信、可直接被各小二复用。"""

from sqlalchemy.orm import Session

from app.knowledge import repository
from app.knowledge.schemas import KnowledgeDraft

SEED_ITEMS = [
    KnowledgeDraft(
        knowledge_type="fact",
        title="潍坊工厂为主要到货点",
        content="企业当前粮食采购以潍坊工厂到货为主要交付口径，方案比较应优先给出到厂成本。",
        applicable_context=["粮食采购", "潍坊到厂", "方案比较"],
        tags=["潍坊", "到厂成本"],
    ),
    KnowledgeDraft(
        knowledge_type="fact",
        title="二等玉米执行企业到厂验收口径",
        content="二等玉米到厂时需核对等级、水分、容重和霉变粒，质量折价应纳入综合成本。",
        applicable_context=["二等玉米", "到厂验收", "成本测算"],
        tags=["玉米", "质量", "折价"],
    ),
    KnowledgeDraft(
        knowledge_type="preference",
        title="安全库存按七天管理",
        content="可用库存低于七天时进入保供场景，采购与运输方案优先保证按期稳定到货。",
        applicable_context=["库存低于七天", "紧急补库", "保供"],
        tags=["库存", "保供", "稳定到货"],
    ),
    KnowledgeDraft(
        knowledge_type="preference",
        title="正常库存优先比较综合到厂成本",
        content="库存充足且交期可满足时，优先比较采购、物流、损耗、资金和质量折价后的综合到厂成本。",
        applicable_context=["正常补库", "成本测算", "方案选择"],
        tags=["综合成本", "正常库存"],
    ),
    KnowledgeDraft(
        knowledge_type="fact",
        title="大批量玉米允许拆分到货",
        content="单批超过承运能力时可比较分批到货方案，但必须保留各批次发运和到货时间。",
        applicable_context=["大批量玉米", "分批运输", "运力不足"],
        tags=["玉米", "物流", "分批"],
    ),
    KnowledgeDraft(
        knowledge_type="preference",
        title="未确认报价不得作为最终成本",
        content="参考运价和供应方口头报价只用于方案初筛，生成执行建议前需标记有效期和待确认项。",
        applicable_context=["采购报价", "物流询运", "成本测算"],
        tags=["报价", "待确认", "成本"],
    ),
]


def seed_enterprise_knowledge(db: Session) -> None:
    for index, draft in enumerate(SEED_ITEMS, start=1):
        repository.create_or_reinforce_item(
            db,
            draft=draft,
            source_type="enterprise_seed",
            source_record_id=index,
            source_agent="user",
            source_title="企业初始化资料",
            origin="manual",
        )

