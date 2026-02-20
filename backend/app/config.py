from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "sqlite:///./hedge_fund.db"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    polygon_api_key: str = ""
    news_api_key: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    alpaca_api_key: str = ""
    alpaca_secret_key: str = ""
    alpaca_base_url: str = "https://paper-api.alpaca.markets"
    environment: str = "development"
    initial_fund_nav: float = 1_000_000.0


settings = Settings()
