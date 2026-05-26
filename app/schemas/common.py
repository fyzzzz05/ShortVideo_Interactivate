from pydantic import BaseModel


class APIMessage(BaseModel):
    ok: bool = True
    message: str = "success"
