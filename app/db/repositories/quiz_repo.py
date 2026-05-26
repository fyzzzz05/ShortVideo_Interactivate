from sqlalchemy.orm import Session

from app.db.models.quiz import QuizProfile


def list_profiles(db: Session, episode_id: int) -> list[QuizProfile]:
    return db.query(QuizProfile).filter(QuizProfile.episode_id == episode_id).all()
