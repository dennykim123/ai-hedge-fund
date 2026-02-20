# AI Hedge Fund Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** threadsaver.org 클론 + 업그레이드 — 백테스트로 검증된 퀀트+LLM 하이브리드 AI 헤지펀드 시스템

**Architecture:** FastAPI(Python) 백엔드 + Next.js 프론트엔드 + PostgreSQL DB. 퀀트 시그널 엔진이 후보를 선별하고 LLM이 최종 판단. 기능 단위 수직 완성(풀스택 동시 개발).

**Tech Stack:** FastAPI, PostgreSQL, SQLAlchemy, Alembic, Next.js 15, TypeScript, TailwindCSS, pandas, numpy, anthropic SDK, praw, pytrends, newsapi-python

---

## Phase 1 — 기반 인프라 + 홈페이지

### Task 1: 프로젝트 구조 초기화

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/.env.example`
- Create: `frontend/` (Next.js)

**Step 1: 백엔드 디렉토리 구조 생성**

```bash
mkdir -p backend/app/{api,core,db,models,schemas,services,engines}
mkdir -p backend/tests/{unit,integration}
touch backend/app/__init__.py
touch backend/app/api/__init__.py
touch backend/app/core/__init__.py
touch backend/app/db/__init__.py
touch backend/app/models/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/services/__init__.py
touch backend/app/engines/__init__.py
```

**Step 2: pyproject.toml 작성**

```toml
[project]
name = "ai-hedge-fund"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "sqlalchemy>=2.0.0",
    "alembic>=1.14.0",
    "psycopg2-binary>=2.9.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.7.0",
    "anthropic>=0.40.0",
    "openai>=1.58.0",
    "pandas>=2.2.0",
    "numpy>=2.2.0",
    "httpx>=0.28.0",
    "python-dotenv>=1.0.0",
    "websockets>=14.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=6.0.0",
    "httpx>=0.28.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**Step 3: .env.example 작성**

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hedge_fund

# AI Providers
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
GROK_API_KEY=
DEEPSEEK_API_KEY=

# Market Data
POLYGON_API_KEY=
ALPHA_VANTAGE_API_KEY=

# Social Data
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
NEWS_API_KEY=

# Broker (Phase 5)
ALPACA_API_KEY=
ALPACA_SECRET_KEY=
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# App
ENVIRONMENT=development
INITIAL_FUND_NAV=1000000
```

**Step 4: config.py 작성**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    polygon_api_key: str = ""
    news_api_key: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    environment: str = "development"
    initial_fund_nav: float = 1_000_000.0

    class Config:
        env_file = ".env"

settings = Settings()
```

**Step 5: main.py 작성**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI Hedge Fund", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 6: 테스트 작성**

```python
# tests/test_main.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

**Step 7: 테스트 실행 확인**

```bash
cd backend && pip install -e ".[dev]" && pytest tests/test_main.py -v
```
Expected: PASS

**Step 8: 커밋**

```bash
git add backend/
git commit -m "feat: FastAPI 백엔드 초기 구조 설정"
```

---

### Task 2: PostgreSQL DB 스키마 + Alembic

**Files:**
- Create: `backend/app/db/base.py`
- Create: `backend/app/models/pm.py`
- Create: `backend/app/models/position.py`
- Create: `backend/app/models/trade.py`
- Create: `backend/app/models/nav_history.py`
- Create: `backend/app/models/signal.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`

**Step 1: 실패하는 테스트 먼저 작성**

```python
# tests/unit/test_models.py
from app.models.pm import PM
from app.models.position import Position
from app.models.trade import Trade

def test_pm_model_fields():
    pm = PM(
        id="atlas",
        name="Atlas",
        emoji="🌍",
        strategy="Macro Regime",
        llm_provider="claude",
        is_active=True,
        initial_capital=100_000.0,
    )
    assert pm.id == "atlas"
    assert pm.initial_capital == 100_000.0

def test_position_model_fields():
    pos = Position(
        pm_id="atlas",
        symbol="AAPL",
        quantity=10,
        avg_cost=150.0,
        asset_type="stock",
    )
    assert pos.symbol == "AAPL"
    assert pos.quantity == 10
```

**Step 2: 테스트 실행 — FAIL 확인**

```bash
pytest tests/unit/test_models.py -v
```
Expected: FAIL (ImportError)

**Step 3: DB base 설정**

```python
# app/db/base.py
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Step 4: PM 모델 작성**

```python
# app/models/pm.py
from sqlalchemy import String, Float, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class PM(Base):
    __tablename__ = "pms"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    emoji: Mapped[str] = mapped_column(String(10))
    strategy: Mapped[str] = mapped_column(String(100))
    llm_provider: Mapped[str] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    initial_capital: Mapped[float] = mapped_column(Float, default=100_000.0)
    current_capital: Mapped[float] = mapped_column(Float, default=100_000.0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
```

**Step 5: Position 모델 작성**

```python
# app/models/position.py
from sqlalchemy import String, Float, Integer, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pm_id: Mapped[str] = mapped_column(String(50), ForeignKey("pms.id"))
    symbol: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[float] = mapped_column(Float)
    avg_cost: Mapped[float] = mapped_column(Float)
    asset_type: Mapped[str] = mapped_column(String(20), default="stock")  # stock/crypto/option
    opened_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
```

**Step 6: Trade 모델 작성**

```python
# app/models/trade.py
from sqlalchemy import String, Float, Integer, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pm_id: Mapped[str] = mapped_column(String(50), ForeignKey("pms.id"))
    symbol: Mapped[str] = mapped_column(String(20))
    action: Mapped[str] = mapped_column(String(10))  # BUY / SELL
    quantity: Mapped[float] = mapped_column(Float)
    price: Mapped[float] = mapped_column(Float)
    asset_type: Mapped[str] = mapped_column(String(20), default="stock")
    conviction_score: Mapped[float] = mapped_column(Float, default=0.0)
    reasoning: Mapped[str] = mapped_column(String(2000), default="")
    executed_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
```

**Step 7: NAV History 모델 작성**

```python
# app/models/nav_history.py
from sqlalchemy import Float, DateTime, func, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class NAVHistory(Base):
    __tablename__ = "nav_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nav: Mapped[float] = mapped_column(Float)
    daily_return: Mapped[float] = mapped_column(Float, default=0.0)
    recorded_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
```

