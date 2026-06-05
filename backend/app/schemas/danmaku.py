from pydantic import BaseModel


class DanmakuItem(BaseModel):
    id: int
    drama_title: str
    episode_title: str
    episode_id: int | None
    time_ms: int
    like_count: int
    content: str


class DanmakuResponse(BaseModel):
    episode_id: int
    total: int
    items: list[DanmakuItem]
