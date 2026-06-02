"""高光点数据模型 — 与 shared/highlight-contract.json 对齐。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# ── 枚举 ──

HighlightType = Literal[
    "conflict", "reverse", "famous_scene", "sweet", "cool", "suspense", "funny"
]

EffectType = Literal["burst", "sparkle", "heart", "none"]
TriggerType = Literal["TAP", "SLAP", "SWIPE", "SHAKE"]
CharacterType = Literal["protagonist", "villain", "supporting"]
SourceType = Literal["offline", "realtime", "danmaku"]


# ── 子模型 ──

class FacePosition(BaseModel):
    """脸部相对坐标 (0-1)。"""
    x: float = Field(..., ge=0, le=1)
    y: float = Field(..., ge=0, le=1)
    width: float = Field(..., ge=0, le=1)
    height: float = Field(..., ge=0, le=1)


class CharacterInfo(BaseModel):
    """角色信息。"""
    type: CharacterType
    name: str = ""
    face_position: FacePosition


class InteractionConfig(BaseModel):
    """互动配置。"""
    buttons: list[str] = Field(default_factory=list, max_length=3)
    effect: EffectType = "burst"
    trigger: TriggerType = "TAP"
    hint: str = ""
    duration_sec: int = Field(default=3, ge=1, le=10)


# ── 主模型 ──

class HighlightSchema(BaseModel):
    """高光点统一 Schema — 跨层传输标准格式。"""
    id: str
    drama_id: str = ""
    episode_id: int | str
    segment_id: str = ""
    start_ms: int = Field(..., ge=0)
    end_ms: int = Field(..., ge=0)
    type: HighlightType
    confidence: float = Field(..., ge=0, le=1)
    title: str = ""
    reason: str = ""
    interaction: InteractionConfig = Field(default_factory=InteractionConfig)
    character: CharacterInfo | None = None
    source: SourceType = "offline"


class HighlightsResponse(BaseModel):
    """高光点列表响应。"""
    episode_id: int
    highlights: list[HighlightSchema]
    total: int
