from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.danmaku import DanmakuResponse
from app.services.danmaku_service import DanmakuService

router = APIRouter()


@router.get("/episodes/{episode_id}/danmaku", response_model=DanmakuResponse)
async def get_episode_danmaku(
    episode_id: int,
    start_ms: int | None = None,
    end_ms: int | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> DanmakuResponse:
    return DanmakuService.list_episode_danmaku(
        db,
        episode_id=episode_id,
        start_ms=start_ms,
        end_ms=end_ms,
        limit=limit,
        offset=offset,
    )
