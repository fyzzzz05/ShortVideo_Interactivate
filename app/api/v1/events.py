from fastapi import APIRouter

router = APIRouter()


@router.get("/episodes/{episode_id}/events")
async def get_episode_event(episode_id: int, mode: str = "offline"):
    return {"episode_id": episode_id, "mode": mode, "events": []}
