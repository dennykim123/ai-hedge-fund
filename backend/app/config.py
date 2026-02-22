from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "sqlite:///./hedge_fund.db"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    grok_api_key: str = ""
    deepseek_api_key: str = ""
    polygon_api_key: str = ""
    news_api_key: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    alpaca_api_key: str = ""
    alpaca_secret_key: str = ""
    alpaca_base_url: str = "https://paper-api.alpaca.markets"

    # 한국투자증권 KIS
    kis_app_key: str = ""
    kis_app_secret: str = ""
    kis_account_no: str = ""       # 계좌번호 (예: 50123456-01)
    kis_mock: bool = True          # True = 모의투자, False = 실거래

    # Bybit
    bybit_api_key: str = ""
    bybit_api_secret: str = ""
    bybit_testnet: bool = True     # True = 테스트넷, False = 실거래

    cors_origins: str = "http://localhost:3000,http://localhost:4000"
    environment: str = "development"
    initial_fund_nav: float = 1_000_000.0

    # Trading parameters
    position_limit_pct: float = 0.10       # 포지션당 최대 자본 비율
    cash_reserve_pct: float = 0.95         # 현금 사용 비율 (5% 여유)
    scheduler_interval: int = 300          # 트레이딩 사이클 주기 (초)
    min_conviction: float = 0.4            # 최소 확신도 (이하 거래 안함)

    # Risk management
    max_daily_loss_pct: float = 0.05       # 일일 최대 손실률 (5%)
    max_consecutive_losses: int = 5        # 연속 손실 허용 횟수


settings = Settings()
