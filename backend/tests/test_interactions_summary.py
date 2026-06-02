from app.services.interaction_service import InteractionService


def test_interaction_service_symbol_exists():
    assert InteractionService is not None
