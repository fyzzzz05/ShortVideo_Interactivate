"""实时检测服务 — 调用 Doubao 模型进行高光识别（hybrid 模式）。"""

from app.integrations.doubao_client import DoubaoClient
from app.schemas.event import EventPayload, RealtimeDetectRequest


class RealtimeDetectService:
    """实时检测服务。hybrid 模式下由 events API 调用。"""

    @staticmethod
    def detect(req: RealtimeDetectRequest) -> list[EventPayload]:
        try:
            client = DoubaoClient()
            result = client.detect_single_segment(
                text=req.scene_hint or "精彩片段",
                start_ms=req.start_ms or 0,
                end_ms=req.end_ms or 15000,
                episode_id=str(req.episode_id),
                min_confidence=0.55,
            )

            if result is None:
                return []

            return [
                EventPayload(
                    start_ms=result["start_ms"],
                    end_ms=result["end_ms"],
                    type="highlight",
                    title=result["title"],
                    confidence=result["confidence"],
                    source="realtime",
                    dedup_key=result["id"],
                    event_type=result["type"],
                    scene_tag=result["type"],
                    payload={
                        "reason": result["reason"],
                        "buttons": result["interaction"]["buttons"],
                        "effect": result["interaction"]["effect"],
                        "provider": "doubao",
                    },
                )
            ]
        except Exception:
            # hybrid 模式下实时检测失败时，上层 events API 自动
            # fallback 到离线事件并返回 degraded=true
            raise
