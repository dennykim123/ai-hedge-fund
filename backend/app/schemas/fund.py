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
    broker_type: str
    current_capital: float
    itd_return: float

    model_config = {"from_attributes": True}
