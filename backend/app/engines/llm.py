import json
import re

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

JSON_INSTRUCTION = "\n\nRespond ONLY with valid JSON matching this schema (no markdown, no code fences): " + json.dumps(DECISION_SCHEMA)


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM response, stripping markdown code fences if present."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


class LLMEngine:
    def __init__(self):
        self._claude_client = None
        self._openai_client = None
        self._grok_client = None
        self._gemini_client = None
        self._gemini_model = None

    # --- Lazy client init ---

    @property
    def claude_client(self):
        if self._claude_client is None and settings.anthropic_api_key:
            import anthropic
            self._claude_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        return self._claude_client

    @property
    def openai_client(self):
        if self._openai_client is None and settings.openai_api_key:
            import openai
            self._openai_client = openai.OpenAI(api_key=settings.openai_api_key)
        return self._openai_client

    @property
    def grok_client(self):
        if self._grok_client is None and settings.grok_api_key:
            import openai
            self._grok_client = openai.OpenAI(
                api_key=settings.grok_api_key,
                base_url="https://api.x.ai/v1",
            )
        return self._grok_client

    @property
    def gemini_model(self):
        if self._gemini_model is None and settings.gemini_api_key:
            from google import genai
            self._gemini_client = genai.Client(api_key=settings.gemini_api_key)
            self._gemini_model = "gemini-2.0-flash"
        return self._gemini_model

    # --- Provider calls ---

    async def _call_claude(self, pm_id: str, prompt: str) -> dict:
        if not self.claude_client:
            raise RuntimeError("Anthropic API key not configured")
        system = SYSTEM_PROMPTS.get(pm_id, SYSTEM_PROMPTS["atlas"])
        message = self.claude_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=system + JSON_INSTRUCTION,
            messages=[{"role": "user", "content": prompt}],
        )
        return _parse_json(message.content[0].text)

    async def _call_openai(self, pm_id: str, prompt: str) -> dict:
        if not self.openai_client:
            raise RuntimeError("OpenAI API key not configured")
        system = SYSTEM_PROMPTS.get(pm_id, SYSTEM_PROMPTS["atlas"])
        response = self.openai_client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=512,
            messages=[
                {"role": "system", "content": system + JSON_INSTRUCTION},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        return _parse_json(response.choices[0].message.content)

    async def _call_gemini(self, pm_id: str, prompt: str) -> dict:
        if not self.gemini_model:
            raise RuntimeError("Gemini API key not configured")
        from google.genai import types
        system = SYSTEM_PROMPTS.get(pm_id, SYSTEM_PROMPTS["atlas"])
        full_prompt = f"{system}{JSON_INSTRUCTION}\n\n{prompt}"
        response = self._gemini_client.models.generate_content(
            model=self._gemini_model,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=512,
                response_mime_type="application/json",
            ),
        )
        return _parse_json(response.text)

    async def _call_grok(self, pm_id: str, prompt: str) -> dict:
        if not self.grok_client:
            raise RuntimeError("Grok API key not configured")
        system = SYSTEM_PROMPTS.get(pm_id, SYSTEM_PROMPTS["atlas"])
        response = self.grok_client.chat.completions.create(
            model="grok-3-mini-fast",
            max_tokens=512,
            messages=[
                {"role": "system", "content": system + JSON_INSTRUCTION},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        return _parse_json(response.choices[0].message.content)

    # --- Main entry point ---

    async def make_decision(
        self,
        pm_id: str,
        symbol: str,
        quant_signals: dict,
        market_context: dict,
        llm_provider: str = "claude",
    ) -> dict:
        prompt = f"""Analyze this trading opportunity:
Symbol: {symbol}
Quant Signals: {json.dumps(quant_signals)}
Market Context: {json.dumps(market_context)}

Make a trading decision. If conviction < 0.5, use HOLD."""

        call_map = {
            "claude": self._call_claude,
            "openai": self._call_openai,
            "gemini": self._call_gemini,
            "grok": self._call_grok,
            "deepseek": self._call_claude,  # fallback to claude if deepseek key missing
        }

        caller = call_map.get(llm_provider)
        if caller is None:
            raise ValueError(f"Unknown LLM provider: {llm_provider}")

        result = await caller(pm_id, prompt)

        if result.get("conviction", 0) < 0.5:
            result["action"] = "HOLD"

        return {
            "action": result.get("action", "HOLD"),
            "conviction": float(result.get("conviction", 0.0)),
            "reasoning": result.get("reasoning", ""),
            "position_size": float(result.get("position_size", 0.0)),
        }
