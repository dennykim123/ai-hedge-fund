PM_SEEDS = [
    # KIS (한국투자증권) — 주식 PM들
    {"id": "atlas",     "name": "Atlas",       "emoji": "\U0001f30d", "strategy": "Macro Regime",        "llm_provider": "claude",    "broker_type": "kis"},
    {"id": "council",   "name": "The Council", "emoji": "\U0001f3db\ufe0f", "strategy": "Multi-Persona", "llm_provider": "openai",    "broker_type": "kis"},
    {"id": "drflow",    "name": "Dr. Flow",    "emoji": "\U0001f52c", "strategy": "Event-Driven",        "llm_provider": "gemini",    "broker_type": "kis"},
    {"id": "insider",   "name": "Insider",     "emoji": "\U0001f575\ufe0f", "strategy": "Smart Money",   "llm_provider": "grok",      "broker_type": "kis"},
    {"id": "maxpayne",  "name": "Max Payne",   "emoji": "\U0001f480", "strategy": "Contrarian",          "llm_provider": "deepseek",  "broker_type": "kis"},
    {"id": "quantking", "name": "Quant King",  "emoji": "\U0001f4ca", "strategy": "Pure Quant",          "llm_provider": "rule_based","broker_type": "kis"},
    {"id": "asiatiger", "name": "Asia Tiger",  "emoji": "\U0001f30f", "strategy": "Asia Markets",        "llm_provider": "gemini",    "broker_type": "kis"},
    {"id": "momentum",  "name": "Momentum",    "emoji": "\u26a1",     "strategy": "Trend Following",     "llm_provider": "openai",    "broker_type": "kis"},
    {"id": "sentinel",  "name": "Sentinel",    "emoji": "\U0001f6e1\ufe0f", "strategy": "Risk Hedge",    "llm_provider": "claude",    "broker_type": "kis"},
    {"id": "voxpopuli", "name": "Vox Populi",  "emoji": "\U0001f4f1", "strategy": "Social Tipping Point","llm_provider": "claude",    "broker_type": "kis"},
    # Bybit — 크립토 전담 PM
    {"id": "satoshi",   "name": "Satoshi",     "emoji": "\u20bf",     "strategy": "Crypto Specialist",   "llm_provider": "claude",    "broker_type": "bybit"},
]


def seed_pms(db):
    from app.models.pm import PM

    for seed in PM_SEEDS:
        existing = db.query(PM).filter(PM.id == seed["id"]).first()
        if not existing:
            db.add(PM(**seed, initial_capital=100_000.0, current_capital=100_000.0))
    db.commit()
