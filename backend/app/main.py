from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from app.database import SessionLocal
    with SessionLocal() as db:
        seed_finance_products(db)
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
