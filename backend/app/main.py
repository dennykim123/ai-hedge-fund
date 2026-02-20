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
from app.db.base import Base, engine, get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    from app.db.seed import seed_pms

    seed_pms(db)
    yield


app = FastAPI(title="AI Hedge Fund", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


@app.get("/health")
async def health():
    return {"status": "ok"}
