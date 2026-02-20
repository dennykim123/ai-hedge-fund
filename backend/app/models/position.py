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
    asset_type: Mapped[str] = mapped_column(String(20), default="stock")
    opened_at = mapped_column(DateTime, server_default=func.now())
