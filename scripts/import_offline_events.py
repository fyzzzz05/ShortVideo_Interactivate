from pathlib import Path
import json

from app.db.base import Base
from app.db.models.event import Event
from app.db.session import SessionLocal, engine


def main() -> None:
    Base.metadata.create_all(bind=engine)
    file_path = Path(__file__).resolve().parents[1] / "data" / "demos" / "events_offline.json"
    rows = json.loads(file_path.read_text(encoding="utf-8"))

    db = SessionLocal()
    try:
        for row in rows:
            db.add(Event(**row))
        db.commit()
        print(f"imported: {len(rows)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
