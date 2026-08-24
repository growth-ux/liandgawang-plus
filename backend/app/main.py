import logging
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# uvicorn 默认为应用日志器不配 Handler，业务 INFO 日志会被丢弃，这里统一开到终端可见
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

from app.analysis.routes import router as analysis_router
from app.database import Base, engine
from app.logistics import models as logistics_models  # noqa: F401  注册表
from app.logistics.routes import router as logistics_router
from app.market import models  # noqa: F401  注册表
from app.market.routes import router as market_router
from app.workflow import models as workflow_models  # noqa: F401  注册表
from app.workflow.routes import router as workflow_router
from app.liang import models as liang_models  # noqa: F401  注册表
from app.liang.routes import router as liang_router
from app.finance import models as finance_models  # noqa: F401
from app.finance.routes import router as finance_router
from app.finance.seed import seed_finance_products
from app.costing import models as costing_models  # noqa: F401
from app.costing.routes import router as costing_router
from app.knowledge import models as knowledge_models  # noqa: F401
from app.knowledge.routes import router as knowledge_router
from app.knowledge.seed import seed_enterprise_knowledge
from app.zhanggui import models as zhanggui_models  # noqa: F401
from app.zhanggui.routes import router as zhanggui_router
from app.handoff import models as handoff_models  # noqa: F401
from app.handoff.routes import router as handoff_router

# 粮掌柜编排链路日志：让终端能看到任务走到了哪一步
_zg_logger = logging.getLogger("zhanggui")
if not _zg_logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s"))
    _zg_logger.addHandler(_handler)
_zg_logger.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from app.database import SessionLocal
    with SessionLocal() as db:
        seed_finance_products(db)
        seed_enterprise_knowledge(db)
    yield


app = FastAPI(title="粮达网 Plus", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market_router)
app.include_router(analysis_router)
app.include_router(workflow_router)
app.include_router(logistics_router)
app.include_router(liang_router)
app.include_router(finance_router)
app.include_router(costing_router)
app.include_router(knowledge_router)
app.include_router(zhanggui_router)
app.include_router(handoff_router)
