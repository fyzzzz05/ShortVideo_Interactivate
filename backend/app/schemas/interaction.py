from pydantic import BaseModel


class InteractionRequest(BaseModel):
    episode_id: int
    highlight_dedup_key: str
    user_id: str = "anonymous"


class InteractionSummaryResponse(BaseModel):
    episode_id: int
    click_count: int
    like_count: int
