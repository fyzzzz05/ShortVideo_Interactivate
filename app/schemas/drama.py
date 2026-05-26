from pydantic import BaseModel


class DramaItem(BaseModel):
    id: int
    title: str
