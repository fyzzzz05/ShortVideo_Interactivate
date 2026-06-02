from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    episode_id: Mapped[int] = mapped_column(Integer, index=True)
    highlight_dedup_key: Mapped[str] = mapped_column(String(128), index=True)
    action: Mapped[str] = mapped_column(String(16), index=True)
    user_id: Mapped[str] = mapped_column(String(64), default="anonymous")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
