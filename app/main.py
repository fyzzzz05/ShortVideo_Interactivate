from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期钩子：
    - yield 前：启动阶段（可初始化 Redis/模型客户端/连接池）
    - yield 后：关闭阶段（可释放资源）
    """
    # 启动
    yield
    # 关闭


def create_app() -> FastAPI:
    """
    应用工厂：集中创建并配置 FastAPI 实例。
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/health", tags=["system"])
    async def health():
        return JSONResponse(
            content={
                "status": "ok",
                "service": settings.APP_NAME,
                "env": settings.APP_ENV,
            }
        )

    return app


app = create_app()
