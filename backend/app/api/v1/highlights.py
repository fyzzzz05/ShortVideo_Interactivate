"""高光识别 API — 批量检测 + 导入数据库。"""

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.models.event import Event
from app.db.session import get_db
from app.integrations.doubao_client import DoubaoClient

router = APIRouter()


# ── 请求/响应模型 ──

class HighlightDetectRequest(BaseModel):
    segments: list[dict] = Field(..., description="字幕片段列表，每个包含 segment_id, start, end, text")
    drama_id: str = "drama_001"
    drama_title: str = "示例短剧"
    episode_id: int = 1
    min_confidence: float = Field(default=0.55, ge=0, le=1)
    auto_import: bool = Field(default=False, description="是否自动导入到 events 表")


class HighlightDetectResponse(BaseModel):
    episode_id: int
    detected: int
    imported: int
    highlights: list[dict]


# ── 端点 ──

@router.post("/highlights/detect", response_model=HighlightDetectResponse)
async def detect_highlights(
    req: HighlightDetectRequest,
    db: Session = Depends(get_db),
) -> HighlightDetectResponse:
    """离线批量高光识别（管理端/脚本触发）。

    调用 Doubao 模型逐片段识别高光点，
    返回结果并可选择自动写入 events 表。
    """
    try:
        client = DoubaoClient()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"模型客户端初始化失败: {e}")

    highlights = client.detect_highlights(
        segments=req.segments,
        drama_id=req.drama_id,
        drama_title=req.drama_title,
        episode_id=str(req.episode_id),
        min_confidence=req.min_confidence,
    )

    imported = 0
    if req.auto_import and highlights:
        # 清理同集旧事件
        db.query(Event).filter(
            Event.episode_id == req.episode_id,
            Event.source == "offline",
        ).delete(synchronize_session=False)

        for h in highlights:
            db.add(
                Event(
                    episode_id=req.episode_id,
                    start_ms=h["start_ms"],
                    end_ms=h["end_ms"],
                    type="highlight",
                    title=h["title"],
                    confidence=h["confidence"],
                    source="offline",
                    dedup_key=h["id"],
                    event_type=h["type"],
                    scene_tag=h["type"],
                    payload=json.dumps({
                        "reason": h["reason"],
                        "buttons": h["interaction"]["buttons"],
                        "effect": h["interaction"]["effect"],
                        "provider": "doubao",
                    }, ensure_ascii=False),
                )
            )
            imported += 1
        db.commit()

    return HighlightDetectResponse(
        episode_id=req.episode_id,
        detected=len(highlights),
        imported=imported,
        highlights=highlights,
    )
