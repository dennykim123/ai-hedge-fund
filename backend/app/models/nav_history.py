from sqlalchemy import Float, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NAVHistory(Base):
    __tablename__ = "nav_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nav: Mapped[float] = mapped_column(Float)
    daily_return: Mapped[float] = mapped_column(Float, default=0.0)
    recorded_at = mapped_column(DateTime, server_default=func.now())
