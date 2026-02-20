# AI Hedge Fund Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** threadsaver.org 클론 + 업그레이드 — 백테스트로 검증된 퀀트+LLM 하이브리드 AI 헤지펀드 시스템

**Architecture:** FastAPI(Python) 백엔드 + Next.js 프론트엔드 + PostgreSQL DB. 퀀트 시그널 엔진이 후보를 선별하고 LLM이 최종 판단. 기능 단위 수직 완성(풀스택 동시 개발).

**Tech Stack:** FastAPI, PostgreSQL, SQLAlchemy, Alembic, Next.js 15, TypeScript, TailwindCSS, pandas, numpy, anthropic SDK, praw, pytrends, newsapi-python, Recharts (차트), Framer Motion (애니메이션), Lucide React (아이콘), cmdk (커맨드 팔레트)

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

## Phase 6 — Admin 대시보드 (7탭 풀 구현)

> threadsaver Admin을 완전 분석 후 클론 + 업그레이드. 원본은 바닐라 JS SPA, 우리는 Next.js로 구현.

### Task 12: Admin API 엔드포인트 (25개+)

**Files:**
- Create: `backend/app/api/admin/dashboard.py`
- Create: `backend/app/api/admin/strategic.py`
- Create: `backend/app/api/admin/portfolio.py`
- Create: `backend/app/api/admin/risk.py`
- Create: `backend/app/api/admin/analytics.py`
- Create: `backend/app/api/admin/system.py`

**핵심 엔드포인트 목록:**

```python
# Dashboard 탭
GET /api/fund/intelligence/brief      # Market Intelligence (LLM 시장 분석)
GET /api/fund/activity-feed           # Activity Feed (거래/리서치/리스크/협상)

# Strategic 탭
GET /api/fund/strategic/overview      # 레짐, PM 전략 목표
GET /api/fund/strategic/thesis-health # 테시스 건강도 (활성/플래그/무효)
GET /api/fund/exposure/net            # 순 노출 + 충돌 감지
GET /api/fund/strategic/rebalance-status # 리밸런싱 진행도

# PMs 탭
GET /api/fund/pm/dashboard            # PM 리더보드 (전략/전술 분리)
GET /api/fund/pm/{id}/detail          # PM 상세 (포지션, 결정, 세계관)
GET /api/fund/pm/comparison           # Provider/Personality 비교

# Portfolio 탭
GET /api/fund/positions/breakdown     # 포지션 히트맵 데이터
GET /api/fund/trades                  # 거래 기록
GET /api/fund/heatmap                 # 히트맵 (섹터별)
GET /api/fund/exposure                # 섹터별 노출

# Risk 탭
GET /api/fund/risk/overview           # 4개 게이지 + 집중도
GET /api/fund/risk/decisions          # 리스크 결정 기록
GET /api/fund/risk/negotiations       # PM 협상 기록

# Analytics 탭
GET /api/fund/analytics/alpha         # 알파 리더보드 (+ 샤프/소르티노/MDD 추가)
GET /api/fund/analytics/provider      # Provider별 비교
GET /api/fund/analytics/conviction    # 신뢰도 정확도 버킷
GET /api/fund/analytics/positions     # PM별 포지션 P&L
GET /api/fund/analytics/tools         # 도구 효율성

# System 탭
GET /api/fund/system/overview         # 서비스 상태 + 신호 신선도
GET /api/fund/order-pipeline/stats    # 오더 파이프라인
GET /api/fund/soq/status              # Smart Order Queue
GET /api/fund/executions/recent       # 최근 실행 기록
```

**우리만의 업그레이드 (원본 대비):**

```python
# Analytics 탭에 추가
GET /api/fund/analytics/performance   # 샤프/소르티노/MDD/칼마 (원본 없음)
GET /api/fund/analytics/backtest      # 백테스트 결과 (원본 없음)

# System 탭에 추가
GET /api/fund/social/freshness        # 소셜 시그널 신선도 (원본 없음)
# (Reddit, Google Trends, NewsAPI 상태)
```

**Step 1: Intelligence Brief API**

```python
# app/api/admin/dashboard.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.base import get_db

router = APIRouter(prefix="/api/fund", tags=["admin"])

@router.get("/intelligence/brief")
async def get_intelligence_brief(db: Session = Depends(get_db)):
    # LLM이 생성한 최신 시장 분석 반환
    # Phase 2에서 Market Intelligence 엔진 구현 후 연동
    return {
        "brief": {
            "market_read": "Market Intelligence not yet available",
            "quality_score": 0,
            "timestamp": None,
            "hot_tickers": [],
            "events": []
        }
    }

@router.get("/activity-feed")
async def get_activity_feed(limit: int = 30, db: Session = Depends(get_db)):
    from app.models.trade import Trade
    trades = db.query(Trade).order_by(Trade.executed_at.desc()).limit(limit).all()
    items = []
    for t in trades:
        items.append({
            "emoji": "💼",
            "type": "trade",
            "summary": f"{t.pm_id} {t.action} {t.quantity} {t.symbol} @ ${t.price:.2f}",
            "time": t.executed_at.isoformat() if t.executed_at else None,
            "details": {
                "pm_id": t.pm_id,
                "symbol": t.symbol,
                "action": t.action,
                "quantity": t.quantity,
                "price": t.price,
                "conviction": t.conviction_score,
                "reasoning": t.reasoning,
            }
        })
    return {"items": items}
```

**Step 2: Risk Overview API**

