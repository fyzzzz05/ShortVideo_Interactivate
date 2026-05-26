from app.schemas.quiz import QuizProfileResponse, QuizQuestion, QuizSubmitResponse


class QuizService:
    @staticmethod
    def get_profile(episode_id: int) -> QuizProfileResponse:
        return QuizProfileResponse(
            episode_id=episode_id,
            questions=[
                QuizQuestion(id=1, text="遇到冲突你会？", options=["冷静分析", "立刻出手", "先观察"]),
                QuizQuestion(id=2, text="你更看重？", options=["责任", "自由", "感情"]),
            ],
        )

    @staticmethod
    def submit(episode_id: int, answers: list[int]) -> QuizSubmitResponse:
        total = sum(answers)
        if total % 2 == 0:
            return QuizSubmitResponse(role_name="可靠守护者", role_desc="稳重理性，关键时刻值得依靠。", filtered=False)
        return QuizSubmitResponse(role_name="热血行动派", role_desc="果断勇敢，敢为在意的人站出来。", filtered=False)
