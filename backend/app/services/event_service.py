import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models.event import Event
from app.schemas.event import EventPayload


class EventService:
    @staticmethod
    def _load_demo_events() -> list[dict]:
        path = Path(__file__).resolve().parents[2] / "data" / "demos" / "events_offline.json"
        if not path.exists() or path.stat().st_size == 0:
            return []
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def seed_if_empty(db: Session) -> None:
        count = db.query(Event).count()
        if count > 0:
            return
        for row in EventService._load_demo_events():
            db.add(Event(**row))
        db.commit()

    @staticmethod
    def get_offline_events(db: Session, episode_id: int) -> list[EventPayload]:
        rows = db.query(Event).filter(Event.episode_id == episode_id).all()
        return [
            EventPayload(
                start_ms=r.start_ms,
                end_ms=r.end_ms,
                type=r.type,
                title=r.title,
                confidence=r.confidence,
                source=r.source,
                dedup_key=r.dedup_key,
                event_type=r.event_type,
                scene_tag=r.scene_tag,
                payload=json.loads(r.payload or "{}"),
            )
            for r in rows
        ]

    @staticmethod
    def merge_with_dedup(offline_events: list[EventPayload], realtime_events: list[EventPayload]) -> list[EventPayload]:
        merged: dict[str, EventPayload] = {}
        for event in offline_events + realtime_events:
            key = f"{event.dedup_key}:{event.event_type}"
            merged[key] = event
        return list(merged.values())
