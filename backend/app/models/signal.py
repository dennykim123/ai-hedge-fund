from sqlalchemy import String, Float, DateTime, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pm_id: Mapped[str] = mapped_column(String(50))
    symbol: Mapped[str] = mapped_column(String(20))
    signal_type: Mapped[str] = mapped_column(String(50))
    value: Mapped[float] = mapped_column(Float)
    metadata_: Mapped[dict] = mapped_column(JSON, default=dict, name="metadata")
    created_at = mapped_column(DateTime, server_default=func.now())
