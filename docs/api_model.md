# 模型同学接口契约文档

## 1. 实时检测接口
- `POST /api/v1/events/realtime-detect`

请求体：
```json
{
  "episode_id": 1,
  "start_ms": 12000,
  "end_ms": 22000,
  "scene_hint": "sweet"
}
```

响应体：
```json
{
  "events": [
    {
      "start_ms": 12000,
      "end_ms": 22000,
      "type": "highlight",
      "title": "实时检测补充高光",
      "confidence": 0.76,
      "source": "realtime",
      "dedup_key": "rt-1-12000",
      "event_type": "effect",
      "scene_tag": "sweet",
      "payload": {"hint": "fallback-ready"}
    }
  ]
}
```

## 2. 字段契约
- 必填：`start_ms/end_ms/type/title/confidence/source/dedup_key/event_type/scene_tag/payload`
- `source` 固定：`realtime`
- `dedup_key` 必须可稳定复用（用于合并去重）

## 3. 失败与回退
- 实时检测失败时，后端 `/events?mode=hybrid` 自动回退离线结果
- 失败不影响主链路返回，`degraded=true`

## 4. 映射建议
- `scene_tag=driving -> mini_game`
- `scene_tag=revenge -> mini_game`
- `scene_tag=sweet -> effect`
- 推荐阈值：`confidence >= 0.65`