```python
# app/api/admin/risk.py
@router.get("/risk/overview")
async def get_risk_overview(db: Session = Depends(get_db)):
    from app.models.position import Position
    from app.models.pm import PM
    pms = db.query(PM).filter(PM.is_active == True).all()
    positions = db.query(Position).all()
    total_nav = sum(pm.current_capital for pm in pms)

    long_exposure = sum(
        p.quantity * p.avg_cost for p in positions if p.quantity > 0
    )
    short_exposure = sum(
        abs(p.quantity) * p.avg_cost for p in positions if p.quantity < 0
    )
    gross_pct = ((long_exposure + short_exposure) / total_nav * 100) if total_nav > 0 else 0
    net_pct = ((long_exposure - short_exposure) / total_nav * 100) if total_nav > 0 else 0

    return {
        "exposure": {"gross_pct": round(gross_pct, 1), "net_pct": round(net_pct, 1)},
        "margin": {"utilization_pct": 0.0},
        "vix": None,  # Phase 4에서 실시간 VIX 연동
        "active_conditions": 0,
        "concentration": {
            "top_ticker": None,
            "top_sector": None,
        },
        "decisions_24h": {"approval_rate": 100.0, "total": 0, "approved": 0, "rejected": 0}
    }
```

**Step 3: Analytics Alpha API (업그레이드 버전)**

```python
# app/api/admin/analytics.py
@router.get("/analytics/alpha")
async def get_analytics_alpha(db: Session = Depends(get_db)):
    from app.models.pm import PM
    from app.models.nav_history import NAVHistory
    from app.engines.performance import PerformanceEngine
    pms = db.query(PM).filter(PM.is_active == True).all()
    engine = PerformanceEngine()
    leaderboard = []
    for pm in pms:
        itd_return = ((pm.current_capital - 100_000.0) / 100_000.0 * 100)
        leaderboard.append({
            "pm_id": pm.id,
            "name": pm.name,
            "emoji": pm.emoji,
            "provider": pm.llm_provider,
            "total_return_pct": round(itd_return, 2),
            "spy_return_pct": 0.0,  # Phase 4에서 실시간 SPY 연동
            "alpha_pct": round(itd_return, 2),
            "rolling_5d_alpha": 0.0,
            # 원본 없음 — 우리만의 업그레이드
            "sharpe": 0.0,
            "sortino": 0.0,
            "mdd": 0.0,
            "calmar": 0.0,
            "data_days": 0,
        })
    leaderboard.sort(key=lambda x: x["alpha_pct"], reverse=True)
    return {"leaderboard": leaderboard}
```

**Step 4: 테스트 작성**

```python
# tests/integration/test_admin_api.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_intelligence_brief():
    r = client.get("/api/fund/intelligence/brief")
    assert r.status_code == 200
    assert "brief" in r.json()

def test_activity_feed():
    r = client.get("/api/fund/activity-feed?limit=10")
    assert r.status_code == 200
    assert "items" in r.json()

def test_risk_overview():
    r = client.get("/api/fund/risk/overview")
    assert r.status_code == 200
    data = r.json()
    assert "exposure" in data
    assert "gross_pct" in data["exposure"]

def test_analytics_alpha_has_upgrade_fields():
    r = client.get("/api/fund/analytics/alpha")
    assert r.status_code == 200
    data = r.json()
    if data["leaderboard"]:
        pm = data["leaderboard"][0]
        # 원본 없는 필드 확인
        assert "sharpe" in pm
        assert "sortino" in pm
        assert "mdd" in pm
```

**Step 5: 커밋**

```bash
pytest tests/integration/test_admin_api.py -v
git add backend/app/api/admin/
git commit -m "feat: Admin 대시보드 API 25개+ 엔드포인트"
```

---

### Task 13: Admin 대시보드 프론트엔드 (Next.js, 7탭)

**Files:**
- Create: `frontend/src/app/admin/page.tsx`
- Create: `frontend/src/app/admin/components/DashboardTab.tsx`
- Create: `frontend/src/app/admin/components/StrategicTab.tsx`
- Create: `frontend/src/app/admin/components/PMsTab.tsx`
- Create: `frontend/src/app/admin/components/PortfolioTab.tsx`
- Create: `frontend/src/app/admin/components/RiskTab.tsx`
- Create: `frontend/src/app/admin/components/AnalyticsTab.tsx`
- Create: `frontend/src/app/admin/components/SystemTab.tsx`
- Create: `frontend/src/app/admin/hooks/useAdminData.ts`

**디자인 시스템 (원본 CSS 변수 그대로):**

```css
/* globals.css에 추가 */
:root {
  --bg: #0d1117;
  --bg2: #161b22;
  --bg3: #1c2128;
  --border: #30363d;
  --text: #e6edf3;
  --muted: #8b949e;
  --green: #00d4aa;
  --red: #ff6b6b;
  --blue: #3b82f6;
  --yellow: #f0b429;
  --purple: #a78bfa;
}
```

**Admin 메인 레이아웃:**

```typescript
// frontend/src/app/admin/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { AdminVitals } from "./components/AdminVitals";
import { DashboardTab } from "./components/DashboardTab";
import { StrategicTab } from "./components/StrategicTab";
import { PMsTab } from "./components/PMsTab";
import { PortfolioTab } from "./components/PortfolioTab";
import { RiskTab } from "./components/RiskTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { SystemTab } from "./components/SystemTab";

const TABS = [
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "strategic", label: "🎯 Strategic" },
  { id: "pms", label: "🤖 PMs" },
  { id: "portfolio", label: "💼 Portfolio" },
  { id: "risk", label: "🛡️ Risk" },
  { id: "analytics", label: "📈 Analytics" },
  { id: "system", label: "⚙️ System" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [vitals, setVitals] = useState(null);

  const refreshVitals = useCallback(async () => {
    const r = await fetch("/api/fund/stats");
    if (r.ok) setVitals(await r.json());
  }, []);

  useEffect(() => {
    refreshVitals();
    const interval = setInterval(refreshVitals, 30_000);
    return () => clearInterval(interval);
  }, [refreshVitals]);

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <AdminVitals vitals={vitals} />
      {/* 탭 네비게이션 */}
      <nav className="flex border-b border-[#30363d] px-4">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === id
                ? "border-cyan-400 text-white"
                : "border-transparent text-[#8b949e] hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      {/* 탭 컨텐츠 */}
      <main className="p-6">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "strategic" && <StrategicTab />}
        {activeTab === "pms" && <PMsTab />}
        {activeTab === "portfolio" && <PortfolioTab />}
        {activeTab === "risk" && <RiskTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "system" && <SystemTab />}
      </main>
    </div>
  );
}
```

