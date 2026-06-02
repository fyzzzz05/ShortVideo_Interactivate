from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models.interaction import Interaction
from app.schemas.interaction import InteractionRequest, InteractionSummaryResponse


class InteractionService:
    @staticmethod
    def create(db: Session, req: InteractionRequest, action: str) -> None:
        db.add(
            Interaction(
                episode_id=req.episode_id,
                highlight_dedup_key=req.highlight_dedup_key,
                action=action,
                user_id=req.user_id,
            )
        )
        db.commit()

    @staticmethod
    def summary(db: Session, episode_id: int) -> InteractionSummaryResponse:
        click_count = db.query(func.count(Interaction.id)).filter(
            Interaction.episode_id == episode_id, Interaction.action == "click"
        ).scalar() or 0
        like_count = db.query(func.count(Interaction.id)).filter(
            Interaction.episode_id == episode_id, Interaction.action == "like"
        ).scalar() or 0
        return InteractionSummaryResponse(
            episode_id=episode_id,
            click_count=click_count,
            like_count=like_count,
        )
