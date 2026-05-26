from app.integrations.model_client import ModelClient
from app.schemas.event import RealtimeDetectRequest


class RealtimeDetectTask:
    @staticmethod
    def run(req: RealtimeDetectRequest):
        return ModelClient().detect(req)
