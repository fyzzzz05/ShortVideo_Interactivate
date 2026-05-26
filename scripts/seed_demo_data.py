from pathlib import Path
import json

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.db.models.event import Event


def main() -> None:
    Base.metadata.create_all(bind=engine)
    data_path = Path(__file__).resolve().parents[1] / "data" / "demos" / "events_offline.json"
    rows = json.loads(data_path.read_text(encoding="utf-8"))

    db = SessionLocal()
    try:
        if db.query(Event).count() > 0:
            print("events already seeded")
            return
        for row in rows:
            db.add(Event(**row))
        db.commit()
        print(f"seeded events: {len(rows)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
