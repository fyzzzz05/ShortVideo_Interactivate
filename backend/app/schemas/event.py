from pydantic import BaseModel


class EventPayload(BaseModel):
    start_ms: int
    end_ms: int
    type: str
    title: str
    confidence: float
    source: str
    dedup_key: str
    event_type: str
    scene_tag: str
    payload: dict


class EventsResponse(BaseModel):
    episode_id: int
    mode: str
    degraded: bool = False
    events: list[EventPayload]


class RealtimeDetectRequest(BaseModel):
    episode_id: int
    start_ms: int | None = None
    end_ms: int | None = None
    scene_hint: str | None = None


class RealtimeDetectResponse(BaseModel):
    events: list[EventPayload]
