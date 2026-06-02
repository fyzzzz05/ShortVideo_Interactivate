from urllib.parse import quote_plus

from app.schemas.shop import ShopSearchResponse


class ShopService:
    @staticmethod
    def build_search(tags: list[str]) -> ShopSearchResponse:
        keyword = " ".join(tags).strip() or "短剧 同款"
        return ShopSearchResponse(
            keyword=keyword,
            search_url=f"https://s.taobao.com/search?q={quote_plus(keyword)}",
        )
