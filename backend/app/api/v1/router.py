from fastapi import APIRouter

from app.api.v1.dramas import router as dramas_router
from app.api.v1.events import router as events_router
from app.api.v1.highlights import router as highlights_router
from app.api.v1.interactions import router as interactions_router
from app.api.v1.quiz import router as quiz_router
from app.api.v1.shop import router as shop_router

api_router = APIRouter()
api_router.include_router(dramas_router, tags=["dramas"])
api_router.include_router(events_router, tags=["events"])
api_router.include_router(highlights_router, tags=["highlights"])
api_router.include_router(interactions_router, tags=["interactions"])
api_router.include_router(shop_router, tags=["shop"])
api_router.include_router(quiz_router, tags=["quiz"])
