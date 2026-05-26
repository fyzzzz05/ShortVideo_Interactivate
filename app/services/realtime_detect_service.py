from app.schemas.event import EventPayload, RealtimeDetectRequest


class RealtimeDetectService:
    @staticmethod
    def detect(req: RealtimeDetectRequest) -> list[EventPayload]:
        base_start = req.start_ms or 15000
        base_end = req.end_ms or 22000
        scene = req.scene_hint or "sweet"
        return [
            EventPayload(
                start_ms=base_start,
                end_ms=base_end,
                type="highlight",
                title="实时检测补充高光",
                confidence=0.76,
                source="realtime",
                dedup_key=f"rt-{req.episode_id}-{base_start}",
                event_type="effect" if scene == "sweet" else "mini_game",
                scene_tag=scene,
                payload={"hint": "fallback-ready"},
            )
        ]
