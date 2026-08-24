import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

import sys as _sys
import time as _time

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
from app.zhanggui import models as zhanggui_models  # noqa: F401
from app.zhanggui.routes import router as zhanggui_router

# 粮掌柜编排链路日志：确保 logger 级别为 INFO
logging.getLogger("zhanggui").setLevel(logging.INFO)


def _log_access(method: str, path: str, status: int, ms: float):
    """直接写 stderr + flush，确保 --reload 子进程也能即时输出。"""
    ts = _time.strftime("%H:%M:%S")
    print(f"[{ts}] {method} {path} → {status} ({ms:.1f}ms)", file=_sys.stderr, flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from app.database import SessionLocal
    with SessionLocal() as db:
        seed_finance_products(db)
    yield


app = FastAPI(title="粮达网 Plus", lifespan=lifespan)


@app.middleware("http")
async def log_all_requests(request: Request, call_next):
    """中间件：记录所有 API 请求日志"""
    start = _time.time()
    response: Response = await call_next(request)
    duration = (_time.time() - start) * 1000
    path = request.url.path
    # 跳过 Swagger 文档等噪音
    if path in ("/docs", "/openapi.json", "/redoc", "/favicon.ico"):
        return response
    _log_access(request.method, path, response.status_code, duration)
    return response


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
