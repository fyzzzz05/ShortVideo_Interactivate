from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.interaction import InteractionRequest, InteractionSummaryResponse
from app.services.interaction_service import InteractionService

router = APIRouter()


@router.post("/interactions/click")
async def interaction_click(req: InteractionRequest, db: Session = Depends(get_db)) -> dict:
    InteractionService.create(db, req, "click")
    return {"ok": True}


@router.post("/interactions/like")
async def interaction_like(req: InteractionRequest, db: Session = Depends(get_db)) -> dict:
    InteractionService.create(db, req, "like")
    return {"ok": True}


@router.get("/interactions/summary", response_model=InteractionSummaryResponse)
async def interaction_summary(episode_id: int, db: Session = Depends(get_db)) -> InteractionSummaryResponse:
    return InteractionService.summary(db, episode_id)
