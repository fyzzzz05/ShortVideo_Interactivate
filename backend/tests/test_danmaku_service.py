from app.schemas.danmaku import DanmakuResponse
from app.services.danmaku_service import DanmakuService


def test_danmaku_service_symbol_exists():
    assert DanmakuService is not None
    assert DanmakuResponse is not None
