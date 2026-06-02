"""
豆包(Doubao)模型客户端 — 短剧高光识别。

将原 shibie 模块的核心逻辑封装为 Service 类，
可被 API 端点（实时/批量）和 CLI 脚本复用。

使用方式:
    from app.integrations.doubao_client import DoubaoClient

    client = DoubaoClient()
    highlights = client.detect_highlights(
        segments=[...], drama_id="drama_001",
        drama_title="逆袭", episode_id="ep_01",
    )
"""

import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# ── 高光类型枚举 ──
HIGHLIGHT_TYPES = [
    "conflict",      # 冲突争吵
    "reverse",       # 剧情反转
    "famous_scene",  # 名场面
    "sweet",         # 甜蜜撒糖
    "cool",          # 爽点打脸
    "suspense",      # 悬念
    "funny",         # 搞笑
]

SYSTEM_PROMPT = """你是短剧剧情高光识别模型。

你的任务是根据短剧字幕片段，识别是否存在适合触发即时互动的剧情高光点。

高光类型只能从下面选择：
- conflict：冲突争吵
- reverse：剧情反转
- famous_scene：名场面
- sweet：甜蜜撒糖
- cool：爽点打脸
- suspense：悬念
- funny：搞笑

请只输出 JSON，不要输出 Markdown，不要输出解释文字。
"""


def _get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def _extract_json(text: str) -> dict[str, Any]:
    """从模型返回中提取 JSON（兼容 Markdown 代码块包裹）。"""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.S)
        if not match:
            raise
        return json.loads(match.group(0))


class DoubaoClient:
    """豆包模型高光识别客户端。"""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
    ) -> None:
        self.api_key = api_key or _get_required_env("ARK_API_KEY")
        self.base_url = base_url or os.getenv(
            "ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"
        )
        self.model = model or _get_required_env("ARK_MODEL")
        self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)

    # ── 核心识别方法 ──

    def detect_highlights(
        self,
        segments: list[dict[str, Any]],
        drama_id: str = "drama_001",
        drama_title: str = "示例短剧",
        episode_id: str = "ep_01",
        min_confidence: float = 0.55,
    ) -> list[dict[str, Any]]:
        """逐片段调用模型，识别高光点并返回统一格式。"""
        highlights: list[dict[str, Any]] = []

        for segment in segments:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": self._build_user_prompt(
                            segment, drama_title, episode_id
                        ),
                    },
                ],
                temperature=0.2,
            )

            content = response.choices[0].message.content or "{}"
            raw = _extract_json(content)
            highlight = self._normalize(
                raw, segment, drama_id, episode_id, min_confidence
            )

            if highlight:
                highlights.append(highlight)
            # 调用方可自行记录日志

        return highlights

    def detect_single_segment(
        self,
        text: str,
        start_ms: int,
        end_ms: int,
        episode_id: str = "ep_01",
        drama_title: str = "",
        min_confidence: float = 0.55,
    ) -> dict[str, Any] | None:
        """实时检测单个片段（供 hybrid 模式使用）。"""
        segment = {
            "segment_id": f"realtime_{start_ms}_{end_ms}",
            "start": start_ms / 1000.0,
            "end": end_ms / 1000.0,
            "text": text,
        }
        response = self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": self._build_user_prompt(
                        segment, drama_title or "短剧", episode_id
                    ),
                },
            ],
            temperature=0.2,
        )
        content = response.choices[0].message.content or "{}"
        raw = _extract_json(content)
        return self._normalize(
            raw, segment, "drama_001", episode_id, min_confidence
        )

    # ── 内部方法 ──

    def _build_user_prompt(
        self, segment: dict[str, Any], drama_title: str, episode_id: str
    ) -> str:
        return f"""请判断下面短剧片段是否存在剧情高光。

剧名：{drama_title}
集数：{episode_id}
片段 ID：{segment["segment_id"]}
片段开始时间：{segment["start"]}
片段结束时间：{segment["end"]}
字幕内容：
{segment["text"]}

输出格式：
{{
  "is_highlight": true,
  "highlight_type": "cool",
  "confidence": 0.87,
  "start_time": {segment["start"]},
  "end_time": {segment["end"]},
  "title": "一句短标题",
  "reason": "为什么这是高光",
  "interaction_buttons": ["爽到了", "打脸成功", "继续看"],
  "effect": "burst"
}}

如果不是高光，请输出：
{{
  "is_highlight": false,
  "highlight_type": "none",
  "confidence": 0.0,
  "start_time": {segment["start"]},
  "end_time": {segment["end"]},
  "title": "",
  "reason": "不是高光的原因",
  "interaction_buttons": [],
  "effect": "none"
}}
"""

    @staticmethod
    def _normalize(
        raw: dict[str, Any],
        segment: dict[str, Any],
        drama_id: str,
        episode_id: str,
        min_confidence: float,
    ) -> dict[str, Any] | None:
        """将模型原始输出转为统一高光 Schema。"""
        is_highlight = bool(raw.get("is_highlight"))
        confidence = float(raw.get("confidence", 0))

        if not is_highlight or confidence < min_confidence:
            return None

        start_time = float(raw.get("start_time", segment["start"]))
        end_time = float(raw.get("end_time", segment["end"]))

        buttons = raw.get("interaction_buttons") or []
        if not isinstance(buttons, list):
            buttons = []

        return {
            "id": f'{drama_id}_{episode_id}_{segment["segment_id"]}',
            "drama_id": drama_id,
            "episode_id": episode_id,
            "segment_id": segment["segment_id"],
            "start_ms": int(start_time * 1000),
            "end_ms": int(end_time * 1000),
            "start_time": start_time,
            "end_time": end_time,
            "type": str(raw.get("highlight_type", "famous_scene")),
            "confidence": round(confidence, 3),
            "title": str(raw.get("title", "")),
            "reason": str(raw.get("reason", "")),
            "interaction": {
                "buttons": [str(b) for b in buttons[:3]],
                "effect": str(raw.get("effect", "burst")),
                "hint": "",
                "duration_sec": 3,
                "trigger": "TAP",
            },
            # 人物信息 — 当前模型未输出，预留字段供后续增强
            "character": None,
        }


# 模块级单例（可选）
_client: DoubaoClient | None = None


def get_doubao_client() -> DoubaoClient:
    """获取 DoubaoClient 单例。"""
    global _client
    if _client is None:
        _client = DoubaoClient()
    return _client
