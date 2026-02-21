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
    broker_type: Mapped[str] = mapped_column(String(20), default="paper")  # paper | kis | bybit
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    initial_capital: Mapped[float] = mapped_column(Float, default=100_000.0)
    current_capital: Mapped[float] = mapped_column(Float, default=100_000.0)
    created_at = mapped_column(DateTime, server_default=func.now())