**Step 8: Signal 모델 작성**

```python
# app/models/signal.py
from sqlalchemy import String, Float, DateTime, func, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pm_id: Mapped[str] = mapped_column(String(50))
    symbol: Mapped[str] = mapped_column(String(20))
    signal_type: Mapped[str] = mapped_column(String(50))  # rsi/momentum/social/llm
    value: Mapped[float] = mapped_column(Float)
    metadata_: Mapped[dict] = mapped_column(JSON, default={}, name="metadata")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
```

**Step 9: 테스트 재실행 — PASS 확인**

```bash
pytest tests/unit/test_models.py -v
```
Expected: PASS

**Step 10: Alembic 초기화 + 마이그레이션**

```bash
cd backend
alembic init alembic
# alembic/env.py에서 target_metadata = Base.metadata 설정
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

**Step 11: 커밋**

```bash
git add backend/app/models/ backend/app/db/ backend/alembic/ backend/alembic.ini
git commit -m "feat: DB 스키마 정의 (PM, Position, Trade, NAV, Signal)"
```

---

### Task 3: PM 시드 데이터 + Fund API

**Files:**
- Create: `backend/app/db/seed.py`
- Create: `backend/app/api/fund.py`
- Create: `backend/app/schemas/fund.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/integration/test_fund_api.py`

**Step 1: 실패하는 테스트 작성**

```python
# tests/integration/test_fund_api.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_fund_stats():
    response = client.get("/api/fund/stats")
    assert response.status_code == 200
    data = response.json()
    assert "nav" in data
    assert "active_pms" in data
    assert "total_positions" in data
    assert "today_return" in data
    assert "itd_return" in data

def test_get_pms_list():
    response = client.get("/api/fund/pms")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 11  # 11개 PM
    assert data[0]["id"] == "atlas"
```

**Step 2: 테스트 실행 — FAIL 확인**

```bash
pytest tests/integration/test_fund_api.py -v
```

**Step 3: 시드 데이터 작성**

```python
# app/db/seed.py
PM_SEEDS = [
    {"id": "atlas",       "name": "Atlas",       "emoji": "🌍", "strategy": "Macro Regime",       "llm_provider": "claude"},
    {"id": "council",     "name": "The Council", "emoji": "🏛️", "strategy": "Multi-Persona",      "llm_provider": "openai"},
    {"id": "drflow",      "name": "Dr. Flow",    "emoji": "🔬", "strategy": "Event-Driven",        "llm_provider": "gemini"},
    {"id": "insider",     "name": "Insider",     "emoji": "🕵️", "strategy": "Smart Money",        "llm_provider": "grok"},
    {"id": "maxpayne",    "name": "Max Payne",   "emoji": "💀", "strategy": "Contrarian",          "llm_provider": "deepseek"},
    {"id": "satoshi",     "name": "Satoshi",     "emoji": "₿",  "strategy": "Crypto Specialist",  "llm_provider": "claude"},
    {"id": "quantking",   "name": "Quant King",  "emoji": "📊", "strategy": "Pure Quant",          "llm_provider": "rule_based"},
    {"id": "asiatiger",   "name": "Asia Tiger",  "emoji": "🌏", "strategy": "Asia Markets",        "llm_provider": "gemini"},
    {"id": "momentum",    "name": "Momentum",    "emoji": "⚡", "strategy": "Trend Following",     "llm_provider": "openai"},
    {"id": "sentinel",    "name": "Sentinel",    "emoji": "🛡️", "strategy": "Risk Hedge",         "llm_provider": "claude"},
    {"id": "voxpopuli",   "name": "Vox Populi",  "emoji": "📱", "strategy": "Social Tipping Point","llm_provider": "claude"},
]

def seed_pms(db):
    from app.models.pm import PM
    for seed in PM_SEEDS:
        existing = db.query(PM).filter(PM.id == seed["id"]).first()
        if not existing:
            db.add(PM(**seed, initial_capital=100_000.0, current_capital=100_000.0))
    db.commit()
```

**Step 4: Fund 스키마 작성**

```python
# app/schemas/fund.py
from pydantic import BaseModel

class FundStats(BaseModel):
    nav: float
    today_return: float
    prior_day_return: float
    itd_return: float
    active_pms: int
    total_positions: int

class PMSummary(BaseModel):
    id: str
    name: str
    emoji: str
    strategy: str
    llm_provider: str
    current_capital: float
    itd_return: float

    class Config:
        from_attributes = True
```

**Step 5: Fund API 작성**

```python
# app/api/fund.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.models.pm import PM
from app.models.position import Position
from app.models.nav_history import NAVHistory
from app.schemas.fund import FundStats, PMSummary
from app.config import settings

router = APIRouter(prefix="/api/fund", tags=["fund"])

@router.get("/stats", response_model=FundStats)
async def get_fund_stats(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).all()
    total_capital = sum(pm.current_capital for pm in pms)
    initial_total = len(pms) * 100_000.0
    itd_return = ((total_capital - initial_total) / initial_total * 100) if initial_total > 0 else 0.0
    total_positions = db.query(Position).count()
    return FundStats(
        nav=total_capital,
        today_return=0.0,
        prior_day_return=0.0,
        itd_return=round(itd_return, 2),
        active_pms=len(pms),
        total_positions=total_positions,
    )

@router.get("/pms", response_model=list[PMSummary])
async def get_pms(db: Session = Depends(get_db)):
    pms = db.query(PM).filter(PM.is_active == True).order_by(PM.id).all()
    result = []
    for pm in pms:
        itd = ((pm.current_capital - 100_000.0) / 100_000.0 * 100)
        result.append(PMSummary(
            id=pm.id,
            name=pm.name,
            emoji=pm.emoji,
            strategy=pm.strategy,
            llm_provider=pm.llm_provider,
            current_capital=pm.current_capital,
            itd_return=round(itd, 2),
        ))
    return result
```

**Step 6: main.py에 라우터 등록 + 시드 실행**

```python
# app/main.py (수정)
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.fund import router as fund_router
from app.db.base import get_db, engine
from app.db.base import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    from app.db.seed import seed_pms
    seed_pms(db)
    yield

