"""一次性写入全部演示种子数据。

用法（项目根目录）:
    cd backend && uv run python -m seed_db

首次部署或需要重置演示数据时运行；重复执行幂等、不会重复插入。
"""

from app.database import Base, SessionLocal, engine

# 确保所有 model 已注册到 metadata
from app.logistics import models as _logistics  # noqa: F401
from app.knowledge import models as _knowledge  # noqa: F401
from app.market import models as _market  # noqa: F401
from app.workflow import models as _workflow  # noqa: F401
from app.liang import models as _liang  # noqa: F401

from app.market.mock_seed import seed_zhan_mock_data
from app.liang.mock_seed import seed_liang_mock_data
from app.workflow.seed import seed_demo_watches
from app.logistics.seed import seed_logistics_mock_data
from app.knowledge.seed import seed_enterprise_knowledge


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        print("⏳ 写入行情数据 (zhan) ...")
        seed_zhan_mock_data(db)
        print("⏳ 写入粮源数据 (liang) ...")
        seed_liang_mock_data(db)
        print("⏳ 写入关注数据 (workflow) ...")
        seed_demo_watches(db)
        print("⏳ 写入物流数据 (logistics) ...")
        seed_logistics_mock_data(db)
        print("⏳ 写入企业知识数据 (knowledge) ...")
        seed_enterprise_knowledge(db)
    print("✅ 全部种子数据写入完成")


if __name__ == "__main__":
    main()
