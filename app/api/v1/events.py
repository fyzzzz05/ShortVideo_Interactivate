from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.event import EventsResponse, RealtimeDetectRequest, RealtimeDetectResponse
from app.services.event_service import EventService
from app.services.realtime_detect_service import RealtimeDetectService

router = APIRouter()


@router.get("/episodes/{episode_id}/events", response_model=EventsResponse)
async def get_episode_events(episode_id: int, mode: str = "offline", db: Session = Depends(get_db)) -> EventsResponse:
    EventService.seed_if_empty(db)
    offline_events = EventService.get_offline_events(db, episode_id)

    degraded = False
    if mode == "hybrid":
        try:
            realtime = RealtimeDetectService.detect(
                RealtimeDetectRequest(episode_id=episode_id, scene_hint="sweet")
            )
            merged = EventService.merge_with_dedup(offline_events, realtime)
            return EventsResponse(episode_id=episode_id, mode=mode, degraded=False, events=merged)
        except Exception:
            degraded = True

    return EventsResponse(episode_id=episode_id, mode=mode, degraded=degraded, events=offline_events)


@router.post("/events/realtime-detect", response_model=RealtimeDetectResponse)
async def realtime_detect(req: RealtimeDetectRequest) -> RealtimeDetectResponse:
    return RealtimeDetectResponse(events=RealtimeDetectService.detect(req))
