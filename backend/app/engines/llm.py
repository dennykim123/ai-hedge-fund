import json

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
            import anthropic

            self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        return self._client

    async def _call_claude(self, pm_id: str, prompt: str) -> dict:
        system = SYSTEM_PROMPTS.get(pm_id, SYSTEM_PROMPTS["atlas"])
        message = self.client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=512,
            system=system
            + "\n\nRespond ONLY with valid JSON matching this schema: "
            + json.dumps(DECISION_SCHEMA),
            messages=[{"role": "user", "content": prompt}],
        )
        return json.loads(message.content[0].text)

    async def make_decision(
        self,
        pm_id: str,
        symbol: str,
        quant_signals: dict,
        market_context: dict,
    ) -> dict:
        prompt = f"""
Analyze this trading opportunity:
Symbol: {symbol}
Quant Signals: {json.dumps(quant_signals)}
Market Context: {json.dumps(market_context)}

Make a trading decision. If conviction < 0.5, use HOLD.
"""
        result = await self._call_claude(pm_id, prompt)

        # conviction < 0.5 -> force HOLD
        if result.get("conviction", 0) < 0.5:
            result["action"] = "HOLD"

        return {
            "action": result.get("action", "HOLD"),
            "conviction": float(result.get("conviction", 0.0)),
            "reasoning": result.get("reasoning", ""),
            "position_size": float(result.get("position_size", 0.0)),
        }
