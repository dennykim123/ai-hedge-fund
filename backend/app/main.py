from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.fund import router as fund_router
from app.api.pm import router as pm_router
from app.api.admin.dashboard import router as admin_dashboard_router
from app.api.admin.strategic import router as admin_strategic_router
from app.api.admin.portfolio import router as admin_portfolio_router
from app.api.admin.risk import router as admin_risk_router
from app.api.admin.analytics import router as admin_analytics_router
from app.api.admin.system import router as admin_system_router
from app.api.trading import router as trading_router
from app.api.crypto import router as crypto_router
from app.config import settings
from app.db.base import Base, engine, get_db
from app.core.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Lightweight migration: add missing columns to existing tables
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        columns = [c["name"] for c in inspect(engine).get_columns("trades")]
        if "fee" not in columns:
            conn.execute(text("ALTER TABLE trades ADD COLUMN fee FLOAT DEFAULT 0.0"))
            conn.commit()
    db = next(get_db())
    from app.db.seed import seed_pms
    from app.engines.trading_cycle import seed_nav_history

    seed_pms(db)
    seed_nav_history(db)
    db.close()
    start_scheduler(interval_seconds=300)  # 5분마다 주식 PM 자동 거래
    # 크립토 PM 전용 스케줄러 자동 시작
    import asyncio
    import app.api.crypto as crypto_mod
    loop = asyncio.get_event_loop()
    crypto_mod._crypto_scheduler_task = loop.create_task(
        crypto_mod._crypto_trading_loop(300)
    )
    crypto_mod._crypto_scheduler_interval = 300
    yield
    stop_scheduler()
    if crypto_mod._crypto_scheduler_task and not crypto_mod._crypto_scheduler_task.done():
        crypto_mod._crypto_scheduler_task.cancel()


app = FastAPI(title="AI Hedge Fund", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(fund_router)
app.include_router(pm_router)
app.include_router(admin_dashboard_router)
app.include_router(admin_strategic_router)
app.include_router(admin_portfolio_router)
app.include_router(admin_risk_router)
app.include_router(admin_analytics_router)
app.include_router(admin_system_router)
app.include_router(trading_router)
app.include_router(crypto_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.2.0"}
