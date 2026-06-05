from sqlalchemy.orm import Session

from app.db.repositories.danmaku_repo import DanmakuRepository
from app.schemas.danmaku import DanmakuItem, DanmakuResponse


class DanmakuService:
    @staticmethod
    def list_episode_danmaku(
        db: Session,
        episode_id: int,
        start_ms: int | None = None,
        end_ms: int | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> DanmakuResponse:
        total, rows = DanmakuRepository.list_by_episode(
            db,
            episode_id=episode_id,
            start_ms=start_ms,
            end_ms=end_ms,
            limit=limit,
            offset=offset,
        )
        return DanmakuResponse(
            episode_id=episode_id,
            total=total,
            items=[
                DanmakuItem(
                    id=row.id,
                    drama_title=row.drama_title,
                    episode_title=row.episode_title,
                    episode_id=row.episode_id,
                    time_ms=row.time_ms,
                    like_count=row.like_count,
                    content=row.content,
                )
                for row in rows
            ],
        )
