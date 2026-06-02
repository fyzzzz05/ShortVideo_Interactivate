from sqlalchemy.orm import Session

from app.db.models.interaction import Interaction


def create_interaction(db: Session, item: Interaction) -> None:
    db.add(item)
    db.commit()
