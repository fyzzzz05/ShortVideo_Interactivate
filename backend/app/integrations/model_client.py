from app.schemas.event import EventPayload, RealtimeDetectRequest


class ModelClient:
    def detect(self, req: RealtimeDetectRequest) -> list[EventPayload]:
        start = req.start_ms or 10000
        end = req.end_ms or 15000
        return [
            EventPayload(
                start_ms=start,
                end_ms=end,
                type="highlight",
                title="模型检测结果",
                confidence=0.7,
                source="realtime",
                dedup_key=f"model-{req.episode_id}-{start}",
                event_type="highlight",
                scene_tag=req.scene_hint or "general",
                payload={"provider": "mock"},
            )
        ]
