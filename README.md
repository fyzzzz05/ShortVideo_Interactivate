# ShortVideo-Platform

短剧互动平台 monorepo。当前仓库包含三条主线：

- `backend/`：FastAPI 后端，负责剧集、事件流、高光识别、互动上报、测验和同款搜索等接口。
- `mobile/`：Expo / React Native 移动端主交付，提供全屏短剧播放器、互动高光、打脸/连击等移动端体验。
- `web/`：Vite / React Web 辅助演示，复刻竖屏短剧播放体验，并集成弹幕、进度点、打脸互动和粒子效果。

项目当前处于本地演示与联调阶段，默认使用 SQLite，本地视频和演示数据已放在仓库内。

## 目录结构

```text
ShortVideo-Platform/
├── backend/                    # FastAPI 后端服务
│   ├── app/
│   │   ├── api/v1/             # API 路由：danmaku/dramas/events/highlights/interactions/shop/quiz
│   │   ├── core/               # 配置、常量、日志、安全相关
│   │   ├── db/                 # SQLAlchemy session、模型、repository
│   │   ├── integrations/       # 豆包 / Ark 模型客户端
│   │   ├── schemas/            # Pydantic 请求响应模型
│   │   ├── services/           # 业务服务
│   │   └── workers/            # Celery 任务骨架
│   ├── data/                   # 演示数据、弹幕、高光、字幕、训练样本
│   ├── scripts/                # 数据处理、导入、检测、冒烟测试脚本
│   ├── tests/                  # pytest 测试
│   └── requirements.txt
├── mobile/                     # Expo React Native 客户端
├── web/                        # Vite React Web 客户端
├── docs/                       # Android / 模型接口文档
├── shared/                     # 跨端共享契约
├── scripts/                    # 仓库级辅助脚本
├── demo/                       # 演示视频素材
└── start_backend.ps1           # Windows 后端启动脚本
```

## 功能现状

### 后端

- FastAPI 应用入口：`backend/app/main.py`
- API 前缀：`/api/v1`
- 健康检查：`GET /health`
- 默认数据库：`sqlite:///./shortvideo.db`
- 启动时自动创建 SQLAlchemy 表结构
- 支持弹幕查询、离线事件流、hybrid 事件流、互动统计、测验、同款搜索和豆包高光识别
- `workers/` 中已有 Celery 任务骨架，Redis/Celery 依赖已在 requirements 中，但当前主链路可不启动 worker

### 移动端

- Expo + React Native + TypeScript
- 全屏短剧播放器
- 本地剧集数据与高光点数据
- 互动浮层、倒计时、连击、脸部高亮、肿胀特效
- `usePunchModule` / `PunchGame` / `PunchHUD` 提供打脸互动模块

### Web 端

- Vite + React + TypeScript + Tailwind
- 竖屏短剧播放器原型
- 本地视频播放、上下滑切集、点赞/评论/收藏/分享 UI
- 弹幕输入与滚动展示
- 第 5 集触发打脸互动，使用 `web/src/data/punch_bbox.json` 做脸部命中检测
- Canvas 粒子、震屏、HP、Combo、K.O. 效果

## 环境要求

- Python 3.10+
- Node.js 18+
- npm
- 可选：conda 环境 `shortvideo`
- 可选：豆包 / 火山 Ark 模型 API Key

## 后端启动

### 方式一：使用仓库脚本

`start_backend.ps1` 当前写死使用：

```powershell
D:\Code\miniconda\envs\shortvideo\python.exe
```

如果本机环境一致，可直接在仓库根目录运行：

```powershell
.\start_backend.ps1
```

### 方式二：手动启动

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动后访问：

- Swagger：`http://127.0.0.1:8000/docs`
- ReDoc：`http://127.0.0.1:8000/redoc`
- 健康检查：`http://127.0.0.1:8000/health`

## 后端配置

后端会读取 `backend/.env`。当前配置项包括：

```env
APP_NAME=ShortVideo Backend
APP_VERSION=0.1.0
APP_ENV=dev
API_V1_PREFIX=/api/v1
DATABASE_URL=sqlite:///./shortvideo.db
REALTIME_TIMEOUT_SECONDS=1.5

# 使用豆包 / Ark 高光识别时必填
ARK_API_KEY=your_api_key
ARK_MODEL=your_model
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

不调用 `/api/v1/highlights/detect` 或相关 CLI 检测脚本时，可以不配置 `ARK_API_KEY` 和 `ARK_MODEL`。

## 数据库初始化

后端启动时会自动创建表结构，但不会自动把 CSV/JSON 全量写入数据库。当前建议在 `backend/` 目录下执行导入命令，因为默认 `DATABASE_URL=sqlite:///./shortvideo.db` 是相对路径。

导入原始弹幕 CSV：

```powershell
cd backend
python scripts/import_danmaku.py --replace
```

导入弹幕分析得到的高光事件：

```powershell
cd backend
python scripts/import_offline_events.py `
  --input data/highlights/danmaku_highlights_final.json `
  --source-format highlights `
  --replace-episode
