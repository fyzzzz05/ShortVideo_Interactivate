from fastapi import APIRouter

from app.schemas.quiz import QuizProfileResponse, QuizSubmitRequest, QuizSubmitResponse
from app.services.quiz_service import QuizService

router = APIRouter()


@router.get("/quiz/{episode_id}/profile", response_model=QuizProfileResponse)
async def quiz_profile(episode_id: int) -> QuizProfileResponse:
    return QuizService.get_profile(episode_id)


@router.post("/quiz/submit", response_model=QuizSubmitResponse)
async def quiz_submit(req: QuizSubmitRequest) -> QuizSubmitResponse:
    return QuizService.submit(req.episode_id, req.answers)