**Dashboard 탭 (Activity Feed + Market Intelligence):**

```typescript
// frontend/src/app/admin/components/DashboardTab.tsx
"use client";
import { useEffect, useState } from "react";

const FEED_TYPE_COLORS = {
  trade: "bg-blue-900 text-blue-300",
  research: "bg-purple-900 text-purple-300",
  risk_decision: "bg-red-900 text-red-300",
  negotiation: "bg-yellow-900 text-yellow-300",
};

export function DashboardTab() {
  const [intel, setIntel] = useState(null);
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    fetch("/api/fund/intelligence/brief").then(r => r.json()).then(d => setIntel(d.brief));
    fetch("/api/fund/activity-feed?limit=30").then(r => r.json()).then(d => setFeed(d.items || []));
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Market Intelligence */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🧠</span>
          <h2 className="font-bold">Market Intelligence</h2>
          {intel?.quality_score && (
            <span className="ml-auto text-xs bg-[#1c2128] px-2 py-1 rounded text-[#8b949e]">
              {intel.quality_score}/100
            </span>
          )}
        </div>
        <p className="text-sm text-[#8b949e] leading-relaxed mb-4">
          {intel?.market_read || "Loading..."}
        </p>
        {intel?.hot_tickers?.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {intel.hot_tickers.map(t => (
              <span key={t} className="text-xs bg-cyan-900 text-cyan-300 px-2 py-1 rounded">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h2 className="font-bold mb-4">⚡ Activity Feed</h2>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {feed.map((item, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-[#30363d] last:border-0">
              <span>{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <span className={`text-xs px-1.5 py-0.5 rounded mr-2 ${FEED_TYPE_COLORS[item.type] || "bg-gray-800 text-gray-400"}`}>
                  {item.type}
                </span>
                <span className="text-sm text-[#e6edf3]">{item.summary}</span>
              </div>
              <span className="text-xs text-[#8b949e] shrink-0">
                {item.time ? new Date(item.time).toLocaleTimeString() : ""}
              </span>
            </div>
          ))}
          {feed.length === 0 && <p className="text-[#8b949e] text-sm">No activity yet</p>}
        </div>
      </div>
    </div>
  );
}
```

**Risk 탭 (4개 게이지 + 결정/협상):**

