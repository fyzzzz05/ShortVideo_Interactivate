from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Danmaku(Base):
    __tablename__ = "danmaku"
    __table_args__ = (
        UniqueConstraint(
            "drama_title",
            "episode_title",
            "time_ms",
            "content",
            name="uq_danmaku_source_row",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    drama_title: Mapped[str] = mapped_column(String(255), index=True)
    episode_title: Mapped[str] = mapped_column(String(64), index=True)
    episode_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    time_ms: Mapped[int] = mapped_column(Integer, index=True)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
