from fastapi import APIRouter

from app.schemas.drama import DramaItem

router = APIRouter()


@router.get("/dramas", response_model=list[DramaItem])
async def get_dramas() -> list[DramaItem]:
    return [
        DramaItem(id=1, title="北派寻宝笔记"),
        DramaItem(id=2, title="家里家外"),
    ]
