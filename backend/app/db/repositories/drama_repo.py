from sqlalchemy.orm import Session

from app.db.models.drama import Drama


def list_dramas(db: Session) -> list[Drama]:
    return db.query(Drama).all()
