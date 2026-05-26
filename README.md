# ShortVideo Backend (V1)

短剧互动项目后端第一版，目标是支持 Android 联调与比赛演示。

## 1. 当前能力

- 健康检查：`GET /health`
- 剧集列表：`GET /api/v1/dramas`
- 事件流下发：`GET /api/v1/episodes/{episode_id}/events?mode=offline|hybrid`
- 实时检测补充：`POST /api/v1/events/realtime-detect`
- 互动回传：
  - `POST /api/v1/interactions/click`
  - `POST /api/v1/interactions/like`
  - `GET /api/v1/interactions/summary?episode_id=1`
- 同款搜索：`POST /api/v1/shop/search-link`
- 剧末人格测试：
  - `GET /api/v1/quiz/{episode_id}/profile`
  - `POST /api/v1/quiz/submit`

## 2. 项目结构（后端）

- `app/`：主代码（API、服务、数据模型）
- `data/demos/`：演示数据
- `scripts/`：导入和烟雾测试脚本
- `docs/`：给 Android / 模型同学的接口文档
- `docker/`：容器化运行配置

## 3. 本地启动

### 3.1 环境准备

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 3.2 启动服务

```bash
python -m uvicorn app.main:app --reload
```

启动后访问：
- Swagger: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

### 3.3 初始化演示数据（可选）

```bash
python scripts/seed_demo_data.py
```

## 4. Docker 启动

```bash
docker compose -f docker/docker-compose.yml up --build
```

## 5. 联调顺序（建议）

1. Android 先调 `GET /api/v1/dramas`
2. 再调 `GET /api/v1/episodes/{episode_id}/events?mode=offline`
3. 接入互动回传（click/like）和 summary
4. 最后接入 `mode=hybrid` 与实时检测接口

## 6. 关键约定

- 事件去重键：`dedup_key + event_type`
- `hybrid` 模式下实时失败时，后端自动回退离线并返回 `degraded=true`
- 第一版优先“可联调、可演示”，后续再增强模型真实接入与鉴权

## 7. 文档入口

- Android 接口文档：`docs/api_android.md`
- 模型接口文档：`docs/api_model.md`

## 8. 当前状态

- 主链路已可运行
- 基础测试已通过（`pytest -q`）
- 适合进入三人并行开发与联调阶段
