# ShortVideo-Platform

短剧互动平台 — 整合**高光识别**（AI 模型）、**后端服务**（FastAPI）和**移动端**（React Native）的统一 monorepo。

## 📁 项目结构

```
ShortVideo-Platform/
├── backend/          ← FastAPI 后端 + 豆包高光识别模块
├── mobile/           ← React Native 移动端（短剧互动播放器）
├── shared/           ← 跨端共享数据契约（JSON Schema）
├── docs/             ← 统一文档（接口文档、架构说明）
└── .env.example      ← 统一环境变量模板
```

## 🔗 数据流

```
短视频字幕/弹幕
      │
      ▼
┌─────────────────────────┐
│  backend: 高光识别模块    │  ← 调用豆包(Doubao)模型
│  integrations/doubao     │
└───────────┬─────────────┘
            │ highlights (统一 Schema)
            ▼
┌─────────────────────────┐
│  backend: FastAPI 服务   │  ← REST API 下发事件
│  /api/v1/episodes/{id}/  │
│  events?mode=offline     │
└───────────┬─────────────┘
            │ JSON (HTTP)
            ▼
┌─────────────────────────┐
│  mobile: React Native    │  ← 视频播放 + 高光互动
│  VideoPlayer.tsx         │     (暂停/脸部高亮/连击)
└─────────────────────────┘
```

## 🚀 快速启动

### 1. 环境准备

```bash
# 激活 conda 环境
conda activate shortvideo

# 安装 Python 依赖
cd backend
pip install -r requirements.txt
```

### 2. 配置模型 API Key

```powershell
Copy-Item .env.example .env
# 编辑 .env，填入实际的 ARK_API_KEY 和 ARK_MODEL
```

### 3. 启动后端

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问：
- Swagger 文档：`http://127.0.0.1:8000/docs`
- 健康检查：`http://127.0.0.1:8000/health`

### 4. 初始化演示数据（可选）

```bash
cd backend
python scripts/seed_demo_data.py
```

### 5. 识别高光点（模型调用）

```bash
# CLI 方式：批量识别
cd backend
python scripts/detect_highlights.py \
  --input data/subtitles/sample.json \
  --output data/highlights/sample_highlights.json \
  --drama-title "示例短剧"

# 导入到数据库
python scripts/import_offline_events.py \
  --input data/highlights/sample_highlights.json \
  --source-format highlights \
  --episode-id 1 --replace-episode
```

### 6. 移动端启动

```bash
cd mobile
npm install
npx expo start
```

## 📋 模块说明

| 原模块 | 合并后位置 | 说明 |
|--------|-----------|------|
| `shibie` | `backend/app/integrations/doubao_client.py` | 豆包模型调用核心 |
| `shibie/src/*.py` | `backend/scripts/` | CLI 管理脚本 |
| `ShortVideo` | `backend/app/` | FastAPI 后端主代码 |
| `short-vedio-interaction-main` | `mobile/` | React Native 移动端 |

## 📖 文档

- Android 接口文档：`docs/api_android.md`
- 模型接口文档：`docs/api_model.md`
- 高光数据契约：`shared/highlight-contract.json`
- 架构说明：`docs/architecture.md`

## 🔧 技术栈

| 层 | 技术 |
|----|------|
| 后端框架 | FastAPI + SQLAlchemy + SQLite |
| AI 模型 | 豆包(Doubao) via Ark API |
| 异步任务 | Celery + Redis（可选） |
| 移动端 | React Native + Expo + TypeScript |
| 容器化 | Docker Compose |
