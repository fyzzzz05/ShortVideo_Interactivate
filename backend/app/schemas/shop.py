from pydantic import BaseModel


class ShopSearchRequest(BaseModel):
    tags: list[str]


class ShopSearchResponse(BaseModel):
    keyword: str
    search_url: str
