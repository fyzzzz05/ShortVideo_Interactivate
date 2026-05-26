from sqlalchemy.orm import Session

from app.db.models.event import Event


def list_by_episode(db: Session, episode_id: int) -> list[Event]:
    return db.query(Event).filter(Event.episode_id == episode_id).all()