```

也可以只导入最小 demo 事件：

```powershell
cd backend
python scripts/seed_demo_data.py
```

当前本地库 `backend/shortvideo.db` 已导入：

- `danmaku`：25,130 条原始弹幕
- `events`：80 条由弹幕高光 JSON 转换出的互动事件

数据源主要位于：

- `backend/data/danmu.csv`
- `backend/data/danmaku/danmaku_features.json`
- `backend/data/demos/events_offline.json`
- `backend/data/demos/dramas.json`
- `backend/data/highlights/*.json`
- `backend/data/subtitles/sample_subtitles.json`
- `backend/data/segments/sample_segments.json`

## API 清单

基础地址：`http://127.0.0.1:8000`

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/health` | 健康检查 |
| `GET` | `/api/v1/dramas` | 获取短剧列表 |
| `GET` | `/api/v1/episodes/{episode_id}/danmaku?start_ms=0&end_ms=60000&limit=200` | 按集数和时间范围查询弹幕 |
| `GET` | `/api/v1/episodes/{episode_id}/events?mode=offline` | 获取离线事件流 |
| `GET` | `/api/v1/episodes/{episode_id}/events?mode=hybrid` | 离线 + 实时检测合并，失败时降级 |
| `POST` | `/api/v1/events/realtime-detect` | 实时高光检测占位/联调接口 |
| `POST` | `/api/v1/highlights/detect` | 调用豆包模型批量识别高光，可选导入 events |
| `POST` | `/api/v1/interactions/click` | 点击互动上报 |
| `POST` | `/api/v1/interactions/like` | 点赞互动上报 |
| `GET` | `/api/v1/interactions/summary?episode_id=1` | 互动数据汇总 |
| `POST` | `/api/v1/shop/search-link` | 根据标签生成同款搜索链接 |
| `GET` | `/api/v1/quiz/{episode_id}/profile` | 获取剧末人格测试 |
| `POST` | `/api/v1/quiz/submit` | 提交测验答案 |

更详细的联调约定见：

- `docs/api_android.md`
- `docs/api_model.md`
- `docs/technical_report.md`
- `docs/mobile_deployment_status.md`

## 最终交付说明

当前按“移动端 + 服务端”作为项目主交付链路：

- 移动端负责最终展示：竖屏短剧播放、高光点、打脸互动、Combo/K.O. 反馈和沉浸式操作。
- 服务端负责接口和数据：剧集、弹幕、高光事件、互动上报、互动汇总、测验和同款搜索。
- Web 端作为辅助演示入口，便于浏览器录屏和快速联调。
- Expo 移动端已配置 Android package、iOS bundle identifier、图标/启动页资源和 EAS 构建配置；正式发布仍需账号、签名和真实后端地址。

项目展示录屏位于 `demo/`，飞书技术文档可直接参考 `docs/technical_report.md`。

## 高光识别脚本

批量识别字幕/片段高光：

```powershell
cd backend
python scripts/detect_highlights.py `
  --input data/segments/sample_segments.json `
  --output data/highlights/sample_highlights.json `
  --drama-title "示例短剧" `
  --episode-id ep_01 `
  --min-confidence 0.55
```

导入离线事件或高光事件：

```powershell
cd backend
python scripts/import_offline_events.py `
  --input data/highlights/sample_highlights.json `
  --source-format highlights `
  --episode-id 1 `
  --replace-episode
```

其他数据处理脚本位于 `backend/scripts/`，包括弹幕分析、字幕切分、弹幕训练集构建、导出高光等。

## 移动端启动

```powershell
cd mobile
npm install
npm run start
```

也可以直接启动指定平台：

```powershell
npm run android
npm run ios
npm run web
```

移动端本地数据入口：

- `mobile/src/data/episodes.ts`
- `mobile/src/data/highlights.ts`
- `mobile/src/data/episode5-highlights.json`
- `mobile/src/config/sceneMap.ts`

## Web 端启动

```powershell
cd web
npm install
npm run dev
```

默认 Vite 会输出本地访问地址。Web 端主要入口：

- `web/src/App.tsx`
- `web/src/components/PlayerScreen.tsx`
- `web/src/data/episodes.ts`
- `web/src/data/punch_bbox.json`
- `web/public/nvpin/*.mp4`

构建：

```powershell
cd web
npm run build
```

## 测试

后端使用 pytest：

```powershell
cd backend
pytest -q
```

当前测试覆盖事件合并、事件 API、互动汇总、hybrid fallback、测验过滤等基础行为。

## 数据流

```text
字幕 / 弹幕 CSV / 本地高光 JSON
        │
        ▼
backend scripts / DoubaoClient
        │
        ▼
SQLite: danmaku 原始弹幕 + events 高光事件
        │
        ▼
FastAPI: /api/v1/episodes/{episode_id}/danmaku
FastAPI: /api/v1/episodes/{episode_id}/events
        │
        ├── mobile: 互动播放器 / 高光浮层 / 打脸模块
        └── web: 竖屏播放器 / 弹幕 / 打脸互动 / 粒子效果
```

## 关键契约

- 高光共享契约：`shared/highlight-contract.json`
- Android 联调接口：`docs/api_android.md`
- 模型同学接口：`docs/api_model.md`

事件核心字段：

```json
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
  "payload": {}
}
```

弹幕核心字段：

```json
{
  "id": 1,
  "drama_title": "十八岁太奶奶驾到，重整家族荣耀第三部",
  "episode_title": "第2集",
  "episode_id": 2,
  "time_ms": 97657,
  "like_count": 0,
  "content": "啊啊啊！好会说！！！"
}
```

## 当前注意事项

- 仓库包含本地演示视频资源，体积会明显大于纯代码项目。
- `mobile/dist/` 是 Expo Web 构建产物，当前仍在仓库中。
- `demo/` 目前是未跟踪目录，包含演示录屏素材。
- `start_backend.ps1` 使用了本机固定 conda Python 路径，如换机器需要修改。
- `.env.example` 当前未提交，如需团队协作建议补一个模板文件。
- 默认 SQLite 路径是相对路径，导入和启动后端时建议都在 `backend/` 目录执行。
