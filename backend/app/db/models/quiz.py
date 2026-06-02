from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class QuizProfile(Base):
    __tablename__ = "quiz_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    episode_id: Mapped[int] = mapped_column(Integer, index=True)
    role_name: Mapped[str] = mapped_column(String(128))
    role_desc: Mapped[str] = mapped_column(String(255))
    negative_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    score_weight: Mapped[int] = mapped_column(Integer, default=1)
