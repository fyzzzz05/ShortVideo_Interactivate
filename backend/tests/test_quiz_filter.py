from app.services.quiz_service import QuizService


def test_quiz_submit_returns_role():
    result = QuizService.submit(episode_id=1, answers=[1, 2])
    assert result.role_name
