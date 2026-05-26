from fastapi import APIRouter

from app.schemas.shop import ShopSearchRequest, ShopSearchResponse
from app.services.shop_service import ShopService

router = APIRouter()


@router.post("/shop/search-link", response_model=ShopSearchResponse)
async def search_link(req: ShopSearchRequest) -> ShopSearchResponse:
    return ShopService.build_search(req.tags)
