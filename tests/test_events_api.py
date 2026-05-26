from app.services.event_service import EventService


def test_merge_with_dedup_keeps_unique():
    # basic smoke with empty arrays
    merged = EventService.merge_with_dedup([], [])
    assert merged == []