app = FastAPI(title="AI Hedge Fund", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(fund_router)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 7: 테스트 재실행 — PASS 확인**

```bash
pytest tests/integration/test_fund_api.py -v
```
Expected: PASS

**Step 8: 서버 실행 확인**

```bash
uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/api/fund/stats
```
Expected: JSON with nav, active_pms=11

**Step 9: 커밋**

```bash
git add backend/app/api/ backend/app/schemas/ backend/app/db/seed.py
git commit -m "feat: Fund stats + PM 목록 API, 11개 PM 시드 데이터"
```

---

### Task 4: Next.js 프론트엔드 초기화 + 홈페이지

**Files:**
- Create: `frontend/` (Next.js 15 + TypeScript + Tailwind)
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/components/FundStats.tsx`
- Create: `frontend/src/lib/api.ts`

**Step 1: Next.js 프로젝트 생성**

```bash
cd /Users/m4/Desktop/claude_test
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --no-eslint \
  --import-alias "@/*"
```

**Step 2: API 클라이언트 작성**

```typescript
// frontend/src/lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface FundStats {
  nav: number;
  today_return: number;
  prior_day_return: number;
  itd_return: number;
  active_pms: number;
  total_positions: number;
}

export interface PMSummary {
  id: string;
  name: string;
  emoji: string;
  strategy: string;
  llm_provider: string;
  current_capital: number;
  itd_return: number;
}

