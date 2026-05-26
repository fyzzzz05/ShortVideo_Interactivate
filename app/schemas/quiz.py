from pydantic import BaseModel


class QuizQuestion(BaseModel):
    id: int
    text: str
    options: list[str]


class QuizProfileResponse(BaseModel):
    episode_id: int
    questions: list[QuizQuestion]


class QuizSubmitRequest(BaseModel):
    episode_id: int
    answers: list[int]


class QuizSubmitResponse(BaseModel):
    role_name: str
    role_desc: str
    filtered: bool
