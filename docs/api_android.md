# Android 联调接口文档

## 基础信息
- Base URL: `http://127.0.0.1:8000`
- 前缀: `/api/v1`

## 1. 拉剧集
- `GET /api/v1/dramas`

## 2. 拉事件流
- `GET /api/v1/episodes/{episode_id}/events?mode=offline|hybrid`
- 核心字段：`source`、`dedup_key`、`event_type`、`payload`

示例响应：
```json
{
  "episode_id": 1,
  "mode": "hybrid",
  "degraded": false,
  "events": [
    {
      "start_ms": 12000,
      "end_ms": 18000,
      "type": "highlight",
      "title": "反转名场面",
      "confidence": 0.92,
      "source": "offline",
      "dedup_key": "ep1-12000-reverse",
      "event_type": "highlight",
      "scene_tag": "revenge",
      "payload": {"cta": "tap"}
    }
  ]
}
```

## 3. 互动上报
- `POST /api/v1/interactions/click`
- `POST /api/v1/interactions/like`

请求体：
```json
{
  "episode_id": 1,
  "highlight_dedup_key": "ep1-12000-reverse",
  "user_id": "u001"
}
```

## 4. 互动汇总
- `GET /api/v1/interactions/summary?episode_id=1`

## 5. 同款搜索
- `POST /api/v1/shop/search-link`

请求体：
```json
{"tags": ["白色风衣", "女主同款"]}
```

## 6. 剧末人格测试
- `GET /api/v1/quiz/{episode_id}/profile`
- `POST /api/v1/quiz/submit`
