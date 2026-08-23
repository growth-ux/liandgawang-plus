from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.analysis.routes import router as analysis_router
from app.database import Base, SessionLocal, engine
from app.market import models  # noqa: F401  注册表
from app.market.mock_seed import seed_zhan_mock_data
from app.market.routes import router as market_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    try:
        with SessionLocal() as db:
            seed_zhan_mock_data(db)
    except Exception:
        # 初始化失败不阻止启动（无 MySQL 的测试环境跳过），页面自行提示数据未就绪。
        pass
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