export async function getFundStats(): Promise<FundStats> {
  const res = await fetch(`${BASE_URL}/api/fund/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch fund stats");
  return res.json();
}

export async function getPMs(): Promise<PMSummary[]> {
  const res = await fetch(`${BASE_URL}/api/fund/pms`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch PMs");
  return res.json();
}
```

**Step 3: FundStats 컴포넌트 작성**

```typescript
// frontend/src/components/FundStats.tsx
import { FundStats } from "@/lib/api";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatReturn(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function returnColor(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-gray-400";
}

export function FundStatsGrid({ stats }: { stats: FundStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-gray-800 border border-gray-800 rounded-xl overflow-hidden">
      {[
        { label: "FUND NAV", value: formatCurrency(stats.nav), color: "text-cyan-400" },
        { label: "TODAY", value: formatReturn(stats.today_return), color: returnColor(stats.today_return) },
        { label: "PRIOR DAY", value: formatReturn(stats.prior_day_return), color: returnColor(stats.prior_day_return) },
        { label: "ITD RETURN", value: formatReturn(stats.itd_return), color: returnColor(stats.itd_return) },
        { label: "ACTIVE PMs", value: stats.active_pms.toString(), color: "text-blue-400" },
        { label: "POSITIONS", value: stats.total_positions.toString(), color: "text-yellow-400" },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-gray-900 p-6 flex flex-col items-center justify-center">
          <span className={`text-3xl font-mono font-bold ${color}`}>{value}</span>
          <span className="text-xs text-gray-500 mt-2 tracking-widest">{label}</span>
        </div>
      ))}
    </div>
  );
}
```

**Step 4: 홈페이지 작성 (threadsaver 클론 + 업그레이드)**

```typescript
// frontend/src/app/page.tsx
import Link from "next/link";
import { getFundStats } from "@/lib/api";
import { FundStatsGrid } from "@/components/FundStats";

const FEATURES = [
  { emoji: "🧠", title: "11 AI Personalities", desc: "Atlas, The Council, Dr. Flow, Insider, Max Payne, Satoshi, Quant King, Asia Tiger, Momentum, Sentinel, Vox Populi — each with distinct strategies." },
  { emoji: "📡", title: "Quant + LLM Hybrid", desc: "Quantitative signals (RSI, momentum, options flow) filtered by LLM conviction scoring. Backtested strategies only." },
  { emoji: "📱", title: "Social Tipping Points", desc: "Reddit, Google Trends, and news sentiment detect market-moving social signals before they become mainstream." },
  { emoji: "🛡️", title: "Risk Management", desc: "Sharpe ratio, Sortino ratio, max drawdown monitoring. Sentinel PM maintains constant hedge positions." },
];

const PMS = [
  { emoji: "🌍", name: "Atlas", strategy: "Macro Regime" },
  { emoji: "🏛️", name: "The Council", strategy: "Multi-Persona" },
  { emoji: "🔬", name: "Dr. Flow", strategy: "Event-Driven" },
  { emoji: "🕵️", name: "Insider", strategy: "Smart Money" },
  { emoji: "💀", name: "Max Payne", strategy: "Contrarian" },
  { emoji: "₿", name: "Satoshi", strategy: "Crypto" },
  { emoji: "📊", name: "Quant King", strategy: "Pure Quant" },
  { emoji: "🌏", name: "Asia Tiger", strategy: "Asia Markets" },
  { emoji: "⚡", name: "Momentum", strategy: "Trend Following" },
  { emoji: "🛡️", name: "Sentinel", strategy: "Risk Hedge" },
  { emoji: "📱", name: "Vox Populi", strategy: "Social Signals" },
];

const PROVIDERS = [
  { name: "Claude", color: "bg-orange-500" },
  { name: "GPT-4o", color: "bg-green-500" },
  { name: "Gemini", color: "bg-blue-500" },
  { name: "Grok", color: "bg-purple-500" },
  { name: "DeepSeek", color: "bg-cyan-500" },
];

export default async function Home() {
  let stats = null;
  try {
    stats = await getFundStats();
  } catch {}

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-6xl font-bold text-cyan-400 mb-4">AI Hedge Fund</h1>
        <p className="text-xl text-gray-400 mb-10">11 AI Portfolio Managers. Quant + LLM Hybrid. One Mission.</p>
        <div className="flex gap-4">
          <Link href="/dashboard" className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition">
            Dashboard →
          </Link>
          <Link href="/pms" className="px-8 py-3 border border-gray-700 hover:border-gray-500 rounded-lg transition">
            AI PMs
          </Link>
          <Link href="/backtest" className="px-8 py-3 border border-gray-700 hover:border-gray-500 rounded-lg transition">
            Backtest
          </Link>
        </div>
      </section>

      {/* Stats */}
      {stats && (
        <section className="max-w-7xl mx-auto px-4 mb-16">
          <FundStatsGrid stats={stats} />
        </section>
      )}

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 mb-16">
        <h2 className="text-center text-sm tracking-widest text-gray-500 mb-8">HOW IT WORKS</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ emoji, title, desc }) => (
            <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <span className="text-3xl mb-4 block">{emoji}</span>
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI PMs */}
      <section className="max-w-7xl mx-auto px-4 mb-16">
        <h2 className="text-center text-sm tracking-widest text-gray-500 mb-8">AI PERSONALITIES × PROVIDERS</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-11 gap-3 mb-6">
          {PMS.map(({ emoji, name, strategy }) => (
            <div key={name} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <span className="text-2xl block mb-1">{emoji}</span>
              <span className="text-xs font-medium text-white block">{name}</span>
              <span className="text-xs text-gray-500">{strategy}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-3 flex-wrap">
          {PROVIDERS.map(({ name, color }) => (
            <span key={name} className={`${color} text-black text-xs font-bold px-4 py-1.5 rounded-full`}>
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-gray-600 text-sm py-8 border-t border-gray-900">
        AI Hedge Fund • 11 AI Portfolio Managers • Quant + LLM Hybrid
      </footer>
    </main>
  );
}
```

**Step 5: 프론트엔드 실행 확인**

```bash
cd frontend && npm run dev
# http://localhost:3000 에서 확인
```

**Step 6: 커밋**

```bash
git add frontend/
git commit -m "feat: Next.js 홈페이지 - threadsaver 클론 + 11 AI PM 업그레이드"
```

---

## Phase 2 — 퀀트 시그널 엔진 + LLM 판단 레이어

### Task 5: 퀀트 시그널 엔진

**Files:**
- Create: `backend/app/engines/quant.py`
- Create: `backend/tests/unit/test_quant_engine.py`

**Step 1: 실패하는 테스트 작성**

```python
# tests/unit/test_quant_engine.py
import pandas as pd
import numpy as np
from app.engines.quant import QuantEngine

def make_prices(n=50, trend="up"):
    if trend == "up":
        return pd.Series([100 + i * 0.5 for i in range(n)])
    elif trend == "down":
        return pd.Series([100 - i * 0.5 for i in range(n)])
    return pd.Series([100 + np.sin(i) for i in range(n)])

def test_rsi_oversold():
    engine = QuantEngine()
    prices = make_prices(50, "down")
    rsi = engine.calculate_rsi(prices, period=14)
    assert rsi < 35, f"Downtrend RSI should be oversold, got {rsi}"

def test_rsi_overbought():
    engine = QuantEngine()
    prices = make_prices(50, "up")
    rsi = engine.calculate_rsi(prices, period=14)
    assert rsi > 65, f"Uptrend RSI should be overbought, got {rsi}"

def test_momentum_score_positive():
    engine = QuantEngine()
    prices = make_prices(252, "up")
    score = engine.calculate_momentum_score(prices, lookback=252)
    assert score > 0

def test_generate_signals_returns_dict():
    engine = QuantEngine()
    prices = make_prices(60)
    signals = engine.generate_signals(prices, symbol="AAPL")
    assert "rsi" in signals
    assert "momentum" in signals
    assert "composite_score" in signals
    assert -1.0 <= signals["composite_score"] <= 1.0
```

**Step 2: 테스트 실행 — FAIL 확인**

```bash
pytest tests/unit/test_quant_engine.py -v
```

**Step 3: 퀀트 엔진 구현**

```python
# app/engines/quant.py
import numpy as np
import pandas as pd
from dataclasses import dataclass

@dataclass
class SignalResult:
    symbol: str
    rsi: float
    momentum: float
    volatility: float
    composite_score: float  # -1.0 (strong sell) ~ +1.0 (strong buy)
    signals: dict

class QuantEngine:
    def calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        delta = prices.diff()
        gain = delta.clip(lower=0).rolling(period).mean()
        loss = (-delta.clip(upper=0)).rolling(period).mean()
        rs = gain / loss.replace(0, np.nan)
        rsi = 100 - (100 / (1 + rs))
        return float(rsi.iloc[-1])

    def calculate_momentum_score(self, prices: pd.Series, lookback: int = 252) -> float:
        if len(prices) < lookback:
            lookback = len(prices)
        returns = prices.pct_change(lookback).iloc[-1]
        return float(returns) if not np.isnan(returns) else 0.0

    def calculate_volatility(self, prices: pd.Series, period: int = 20) -> float:
        returns = prices.pct_change().dropna()
        if len(returns) < period:
            return float(returns.std() * np.sqrt(252))
        return float(returns.iloc[-period:].std() * np.sqrt(252))

    def _rsi_to_signal(self, rsi: float) -> float:
        if rsi < 30: return 0.8
        if rsi < 40: return 0.4
        if rsi > 70: return -0.8
        if rsi > 60: return -0.4
        return 0.0

    def _momentum_to_signal(self, momentum: float) -> float:
        return float(np.clip(momentum * 10, -1.0, 1.0))

    def generate_signals(self, prices: pd.Series, symbol: str) -> dict:
        rsi = self.calculate_rsi(prices)
        momentum = self.calculate_momentum_score(prices)
        volatility = self.calculate_volatility(prices)

        rsi_signal = self._rsi_to_signal(rsi)
        momentum_signal = self._momentum_to_signal(momentum)

        # 가중 평균 (RSI 40%, 모멘텀 60%)
        composite = rsi_signal * 0.4 + momentum_signal * 0.6

        return {
            "symbol": symbol,
            "rsi": round(rsi, 2),
            "momentum": round(momentum, 4),
            "volatility": round(volatility, 4),
            "composite_score": round(float(np.clip(composite, -1.0, 1.0)), 3),
            "rsi_signal": round(rsi_signal, 3),
            "momentum_signal": round(momentum_signal, 3),
        }
```

**Step 4: 테스트 재실행 — PASS 확인**

```bash
pytest tests/unit/test_quant_engine.py -v
```

**Step 5: 커밋**

```bash
git add backend/app/engines/quant.py backend/tests/unit/test_quant_engine.py
git commit -m "feat: 퀀트 시그널 엔진 (RSI, 모멘텀, 변동성, Composite Score)"
```

---

### Task 6: LLM 판단 레이어 (Claude 기반)

**Files:**
- Create: `backend/app/engines/llm.py`
- Create: `backend/tests/unit/test_llm_engine.py`

**Step 1: 실패하는 테스트 작성**

```python
# tests/unit/test_llm_engine.py
from unittest.mock import AsyncMock, patch
from app.engines.llm import LLMEngine

async def test_llm_returns_decision():
    engine = LLMEngine()
    signals = {
        "symbol": "AAPL",
        "rsi": 28.5,
        "momentum": 0.12,
        "composite_score": 0.75,
    }
    # Mock anthropic 호출
    with patch.object(engine, "_call_claude", new_callable=AsyncMock) as mock:
        mock.return_value = {
            "action": "BUY",
            "conviction": 0.82,
            "reasoning": "RSI 과매도 + 강한 모멘텀 → 매수 신호",
            "position_size": 0.08,
        }
        result = await engine.make_decision("atlas", "AAPL", signals, {})
    assert result["action"] in ("BUY", "SELL", "HOLD")
    assert 0.0 <= result["conviction"] <= 1.0
    assert "reasoning" in result

async def test_low_conviction_becomes_hold():
    engine = LLMEngine()
    signals = {"symbol": "AAPL", "rsi": 50.0, "momentum": 0.0, "composite_score": 0.1}
    with patch.object(engine, "_call_claude", new_callable=AsyncMock) as mock:
        mock.return_value = {"action": "BUY", "conviction": 0.3, "reasoning": "약한 신호", "position_size": 0.02}
        result = await engine.make_decision("atlas", "AAPL", signals, {})
    # conviction < 0.5 이면 HOLD로 강제
    assert result["action"] == "HOLD"
```

**Step 2: 테스트 실행 — FAIL 확인**

```bash
pytest tests/unit/test_llm_engine.py -v
```

**Step 3: LLM 엔진 구현**

```python
# app/engines/llm.py
import json
import anthropic
from app.config import settings

SYSTEM_PROMPTS = {
    "atlas": "You are Atlas, a macro regime trading AI. You analyze interest rates, VIX, and currency trends to make directional bets on broad market regimes.",
    "council": "You are The Council, a multi-persona trading AI. You synthesize perspectives from a value investor, growth trader, and macro economist.",
    "drflow": "You are Dr. Flow, an options flow specialist. You identify unusual options activity that signals informed money movements.",
    "insider": "You are Insider, a smart money tracker. You follow SEC Form 4 filings and 13F reports to front-run institutional moves.",
    "maxpayne": "You are Max Payne, a contrarian trader. You fade extreme sentiment and buy when others panic.",
    "satoshi": "You are Satoshi, a crypto specialist. You analyze on-chain metrics, DeFi flows, and crypto market cycles.",
    "quantking": "You are Quant King, a pure quantitative trader. You follow signals mechanically with no emotional bias.",
    "asiatiger": "You are Asia Tiger, specializing in Asian markets. You track Nikkei, Hang Seng, and Korean KOSPI patterns.",
    "momentum": "You are Momentum, a trend-following trader. You buy strength and sell weakness using 52-week momentum.",
    "sentinel": "You are Sentinel, a risk management specialist. Your primary goal is capital preservation through hedging.",
    "voxpopuli": "You are Vox Populi, a social sentiment analyst. You detect tipping points in Reddit, Google Trends, and news before they impact prices.",
}

DECISION_SCHEMA = {
    "action": "BUY | SELL | HOLD",
    "conviction": "float 0.0-1.0",
    "reasoning": "string max 200 chars",
    "position_size": "float 0.0-0.10 (fraction of capital)",
}

class LLMEngine:
    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None and settings.anthropic_api_key:
            self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        return self._client

    async def _call_claude(self, pm_id: str, prompt: str) -> dict:
        system = SYSTEM_PROMPTS.get(pm_id, SYSTEM_PROMPTS["atlas"])
        message = self.client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=512,
            system=system + "\n\nRespond ONLY with valid JSON matching this schema: " + json.dumps(DECISION_SCHEMA),
            messages=[{"role": "user", "content": prompt}],
        )
        return json.loads(message.content[0].text)

    async def make_decision(self, pm_id: str, symbol: str, quant_signals: dict, market_context: dict) -> dict:
        prompt = f"""
Analyze this trading opportunity:
Symbol: {symbol}
Quant Signals: {json.dumps(quant_signals)}
Market Context: {json.dumps(market_context)}

Make a trading decision. If conviction < 0.5, use HOLD.
"""
        result = await self._call_claude(pm_id, prompt)

        # conviction < 0.5 이면 강제 HOLD
        if result.get("conviction", 0) < 0.5:
            result["action"] = "HOLD"

        return {
            "action": result.get("action", "HOLD"),
            "conviction": float(result.get("conviction", 0.0)),
            "reasoning": result.get("reasoning", ""),
            "position_size": float(result.get("position_size", 0.0)),
        }
```

**Step 4: 테스트 재실행 — PASS 확인**

```bash
pytest tests/unit/test_llm_engine.py -v
```

**Step 5: 커밋**

```bash
git add backend/app/engines/llm.py backend/tests/unit/test_llm_engine.py
git commit -m "feat: LLM 판단 레이어 (Claude 기반, conviction < 0.5 → HOLD 강제)"
```

---

### Task 7: PM 상세 API + 프론트 AI PMs 페이지

**Files:**
- Create: `backend/app/api/pm.py`
- Create: `frontend/src/app/pms/page.tsx`
- Create: `frontend/src/components/PMCard.tsx`
- Modify: `backend/app/main.py`

**Step 1: PM 상세 API 테스트**

```python
# tests/integration/test_pm_api.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_pm_detail():
    response = client.get("/api/pm/atlas")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "atlas"
    assert data["name"] == "Atlas"
    assert "itd_return" in data
    assert "current_capital" in data

def test_get_pm_not_found():
    response = client.get("/api/pm/nonexistent")
    assert response.status_code == 404
```

**Step 2: PM API 구현**

```python
# app/api/pm.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.models.pm import PM
from app.models.position import Position

router = APIRouter(prefix="/api/pm", tags=["pm"])

@router.get("/{pm_id}")
async def get_pm_detail(pm_id: str, db: Session = Depends(get_db)):
    pm = db.query(PM).filter(PM.id == pm_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="PM not found")
    positions = db.query(Position).filter(Position.pm_id == pm_id).all()
    itd_return = ((pm.current_capital - 100_000.0) / 100_000.0 * 100)
    return {
        "id": pm.id,
        "name": pm.name,
        "emoji": pm.emoji,
        "strategy": pm.strategy,
        "llm_provider": pm.llm_provider,
        "current_capital": pm.current_capital,
        "itd_return": round(itd_return, 2),
        "position_count": len(positions),
        "positions": [
            {"symbol": p.symbol, "quantity": p.quantity, "avg_cost": p.avg_cost, "asset_type": p.asset_type}
            for p in positions
        ],
    }
```

**Step 3: AI PMs 프론트 페이지**

```typescript
// frontend/src/app/pms/page.tsx
import Link from "next/link";
import { getPMs, PMSummary } from "@/lib/api";

function returnColor(value: number) {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-gray-400";
}

export default async function PMsPage() {
  let pms: PMSummary[] = [];
  try { pms = await getPMs(); } catch {}

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-gray-500 hover:text-white text-sm">← Home</Link>
          <h1 className="text-3xl font-bold text-cyan-400">🤖 AI Portfolio Managers</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pms.map((pm) => (
            <Link key={pm.id} href={`/pms/${pm.id}`}>
              <div className="bg-gray-900 border border-gray-800 hover:border-cyan-800 rounded-xl p-6 transition cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{pm.emoji}</span>
                  <div>
                    <h2 className="font-bold text-white">{pm.name}</h2>
                    <p className="text-sm text-gray-500">{pm.strategy}</p>
                  </div>
                  <span className="ml-auto text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">
                    {pm.llm_provider}
                  </span>
                </div>
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs text-gray-500">CAPITAL</p>
                    <p className="font-mono text-white">${pm.current_capital.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">ITD RETURN</p>
                    <p className={`font-mono font-bold ${returnColor(pm.itd_return)}`}>
                      {pm.itd_return >= 0 ? "+" : ""}{pm.itd_return.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
```

**Step 4: 테스트 + 커밋**

```bash
pytest tests/integration/test_pm_api.py -v
git add backend/app/api/pm.py frontend/src/app/pms/
git commit -m "feat: PM 상세 API + AI PMs 페이지"
```

---

## Phase 3 — 성과 지표 엔진 + 백테스트

### Task 8: 성과 지표 엔진 (샤프비율, 소르티노, MDD, 알파, 베타)

**Files:**
- Create: `backend/app/engines/performance.py`
- Create: `backend/tests/unit/test_performance_engine.py`

**Step 1: 실패하는 테스트 작성**

```python
# tests/unit/test_performance_engine.py
import numpy as np
from app.engines.performance import PerformanceEngine

def make_returns(n=252, annualized_return=0.10):
    daily = annualized_return / 252
    noise = np.random.normal(0, 0.01, n)
    return list(np.full(n, daily) + noise)

def test_sharpe_ratio_positive_returns():
    engine = PerformanceEngine()
    returns = make_returns(252, 0.15)
    sharpe = engine.sharpe_ratio(returns)
    assert sharpe > 0

def test_max_drawdown():
    engine = PerformanceEngine()
    # 50% 하락 후 회복
    returns = [0.01] * 50 + [-0.02] * 50 + [0.01] * 100
    mdd = engine.max_drawdown(returns)
    assert mdd < -0.3  # 최소 30% 낙폭

def test_sortino_ratio():
    engine = PerformanceEngine()
    returns = make_returns(252, 0.12)
    sortino = engine.sortino_ratio(returns)
    assert isinstance(sortino, float)

def test_metrics_bundle():
    engine = PerformanceEngine()
    fund_returns = make_returns(252, 0.15)
    bench_returns = make_returns(252, 0.10)
    metrics = engine.compute_all(fund_returns, bench_returns)
    assert "sharpe" in metrics
    assert "sortino" in metrics
    assert "mdd" in metrics
    assert "alpha" in metrics
    assert "beta" in metrics
    assert "calmar" in metrics
```

**Step 2: 성과 엔진 구현**

```python
# app/engines/performance.py
import numpy as np
from dataclasses import dataclass

RISK_FREE_RATE = 0.05  # 연 5% (현재 미국 금리 기준)
TRADING_DAYS = 252

@dataclass
class PerformanceMetrics:
    sharpe: float
    sortino: float
    mdd: float
    alpha: float
    beta: float
    calmar: float
    annualized_return: float
    annualized_volatility: float

class PerformanceEngine:
    def sharpe_ratio(self, daily_returns: list[float], risk_free: float = RISK_FREE_RATE) -> float:
        r = np.array(daily_returns)
        excess = r - risk_free / TRADING_DAYS
        if r.std() == 0:
            return 0.0
        return float(excess.mean() / r.std() * np.sqrt(TRADING_DAYS))

    def sortino_ratio(self, daily_returns: list[float], risk_free: float = RISK_FREE_RATE) -> float:
        r = np.array(daily_returns)
        excess = r.mean() - risk_free / TRADING_DAYS
        downside = r[r < 0].std() if len(r[r < 0]) > 0 else 1e-10
        return float(excess / downside * np.sqrt(TRADING_DAYS))

    def max_drawdown(self, daily_returns: list[float]) -> float:
        r = np.array(daily_returns)
        cumulative = np.cumprod(1 + r)
        rolling_max = np.maximum.accumulate(cumulative)
        drawdowns = (cumulative - rolling_max) / rolling_max
        return float(drawdowns.min())

    def beta(self, fund_returns: list[float], bench_returns: list[float]) -> float:
        f = np.array(fund_returns)
        b = np.array(bench_returns)
        n = min(len(f), len(b))
        cov = np.cov(f[:n], b[:n])
        bench_var = np.var(b[:n])
        return float(cov[0, 1] / bench_var) if bench_var > 0 else 1.0

    def alpha(self, fund_returns: list[float], bench_returns: list[float], risk_free: float = RISK_FREE_RATE) -> float:
        ann_fund = np.mean(fund_returns) * TRADING_DAYS
        ann_bench = np.mean(bench_returns) * TRADING_DAYS
        b = self.beta(fund_returns, bench_returns)
        return float(ann_fund - (risk_free + b * (ann_bench - risk_free)))

    def calmar_ratio(self, daily_returns: list[float]) -> float:
        ann_return = np.mean(daily_returns) * TRADING_DAYS
        mdd = self.max_drawdown(daily_returns)
        return float(ann_return / abs(mdd)) if mdd != 0 else 0.0

    def compute_all(self, fund_returns: list[float], bench_returns: list[float]) -> dict:
        return {
            "sharpe": round(self.sharpe_ratio(fund_returns), 3),
            "sortino": round(self.sortino_ratio(fund_returns), 3),
            "mdd": round(self.max_drawdown(fund_returns), 4),
            "alpha": round(self.alpha(fund_returns, bench_returns), 4),
            "beta": round(self.beta(fund_returns, bench_returns), 3),
            "calmar": round(self.calmar_ratio(fund_returns), 3),
            "annualized_return": round(float(np.mean(fund_returns)) * TRADING_DAYS, 4),
            "annualized_volatility": round(float(np.std(fund_returns)) * np.sqrt(TRADING_DAYS), 4),
        }
```

**Step 3: 테스트 — PASS 확인 + 커밋**

```bash
pytest tests/unit/test_performance_engine.py -v
git add backend/app/engines/performance.py backend/tests/unit/
git commit -m "feat: 성과 지표 엔진 (샤프, 소르티노, MDD, 알파, 베타, 칼마)"
```

---

## Phase 4 — Paper Trading + 소셜 시그널

### Task 9: 소셜 시그널 엔진 (Vox Populi)

**Files:**
- Create: `backend/app/engines/social.py`
- Create: `backend/tests/unit/test_social_engine.py`

**Step 1: 실패하는 테스트**

```python
# tests/unit/test_social_engine.py
from unittest.mock import patch, MagicMock
from app.engines.social import SocialEngine

def test_zscore_detects_spike():
    engine = SocialEngine()
    # 평소 10회 언급, 갑자기 50회
    history = [10, 11, 9, 10, 12, 10, 9, 11, 10, 50]
    zscore = engine.calculate_zscore(history)
    assert zscore > 3.0, f"Spike should be 3σ+, got {zscore}"

def test_zscore_normal_no_spike():
    engine = SocialEngine()
    history = [10, 11, 9, 10, 12, 10, 9, 11, 10, 10]
    zscore = engine.calculate_zscore(history)
    assert zscore < 1.5

def test_tipping_point_signal():
    engine = SocialEngine()
    result = engine.evaluate_tipping_point("AAPL", mention_history=[10]*9 + [55], sentiment=0.8)
    assert result["is_tipping_point"] == True
    assert result["direction"] == "bullish"
    assert result["zscore"] > 3.0
```

**Step 2: 소셜 엔진 구현**

```python
# app/engines/social.py
import numpy as np
from dataclasses import dataclass

@dataclass
class SocialSignal:
    symbol: str
    is_tipping_point: bool
    zscore: float
    direction: str  # bullish / bearish / neutral
    conviction: float
    sources: list[str]

class SocialEngine:
    TIPPING_THRESHOLD = 3.0

    def calculate_zscore(self, history: list[float]) -> float:
        if len(history) < 3:
            return 0.0
        arr = np.array(history)
        mean = arr[:-1].mean()
        std = arr[:-1].std()
        if std == 0:
            return 0.0
        return float((arr[-1] - mean) / std)

    def evaluate_tipping_point(
        self,
        symbol: str,
        mention_history: list[float],
        sentiment: float,  # -1.0 ~ 1.0
        sources: list[str] = None,
    ) -> dict:
        zscore = self.calculate_zscore(mention_history)
        is_tipping = zscore >= self.TIPPING_THRESHOLD

        if sentiment > 0.3:
            direction = "bullish"
        elif sentiment < -0.3:
            direction = "bearish"
        else:
            direction = "neutral"

        conviction = min(1.0, zscore / 5.0) * abs(sentiment) if is_tipping else 0.0

        return {
            "symbol": symbol,
            "is_tipping_point": is_tipping,
            "zscore": round(zscore, 2),
            "direction": direction,
            "conviction": round(conviction, 3),
            "sources": sources or [],
        }
```

**Step 3: 테스트 — PASS + 커밋**

```bash
pytest tests/unit/test_social_engine.py -v
git add backend/app/engines/social.py backend/tests/unit/test_social_engine.py
git commit -m "feat: 소셜 티핑포인트 엔진 (Z-score 3σ+ 감지)"
```

---

### Task 10: Paper Trading 실행 엔진

**Files:**
- Create: `backend/app/engines/paper_trading.py`
- Create: `backend/app/api/trading.py`
- Create: `backend/tests/unit/test_paper_trading.py`

**Step 1: 실패하는 테스트**

```python
# tests/unit/test_paper_trading.py
from app.engines.paper_trading import PaperTradingEngine

def test_buy_order_reduces_cash():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=10, price=150.0)
    assert engine.cash == 100_000.0 - (10 * 150.0)
    assert "AAPL" in engine.positions

def test_sell_order_increases_cash():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=10, price=150.0)
    engine.execute_sell("AAPL", quantity=5, price=160.0)
    assert engine.cash == 100_000.0 - (10 * 150.0) + (5 * 160.0)
    assert engine.positions["AAPL"]["quantity"] == 5

def test_portfolio_value():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=10, price=150.0)
    value = engine.portfolio_value({"AAPL": 160.0})
    assert value == engine.cash + (10 * 160.0)

def test_position_limit_enforced():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    # 10% 한도 초과 시도 (10001달러 어치)
    result = engine.execute_buy("AAPL", quantity=100, price=101.0)
    assert result["status"] == "rejected"
    assert "position_limit" in result["reason"]
```

**Step 2: Paper Trading 엔진 구현**

```python
# app/engines/paper_trading.py
from dataclasses import dataclass, field

POSITION_LIMIT = 0.10  # 포트폴리오의 10%

@dataclass
class PaperTradingEngine:
    initial_capital: float
    cash: float = field(init=False)
    positions: dict = field(default_factory=dict, init=False)
    trade_history: list = field(default_factory=list, init=False)

    def __post_init__(self):
        self.cash = self.initial_capital

    def portfolio_value(self, current_prices: dict) -> float:
        holdings_value = sum(
            pos["quantity"] * current_prices.get(sym, pos["avg_cost"])
            for sym, pos in self.positions.items()
        )
        return self.cash + holdings_value

    def _check_position_limit(self, symbol: str, order_value: float, current_prices: dict = None) -> bool:
        nav = self.portfolio_value(current_prices or {})
        current_pos_value = 0.0
        if symbol in self.positions:
            pos = self.positions[symbol]
            price = (current_prices or {}).get(symbol, pos["avg_cost"])
            current_pos_value = pos["quantity"] * price
        return (current_pos_value + order_value) <= nav * POSITION_LIMIT

    def execute_buy(self, symbol: str, quantity: float, price: float, current_prices: dict = None) -> dict:
        order_value = quantity * price
        if not self._check_position_limit(symbol, order_value, current_prices):
            return {"status": "rejected", "reason": "position_limit exceeded"}
        if order_value > self.cash:
            return {"status": "rejected", "reason": "insufficient_cash"}
        self.cash -= order_value
        if symbol in self.positions:
            pos = self.positions[symbol]
            total_qty = pos["quantity"] + quantity
            pos["avg_cost"] = (pos["quantity"] * pos["avg_cost"] + order_value) / total_qty
            pos["quantity"] = total_qty
        else:
            self.positions[symbol] = {"quantity": quantity, "avg_cost": price}
        self.trade_history.append({"action": "BUY", "symbol": symbol, "quantity": quantity, "price": price})
        return {"status": "executed", "symbol": symbol, "quantity": quantity, "price": price}

    def execute_sell(self, symbol: str, quantity: float, price: float) -> dict:
        if symbol not in self.positions:
            return {"status": "rejected", "reason": "no_position"}
        if self.positions[symbol]["quantity"] < quantity:
            quantity = self.positions[symbol]["quantity"]
        self.cash += quantity * price
        self.positions[symbol]["quantity"] -= quantity
        if self.positions[symbol]["quantity"] <= 0:
            del self.positions[symbol]
        self.trade_history.append({"action": "SELL", "symbol": symbol, "quantity": quantity, "price": price})
        return {"status": "executed", "symbol": symbol, "quantity": quantity, "price": price}
```

**Step 3: 테스트 — PASS + 커밋**

```bash
pytest tests/unit/test_paper_trading.py -v
git add backend/app/engines/paper_trading.py backend/tests/unit/test_paper_trading.py
git commit -m "feat: Paper Trading 엔진 (포지션 한도 10% 강제, BUY/SELL 실행)"
```

---

## Phase 5 — 실전 브로커 연동

### Task 11: Alpaca 브로커 어댑터

**Files:**
- Create: `backend/app/engines/broker.py`
- Create: `backend/tests/unit/test_broker.py`

**Step 1: 브로커 어댑터 (추상화 레이어)**

```python
# app/engines/broker.py
from abc import ABC, abstractmethod
from enum import Enum

class TradingMode(Enum):
    PAPER = "paper"
    LIVE = "live"

class BrokerAdapter(ABC):
    @abstractmethod
    async def place_order(self, symbol: str, qty: float, side: str, order_type: str = "market") -> dict:
        pass

    @abstractmethod
    async def get_positions(self) -> list[dict]:
        pass

    @abstractmethod
    async def get_account(self) -> dict:
        pass

class AlpacaAdapter(BrokerAdapter):
    def __init__(self, api_key: str, secret_key: str, base_url: str):
        self.api_key = api_key
        self.secret_key = secret_key
        self.base_url = base_url

    async def place_order(self, symbol: str, qty: float, side: str, order_type: str = "market") -> dict:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v2/orders",
                headers={"APCA-API-KEY-ID": self.api_key, "APCA-API-SECRET-KEY": self.secret_key},
                json={"symbol": symbol, "qty": qty, "side": side, "type": order_type, "time_in_force": "day"},
            )
            response.raise_for_status()
            return response.json()

    async def get_positions(self) -> list[dict]:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v2/positions",
                headers={"APCA-API-KEY-ID": self.api_key, "APCA-API-SECRET-KEY": self.secret_key},
            )
            response.raise_for_status()
            return response.json()

    async def get_account(self) -> dict:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v2/account",
                headers={"APCA-API-KEY-ID": self.api_key, "APCA-API-SECRET-KEY": self.secret_key},
            )
            response.raise_for_status()
            return response.json()

def get_broker(mode: TradingMode = TradingMode.PAPER) -> BrokerAdapter:
    from app.config import settings
    base_url = "https://paper-api.alpaca.markets" if mode == TradingMode.PAPER else "https://api.alpaca.markets"
    return AlpacaAdapter(settings.alpaca_api_key, settings.alpaca_secret_key, base_url)
```

**Step 2: 브로커 테스트 (Mock 기반)**

```python
# tests/unit/test_broker.py
from unittest.mock import AsyncMock, patch
from app.engines.broker import AlpacaAdapter, TradingMode, get_broker

async def test_paper_mode_uses_paper_url():
    broker = get_broker(TradingMode.PAPER)
    assert "paper-api" in broker.base_url

async def test_live_mode_uses_live_url():
    broker = get_broker(TradingMode.LIVE)
    assert "paper-api" not in broker.base_url
```

**Step 3: 커밋**

```bash
pytest tests/unit/test_broker.py -v
git add backend/app/engines/broker.py backend/tests/unit/test_broker.py
git commit -m "feat: Alpaca 브로커 어댑터 (Paper/Live 모드 추상화)"
```

---

## 전체 테스트 + 커버리지 확인

```bash
cd backend
pytest --cov=app --cov-report=term-missing tests/
# 목표: 80%+ 커버리지
```

## 로컬 실행 가이드

```bash
# 1. PostgreSQL 실행
docker run -d -e POSTGRES_DB=hedge_fund -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:16

# 2. 백엔드
cd backend && pip install -e ".[dev]"
cp .env.example .env  # API 키 입력
uvicorn app.main:app --reload --port 8000

# 3. 프론트엔드
cd frontend && npm install && npm run dev

# 4. 접속
# http://localhost:3000 — 홈페이지
# http://localhost:8000/docs — FastAPI Swagger
```
