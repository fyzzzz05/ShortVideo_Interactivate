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
| `punch-module` (web) | `mobile/src/hooks/usePunchModule.ts` | 打击系统核心（HP/连击/命中检测） |

## 🎮 打击系统（Punch Module）

从独立 web punch-module.js 迁移到 React Native，为「扇巴掌/复仇」类互动场景
提供完整的 HP 打击系统。

### 文件

| 文件 | 说明 |
|------|------|
| `mobile/src/hooks/usePunchModule.ts` | 核心 Hook — HP 管理、连击追踪、bbox 命中检测、KO 判定 |
| `mobile/src/components/PunchGame.tsx` | 互动组件 — 脸部打击区、MISS 反馈、粒子联动 |
| `mobile/src/components/PunchHUD.tsx` | HUD 组件 — HP 条、连击数、KO 闪屏 |

### 集成方式

REVENGE 场景自动路由到 PunchGame（在 `config/sceneMap.ts` 中配置）。
已有脸部位置数据（`facePosition` 0~1 归一化坐标）的 Highlight 即可使用。

### usePunchModule API

```ts
const pm = usePunchModule({
  maxHp: 100,              // HP 上限
  damage: 10,              // 每次伤害（可为动态函数）
  hitExpandPx: 12,         // 热区外扩
  comboResetMs: 2500,      // 连击重置时间
  onHit: (d) => {},        // 命中回调 { combo, damage, hp, bbox, accuracy }
  onKO: (d) => {},         // KO 回调 { totalHits, totalDamage }
  onMiss: (x, y) => {},    // 未命中回调
});

pm.loadBboxData([          // 加载 bbox 时间线
  { time: 3.2, bbox: { x: 0.32, y: 0.08, w: 0.15, h: 0.22 } },
]);
pm.punchAt(x, y, vw, vh, time);  // 手动触发打击（返回 PunchHitData | null）
pm.reset();                // 重置 HP/连击/KO
pm.setEnabled(false);      // 开关打击
pm.getState();             // { hp, maxHp, combo, isKO, totalHits, ... }
```

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