```typescript
// frontend/src/app/admin/components/RiskTab.tsx
"use client";
import { useEffect, useState } from "react";

function RiskGauge({ label, value, max, unit = "%", warnAt, dangerAt }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = value >= dangerAt ? "#ff6b6b" : value >= warnAt ? "#f0b429" : "#00d4aa";
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
      <p className="text-xs text-[#8b949e] mb-2">{label}</p>
      <p className="text-3xl font-mono font-bold" style={{ color }}>
        {value !== null ? `${value.toFixed(1)}${unit}` : "—"}
      </p>
      <div className="mt-3 h-1.5 bg-[#1c2128] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function RiskTab() {
  const [risk, setRisk] = useState(null);
  const [decisions, setDecisions] = useState([]);

  useEffect(() => {
    fetch("/api/fund/risk/overview").then(r => r.json()).then(setRisk);
    fetch("/api/fund/risk/decisions?limit=20").then(r => r.json()).then(d => setDecisions(d.decisions || []));
  }, []);

  return (
    <div className="space-y-6">
      {/* 4개 게이지 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <RiskGauge label="GROSS EXPOSURE" value={risk?.exposure?.gross_pct ?? null} max={300} warnAt={150} dangerAt={200} />
        <RiskGauge label="NET EXPOSURE" value={risk?.exposure?.net_pct ?? null} max={100} warnAt={50} dangerAt={80} />
        <RiskGauge label="MARGIN UTIL" value={risk?.margin?.utilization_pct ?? null} max={100} warnAt={50} dangerAt={75} />
        <RiskGauge label="VIX" value={risk?.vix ?? null} max={60} warnAt={20} dangerAt={30} unit="" />
      </div>

      {/* 리스크 결정 테이블 */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">Risk Decisions</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#8b949e] text-xs">
              <th className="text-left pb-2">TIME</th>
              <th className="text-left pb-2">PM</th>
              <th className="text-left pb-2">TICKER</th>
              <th className="text-left pb-2">OUTCOME</th>
              <th className="text-left pb-2">REASONING</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((d, i) => (
              <tr key={i} className="border-t border-[#30363d]">
                <td className="py-2 text-[#8b949e]">{d.created_at ? new Date(d.created_at).toLocaleTimeString() : "—"}</td>
                <td className="py-2">{d.pm_id}</td>
                <td className="py-2 font-mono">{d.ticker}</td>
                <td className="py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    d.outcome === "approved" ? "bg-green-900 text-green-300" :
                    d.outcome === "rejected" ? "bg-red-900 text-red-300" :
                    "bg-yellow-900 text-yellow-300"
                  }`}>{d.outcome}</span>
                </td>
                <td className="py-2 text-[#8b949e] max-w-xs truncate">{d.reasoning}</td>
              </tr>
            ))}
            {decisions.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-[#8b949e]">No decisions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Analytics 탭 (업그레이드 — 샤프/소르티노/MDD 추가):**

```typescript
// frontend/src/app/admin/components/AnalyticsTab.tsx
"use client";
import { useEffect, useState } from "react";

export function AnalyticsTab() {
  const [alpha, setAlpha] = useState([]);

  useEffect(() => {
    fetch("/api/fund/analytics/alpha").then(r => r.json()).then(d => setAlpha(d.leaderboard || []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">📊 Alpha Leaderboard</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#8b949e] text-xs">
                <th className="text-left pb-2">PM</th>
                <th className="text-right pb-2">RETURN</th>
                <th className="text-right pb-2">ALPHA</th>
                {/* 원본 없음 — 우리 업그레이드 */}
                <th className="text-right pb-2 text-cyan-600">SHARPE ✨</th>
                <th className="text-right pb-2 text-cyan-600">SORTINO ✨</th>
                <th className="text-right pb-2 text-cyan-600">MDD ✨</th>
              </tr>
            </thead>
            <tbody>
              {alpha.map((pm, i) => (
                <tr key={i} className="border-t border-[#30363d]">
                  <td className="py-2">
                    <span className="mr-2">{pm.emoji}</span>{pm.name}
                    <span className="ml-2 text-xs text-[#8b949e]">{pm.provider}</span>
                  </td>
                  <td className={`py-2 text-right font-mono ${pm.total_return_pct >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}>
                    {pm.total_return_pct >= 0 ? "+" : ""}{pm.total_return_pct.toFixed(2)}%
                  </td>
                  <td className={`py-2 text-right font-mono ${pm.alpha_pct >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}>
                    {pm.alpha_pct >= 0 ? "+" : ""}{pm.alpha_pct.toFixed(2)}%
                  </td>
                  <td className="py-2 text-right font-mono text-[#8b949e]">
                    {pm.sharpe ? pm.sharpe.toFixed(2) : "—"}
                  </td>
                  <td className="py-2 text-right font-mono text-[#8b949e]">
                    {pm.sortino ? pm.sortino.toFixed(2) : "—"}
                  </td>
                  <td className={`py-2 text-right font-mono ${pm.mdd < 0 ? "text-[#ff6b6b]" : "text-[#8b949e]"}`}>
                    {pm.mdd ? `${(pm.mdd * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

**Step: 테스트 + 커밋**

```bash
# 프론트 빌드 확인
cd frontend && npm run build

git add frontend/src/app/admin/ backend/app/api/admin/
git commit -m "feat: Admin 대시보드 7탭 구현 (threadsaver 클론 + 샤프/소르티노/MDD 업그레이드)"
```

---

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
# http://localhost:3000        — 홈페이지
# http://localhost:3000/overview — 한눈에 보기 (펀드 상황 + PM 성과 + 리스크)
# http://localhost:3000/admin  — Admin 대시보드 (7탭)
# http://localhost:8000/docs   — FastAPI Swagger
```

---

## Phase 7 — UI/UX 업그레이드

### Task 14: 디자인 시스템 & 공통 컴포넌트

**Files:**
- Create: `frontend/src/components/ui/SkeletonCard.tsx`
- Create: `frontend/src/components/ui/FlashNumber.tsx`
- Create: `frontend/src/components/ui/Toast.tsx`
- Create: `frontend/src/components/ui/RadialGauge.tsx`
- Create: `frontend/src/components/ui/SlideOver.tsx`
- Create: `frontend/src/components/ui/CommandPalette.tsx`
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/app/globals.css`

**Step 1: 패키지 설치**

```bash
cd frontend
npm install recharts framer-motion lucide-react cmdk
npm install -D @types/recharts
```

**Step 2: 글로벌 CSS — 디자인 토큰 + 폰트**

```css
/* frontend/src/app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  --bg:      #0d1117;
  --bg2:     #161b22;
  --bg3:     #1c2128;
  --border:  #30363d;
  --text:    #e6edf3;
  --muted:   #8b949e;
  --green:   #00d4aa;
  --red:     #ff6b6b;
  --blue:    #3b82f6;
  --yellow:  #f0b429;
  --purple:  #a78bfa;
  --cyan:    #22d3ee;
}

body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
}

.font-mono { font-family: 'JetBrains Mono', monospace; }

/* 글래스모피즘 카드 */
.glass-card {
  background: rgba(22, 27, 34, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(48, 54, 61, 0.8);
  border-radius: 12px;
}

/* 숫자 flash 애니메이션 */
@keyframes flash-green {
  0%   { background: transparent; }
  30%  { background: rgba(0, 212, 170, 0.2); }
  100% { background: transparent; }
}
@keyframes flash-red {
  0%   { background: transparent; }
  30%  { background: rgba(255, 107, 107, 0.2); }
  100% { background: transparent; }
}
.flash-up   { animation: flash-green 0.8s ease-out; }
.flash-down { animation: flash-red   0.8s ease-out; }

/* 스켈레톤 shimmer */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--bg3) 25%, var(--bg2) 50%, var(--bg3) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

/* Live 인디케이터 */
@keyframes pulse-live {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
.live-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse-live 1.5s ease-in-out infinite;
}
```

**Step 3: FlashNumber 컴포넌트 (숫자 변경 시 flash)**

```typescript
// frontend/src/components/ui/FlashNumber.tsx
"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  format?: (v: number) => string;
  className?: string;
}

export function FlashNumber({ value, format = (v) => v.toString(), className = "" }: Props) {
  const prevRef = useRef(value);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    if (value === prevRef.current) return;
    const cls = value > prevRef.current ? "flash-up" : "flash-down";
    setFlashClass(cls);
    prevRef.current = value;
    const t = setTimeout(() => setFlashClass(""), 800);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span className={`${className} ${flashClass} rounded px-0.5 transition-colors`}>
      {format(value)}
    </span>
  );
}
```

**Step 4: SkeletonCard 컴포넌트**

```typescript
// frontend/src/components/ui/SkeletonCard.tsx
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="skeleton h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-3" style={{ width: `${70 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass-card p-5">
      <div className="skeleton h-4 w-1/4 mb-4" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="skeleton h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 5: RadialGauge 컴포넌트 (반원형 게이지)**

```typescript
// frontend/src/components/ui/RadialGauge.tsx
interface Props {
  value: number | null;
  max: number;
  label: string;
  unit?: string;
  warnAt: number;
  dangerAt: number;
  size?: number;
}

export function RadialGauge({ value, max, label, unit = "%", warnAt, dangerAt, size = 120 }: Props) {
  const radius = 45;
  const circumference = Math.PI * radius; // 반원
  const pct = value != null ? Math.min(1, value / max) : 0;
  const offset = circumference * (1 - pct);

  const color =
    value == null ? "#30363d" :
    value >= dangerAt ? "#ff6b6b" :
    value >= warnAt   ? "#f0b429" : "#00d4aa";

  return (
    <div className="glass-card p-5 flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox="0 0 100 60">
        {/* 배경 호 */}
        <path
          d="M 5 55 A 45 45 0 0 1 95 55"
          fill="none" stroke="#1c2128" strokeWidth="8" strokeLinecap="round"
        />
        {/* 값 호 */}
        <path
          d="M 5 55 A 45 45 0 0 1 95 55"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
        />
        {/* 값 텍스트 */}
        <text x="50" y="52" textAnchor="middle" fill={color}
              fontSize="14" fontFamily="JetBrains Mono" fontWeight="700">
          {value != null ? `${value.toFixed(1)}${unit}` : "—"}
        </text>
      </svg>
      <p className="text-xs text-[#8b949e] mt-1 tracking-widest">{label}</p>
    </div>
  );
}
```

**Step 6: SlideOver 컴포넌트 (PM 상세 패널)**

```typescript
// frontend/src/components/ui/SlideOver.tsx
"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function SlideOver({ open, onClose, title, children }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 오버레이 */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* 패널 */}
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-[#161b22] border-l border-[#30363d] z-50 overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between p-6 border-b border-[#30363d]">
              <h2 className="text-lg font-bold">{title}</h2>
              <button onClick={onClose} className="text-[#8b949e] hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Step 7: 사이드바 레이아웃**

```typescript
// frontend/src/components/layout/Sidebar.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Eye, Bot, Briefcase,
  Shield, BarChart2, Settings, ChevronLeft, TrendingUp
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/",         icon: TrendingUp,      label: "Home" },
  { href: "/overview", icon: Eye,             label: "Overview" },  // 한눈에 보기
  { href: "/admin",    icon: LayoutDashboard, label: "Dashboard" },
  { href: "/pms",      icon: Bot,             label: "AI PMs" },
  { href: "/portfolio",icon: Briefcase,       label: "Portfolio" },
  { href: "/risk",     icon: Shield,          label: "Risk" },
  { href: "/analytics",icon: BarChart2,       label: "Analytics" },
  { href: "/backtest", icon: BarChart2,       label: "Backtest" },
  { href: "/admin/system", icon: Settings,   label: "System" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`fixed left-0 top-0 h-full bg-[#161b22] border-r border-[#30363d] z-30
                       flex flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}>
      {/* 로고 */}
      <div className="flex items-center gap-3 p-4 border-b border-[#30363d]">
        <span className="text-2xl">🏦</span>
        {!collapsed && <span className="font-bold text-cyan-400 text-sm">AI Hedge Fund</span>}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm
                          ${active
                            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            : "text-[#8b949e] hover:text-white hover:bg-[#1c2128]"}`}>
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* 접기 버튼 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center p-4 border-t border-[#30363d]
                   text-[#8b949e] hover:text-white transition">
        <ChevronLeft size={18} className={`transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>
    </aside>
  );
}
```

**Step 8: 커맨드 팔레트 (⌘K)**

```typescript
// frontend/src/components/ui/CommandPalette.tsx
"use client";
import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const COMMANDS = [
  { label: "Overview — 한눈에 보기", href: "/overview", icon: "👁" },
  { label: "Admin Dashboard", href: "/admin", icon: "📊" },
  { label: "AI Portfolio Managers", href: "/pms", icon: "🤖" },
  { label: "Portfolio", href: "/portfolio", icon: "💼" },
  { label: "Risk Monitor", href: "/risk", icon: "🛡️" },
  { label: "Analytics", href: "/analytics", icon: "📈" },
  { label: "Backtest", href: "/backtest", icon: "🔬" },
  { label: "System Status", href: "/admin/system", icon: "⚙️" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg z-50"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <Command className="glass-card overflow-hidden shadow-2xl"
                     style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <Command.Input
                placeholder="페이지 이동, 종목 검색..."
                className="w-full px-4 py-4 bg-transparent text-white placeholder-[#8b949e]
                           border-b border-[#30363d] outline-none text-sm"
              />
              <Command.List className="max-h-64 overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-[#8b949e] text-sm">
                  결과 없음
                </Command.Empty>
                {COMMANDS.map(({ label, href, icon }) => (
                  <Command.Item
                    key={href}
                    value={label}
                    onSelect={() => { router.push(href); setOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                               text-sm text-[#e6edf3] aria-selected:bg-[#1c2128] transition"
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Step 9: 커밋**

```bash
cd frontend && npm run build  # 빌드 에러 확인
git add frontend/src/components/ui/ frontend/src/components/layout/ frontend/src/app/globals.css
git commit -m "feat: 디자인 시스템 - FlashNumber, SkeletonCard, RadialGauge, SlideOver, Sidebar, CommandPalette"
```

---

### Task 15: 한눈에 보기 (Overview) 페이지

> 펀드 전체 상황 + PM 성과 + 리스크를 **한 화면**에서 색/모양으로 즉시 파악

**Files:**
- Create: `frontend/src/app/overview/page.tsx`
- Create: `frontend/src/app/overview/components/FundHealthBadge.tsx`
- Create: `frontend/src/app/overview/components/PMHeatmap.tsx`
- Create: `frontend/src/app/overview/components/RiskRadar.tsx`
- Create: `frontend/src/app/overview/components/NAVSparkline.tsx`
- Create: `frontend/src/app/overview/components/AlertBanner.tsx`

**레이아웃 구조:**

```
┌─────────────────────────────────────────────────────┐
│  🟢 FUND HEALTH: GOOD   NAV: $1.1M  +2.3% today    │  ← AlertBanner (위험 시 빨강)
├────────────┬────────────────────┬───────────────────┤
│            │                    │                   │
│  FUND      │   NAV SPARKLINE    │  RISK RADAR       │
│  HEALTH    │   (7일 수익 곡선)   │  (5각형 레이더)   │
│  BADGE     │                    │                   │
├────────────┴────────────────────┴───────────────────┤
│                  PM HEATMAP                          │
│  🌍+2.1% 🏛️+1.8% 🔬-0.3% 🕵️+4.2% 💀+0.9%         │
│  ₿+8.1%  📊+1.2% 🌏-1.1% ⚡+3.3% 🛡️+0.4% 📱+2.7%  │
│  (수익률 기반 색상 — 진할수록 강함)                  │
└─────────────────────────────────────────────────────┘
```

**Step 1: FundHealthBadge 컴포넌트**

```typescript
// frontend/src/app/overview/components/FundHealthBadge.tsx
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

type HealthStatus = "EXCELLENT" | "GOOD" | "CAUTION" | "DANGER";

function getHealth(itdReturn: number, mdd: number, sharpe: number): HealthStatus {
  if (mdd < -0.15 || itdReturn < -0.10) return "DANGER";
  if (mdd < -0.08 || itdReturn < -0.03) return "CAUTION";
  if (itdReturn > 0.05 && sharpe > 1.0)  return "EXCELLENT";
  return "GOOD";
}

const HEALTH_CONFIG = {
  EXCELLENT: { color: "#00d4aa", bg: "rgba(0,212,170,0.1)", border: "rgba(0,212,170,0.3)", icon: TrendingUp,     label: "EXCELLENT" },
  GOOD:      { color: "#22d3ee", bg: "rgba(34,211,238,0.1)",  border: "rgba(34,211,238,0.3)", icon: TrendingUp,     label: "GOOD" },
  CAUTION:   { color: "#f0b429", bg: "rgba(240,180,41,0.1)",  border: "rgba(240,180,41,0.3)", icon: Minus,          label: "CAUTION" },
  DANGER:    { color: "#ff6b6b", bg: "rgba(255,107,107,0.1)", border: "rgba(255,107,107,0.3)", icon: AlertTriangle, label: "DANGER" },
};

interface Props {
  itdReturn: number;
  mdd: number;
  sharpe: number;
}

export function FundHealthBadge({ itdReturn, mdd, sharpe }: Props) {
  const status = getHealth(itdReturn, mdd, sharpe);
  const { color, bg, border, icon: Icon, label } = HEALTH_CONFIG[status];

  return (
    <div className="glass-card p-6 flex flex-col items-center justify-center gap-3"
         style={{ background: bg, borderColor: border }}>
      <Icon size={40} color={color} />
      <div className="text-center">
        <p className="text-xs text-[#8b949e] tracking-widest mb-1">FUND HEALTH</p>
        <p className="text-2xl font-bold" style={{ color }}>{label}</p>
      </div>
      <div className="text-xs text-[#8b949e] space-y-1 w-full">
        <div className="flex justify-between">
          <span>ITD Return</span>
          <span style={{ color }}>{itdReturn >= 0 ? "+" : ""}{(itdReturn * 100).toFixed(2)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Max Drawdown</span>
          <span style={{ color: mdd < -0.08 ? "#ff6b6b" : "#8b949e" }}>
            {(mdd * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Sharpe</span>
          <span style={{ color: sharpe > 1.5 ? "#00d4aa" : "#8b949e" }}>
            {sharpe.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: PMHeatmap 컴포넌트 (PM 성과 히트맵)**

```typescript
// frontend/src/app/overview/components/PMHeatmap.tsx
import { PMSummary } from "@/lib/api";

function returnToColor(ret: number): string {
  if (ret >  5) return "rgba(0,212,170,0.9)";
  if (ret >  2) return "rgba(0,212,170,0.6)";
  if (ret >  0) return "rgba(0,212,170,0.3)";
  if (ret > -2) return "rgba(255,107,107,0.3)";
  if (ret > -5) return "rgba(255,107,107,0.6)";
  return "rgba(255,107,107,0.9)";
}

function returnToTextColor(ret: number): string {
  return ret >= 0 ? "#00d4aa" : "#ff6b6b";
}

export function PMHeatmap({ pms }: { pms: PMSummary[] }) {
  return (
    <div className="glass-card p-5">
      <p className="text-xs text-[#8b949e] tracking-widest mb-4">PM PERFORMANCE HEATMAP</p>
      <div className="grid grid-cols-4 lg:grid-cols-6 gap-2">
        {pms.map((pm) => (
          <div
            key={pm.id}
            className="rounded-xl p-3 flex flex-col items-center gap-1 transition-transform hover:scale-105 cursor-pointer"
            style={{ background: returnToColor(pm.itd_return) }}
          >
            <span className="text-2xl">{pm.emoji}</span>
            <span className="text-xs font-medium text-white truncate w-full text-center">
              {pm.name}
            </span>
            <span className="text-sm font-mono font-bold"
                  style={{ color: returnToTextColor(pm.itd_return) }}>
              {pm.itd_return >= 0 ? "+" : ""}{pm.itd_return.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      {/* 범례 */}
      <div className="flex items-center gap-2 mt-4 justify-center">
        {[
          { color: "rgba(255,107,107,0.9)", label: "< -5%" },
          { color: "rgba(255,107,107,0.3)", label: "0%" },
          { color: "rgba(0,212,170,0.3)",   label: "+2%" },
          { color: "rgba(0,212,170,0.9)",   label: "> +5%" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ background: color }} />
            <span className="text-xs text-[#8b949e]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: NAVSparkline 컴포넌트 (수익률 곡선)**

```typescript
// frontend/src/app/overview/components/NAVSparkline.tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart } from "recharts";

interface DataPoint { date: string; nav: number; return_pct: number; }

export function NAVSparkline({ data }: { data: DataPoint[] }) {
  const isPositive = data.length > 1 && data[data.length - 1].return_pct >= 0;
  const color = isPositive ? "#00d4aa" : "#ff6b6b";

  return (
    <div className="glass-card p-5">
      <p className="text-xs text-[#8b949e] tracking-widest mb-4">NAV HISTORY (7D)</p>
      {data.length < 2 ? (
        <div className="h-32 flex items-center justify-center text-[#8b949e] text-sm">
          데이터 수집 중...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"   stopColor={color} stopOpacity={0.3} />
                <stop offset="95%"  stopColor={color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#1c2128", border: "1px solid #30363d", borderRadius: 8 }}
              labelStyle={{ color: "#8b949e", fontSize: 11 }}
              formatter={(v: number) => [`$${v.toLocaleString()}`, "NAV"]}
            />
            <ReferenceLine y={data[0]?.nav} stroke="#30363d" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="nav" stroke={color} strokeWidth={2}
                  fill="url(#navGradient)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

**Step 4: RiskRadar 컴포넌트 (5각형 레이더)**

```typescript
// frontend/src/app/overview/components/RiskRadar.tsx
"use client";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

interface Props {
  grossExposure: number;  // 0-300%
  netExposure: number;    // 0-100%
  marginUtil: number;     // 0-100%
  concentration: number;  // 0-100% (상위 종목 집중도)
  volatility: number;     // 0-100% (연환산)
}

export function RiskRadar({ grossExposure, netExposure, marginUtil, concentration, volatility }: Props) {
  const data = [
    { subject: "Gross Exp",     value: Math.min(100, grossExposure / 3),  fullMark: 100 },
    { subject: "Net Exp",       value: Math.min(100, netExposure),         fullMark: 100 },
    { subject: "Margin",        value: Math.min(100, marginUtil),          fullMark: 100 },
    { subject: "Concentration", value: Math.min(100, concentration),       fullMark: 100 },
    { subject: "Volatility",    value: Math.min(100, volatility),          fullMark: 100 },
  ];

  const maxRisk = Math.max(...data.map(d => d.value));
  const radarColor = maxRisk > 75 ? "#ff6b6b" : maxRisk > 50 ? "#f0b429" : "#00d4aa";

  return (
    <div className="glass-card p-5">
      <p className="text-xs text-[#8b949e] tracking-widest mb-2">RISK RADAR</p>
      <ResponsiveContainer width="100%" height={160}>
        <RadarChart data={data}>
          <PolarGrid stroke="#30363d" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "#8b949e", fontSize: 10 }} />
          <Radar dataKey="value" stroke={radarColor} fill={radarColor}
                 fillOpacity={0.2} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 5: AlertBanner 컴포넌트 (상단 경보)**

```typescript
// frontend/src/app/overview/components/AlertBanner.tsx
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

export type AlertLevel = "ok" | "warn" | "danger";

interface Alert { level: AlertLevel; message: string; }

const LEVEL_CONFIG = {
  ok:     { color: "#00d4aa", bg: "rgba(0,212,170,0.08)",   border: "rgba(0,212,170,0.2)",   Icon: CheckCircle },
  warn:   { color: "#f0b429", bg: "rgba(240,180,41,0.08)",  border: "rgba(240,180,41,0.2)",  Icon: Info },
  danger: { color: "#ff6b6b", bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.2)", Icon: AlertTriangle },
};

export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const topLevel = alerts.find(a => a.level === "danger")?.level
                ?? alerts.find(a => a.level === "warn")?.level
                ?? "ok";
  const { color, bg, border, Icon } = LEVEL_CONFIG[topLevel];

  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3 mb-4"
         style={{ background: bg, border: `1px solid ${border}` }}>
      <Icon size={16} color={color} />
      <div className="flex gap-4 flex-wrap">
        {alerts.map((a, i) => (
          <span key={i} className="text-sm" style={{ color: LEVEL_CONFIG[a.level].color }}>
            {a.message}
          </span>
        ))}
      </div>
    </div>
  );
}
```

**Step 6: Overview 메인 페이지**

```typescript
// frontend/src/app/overview/page.tsx
"use client";
import { useEffect, useState } from "react";
import { FundHealthBadge } from "./components/FundHealthBadge";
import { PMHeatmap } from "./components/PMHeatmap";
import { NAVSparkline } from "./components/NAVSparkline";
import { RiskRadar } from "./components/RiskRadar";
import { AlertBanner, AlertLevel } from "./components/AlertBanner";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { FlashNumber } from "@/components/ui/FlashNumber";
import { getFundStats, getPMs } from "@/lib/api";

function buildAlerts(stats, riskData): Array<{ level: AlertLevel; message: string }> {
  const alerts = [];
  if (!stats) return alerts;
  if (stats.itd_return < -10)      alerts.push({ level: "danger", message: `ITD ${stats.itd_return.toFixed(1)}% — MDD 임계치 초과` });
  else if (stats.itd_return < -3)  alerts.push({ level: "warn",   message: `ITD ${stats.itd_return.toFixed(1)}% — 손실 주의` });
  if (riskData?.vix > 30)          alerts.push({ level: "danger", message: `VIX ${riskData.vix} — 극단적 공포 구간` });
  else if (riskData?.vix > 20)     alerts.push({ level: "warn",   message: `VIX ${riskData.vix} — 변동성 상승 중` });
  if (alerts.length === 0)         alerts.push({ level: "ok",     message: "모든 지표 정상 범위" });
  return alerts;
}

export default function OverviewPage() {
  const [stats, setStats] = useState(null);
  const [pms, setPMs] = useState([]);
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getFundStats().then(setStats),
      getPMs().then(setPMs),
      fetch("/api/fund/risk/overview").then(r => r.json()).then(setRisk),
    ]).finally(() => setLoading(false));

    const interval = setInterval(() => {
      getFundStats().then(setStats);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const alerts = buildAlerts(stats, risk);
  const fmtCurrency = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  return (
    <div className="space-y-4">
      {/* 경보 배너 */}
      <AlertBanner alerts={alerts} />

      {/* 핵심 수치 — sticky 상단 */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-px bg-[#30363d] rounded-xl overflow-hidden">
        {[
          { label: "FUND NAV",    value: stats?.nav ?? 0,          fmt: fmtCurrency, color: "text-cyan-400" },
          { label: "TODAY",       value: stats?.today_return ?? 0,  fmt: fmtPct,      color: stats?.today_return >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]" },
          { label: "ITD RETURN",  value: stats?.itd_return ?? 0,    fmt: fmtPct,      color: stats?.itd_return >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]" },
          { label: "ACTIVE PMs",  value: stats?.active_pms ?? 0,    fmt: String,      color: "text-blue-400" },
          { label: "POSITIONS",   value: stats?.total_positions ?? 0,fmt: String,     color: "text-yellow-400" },
          { label: "LIVE",        value: null,                       fmt: () => "",    color: "" },
        ].map(({ label, value, fmt, color }, i) => (
          <div key={label} className="bg-[#0d1117] px-4 py-5 flex flex-col items-center">
            {label === "LIVE" ? (
              <>
                <div className="live-dot mb-1" />
                <span className="text-xs text-[#8b949e] tracking-widest">LIVE</span>
              </>
            ) : (
              <>
                <FlashNumber value={value} format={fmt}
                             className={`text-2xl font-mono font-bold ${color}`} />
                <span className="text-xs text-[#8b949e] tracking-widest mt-1">{label}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 3열 메인 그리드 */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonCard rows={5} />
          <SkeletonCard rows={5} />
          <SkeletonCard rows={5} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FundHealthBadge
            itdReturn={(stats?.itd_return ?? 0) / 100}
            mdd={0}
            sharpe={0}
          />
          <NAVSparkline data={[]} />
          <RiskRadar
            grossExposure={risk?.exposure?.gross_pct ?? 0}
            netExposure={risk?.exposure?.net_pct ?? 0}
            marginUtil={risk?.margin?.utilization_pct ?? 0}
            concentration={0}
            volatility={0}
          />
        </div>
      )}

      {/* PM 히트맵 */}
      {loading ? <SkeletonCard rows={3} /> : <PMHeatmap pms={pms} />}
    </div>
  );
}
```

**Step 7: 레이아웃에 Sidebar 통합**

```typescript
// frontend/src/app/layout.tsx (수정)
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/ui/CommandPalette";

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <Sidebar />
        <CommandPalette />
        <main className="ml-56 p-6 min-h-screen bg-[#0d1117]">
          {children}
        </main>
      </body>
    </html>
  );
}
```

**Step 8: 테스트 + 커밋**

```bash
cd frontend && npm run build
git add frontend/src/app/overview/ frontend/src/app/layout.tsx
git commit -m "feat: Overview 한눈에 보기 - FundHealth + PMHeatmap + NAVSparkline + RiskRadar + AlertBanner"
```

---

### Task 16: Admin 대시보드 UI 업그레이드 적용

**기존 Admin 탭에 새 컴포넌트 교체:**

| 교체 대상 | 원본 | 업그레이드 |
|---|---|---|
| Risk 게이지 | 단순 바 | `RadialGauge` 반원형 |
| PM 카드 클릭 | 인라인 펼치기 | `SlideOver` 패널 |
| 로딩 상태 | "Loading..." 텍스트 | `SkeletonCard` / `SkeletonTable` |
| 수치 변경 | 즉시 교체 | `FlashNumber` flash 효과 |
| Activity Feed | 텍스트 리스트 | 타임라인 UI |
| Portfolio 히트맵 | 색상 박스 | 인터랙티브 + 툴팁 |

**RiskTab에 RadialGauge 적용:**

```typescript
// RiskTab.tsx 수정
import { RadialGauge } from "@/components/ui/RadialGauge";

// 기존 RiskGauge 컴포넌트를 RadialGauge로 교체
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <RadialGauge label="GROSS EXPOSURE" value={risk?.exposure?.gross_pct ?? null}
               max={300} warnAt={150} dangerAt={200} />
  <RadialGauge label="NET EXPOSURE"   value={risk?.exposure?.net_pct ?? null}
               max={100} warnAt={50}  dangerAt={80} />
  <RadialGauge label="MARGIN UTIL"    value={risk?.margin?.utilization_pct ?? null}
               max={100} warnAt={50}  dangerAt={75} />
  <RadialGauge label="VIX"            value={risk?.vix ?? null}
               max={60}  warnAt={20}  dangerAt={30} unit="" />
</div>
```

**PMsTab에 SlideOver 적용:**

```typescript
// PMsTab.tsx 수정
import { SlideOver } from "@/components/ui/SlideOver";
import { useState } from "react";

// PM 카드 클릭 → SlideOver 열기
const [selectedPM, setSelectedPM] = useState(null);
const [detail, setDetail] = useState(null);

const openPM = async (pmId) => {
  const d = await fetch(`/api/pm/${pmId}`).then(r => r.json());
  setDetail(d);
  setSelectedPM(pmId);
};

// SlideOver 안에 PM 상세 내용
<SlideOver open={!!selectedPM} onClose={() => setSelectedPM(null)}
           title={`${detail?.emoji} ${detail?.name}`}>
  {/* 성과 카드, 포지션 테이블, 결정 타임라인, Worldview */}
</SlideOver>
```

**Step: 커밋**

```bash
git add frontend/src/app/admin/
git commit -m "feat: Admin UI 업그레이드 - RadialGauge, SlideOver PM 상세, SkeletonUI, FlashNumber"
```
