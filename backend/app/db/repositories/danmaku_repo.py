from sqlalchemy.orm import Session

from app.db.models.danmaku import Danmaku


class DanmakuRepository:
    @staticmethod
    def list_by_episode(
        db: Session,
        episode_id: int,
        start_ms: int | None = None,
        end_ms: int | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> tuple[int, list[Danmaku]]:
        query = db.query(Danmaku).filter(Danmaku.episode_id == episode_id)
        if start_ms is not None:
            query = query.filter(Danmaku.time_ms >= start_ms)
        if end_ms is not None:
            query = query.filter(Danmaku.time_ms <= end_ms)

        total = query.count()
        rows = (
            query.order_by(Danmaku.time_ms.asc(), Danmaku.id.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return total, rows
