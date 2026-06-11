# Android WebView APK 部署说明

## 当前结论

当前项目已将主交付口径调整为 `web/` 端统一界面，并通过 Capacitor 封装为 Android WebView APK。APK 使用 `web/dist` 作为内置 Web 资源目录，短剧视频从 `web/public/nvpin/` 构建进包内，适合离线演示。

Expo / React Native 工程仍保留在 `mobile/` 中，作为历史原型和组件参考，不再作为结赛 APK 的主构建入口。

推荐验收口径：

- 主交付：Capacitor Android WebView APK + FastAPI 服务端。
- 辅助展示：同一套 `web/` 代码可通过浏览器运行和录屏。

## 已完成部分

`web/capacitor.config.ts` 已配置：

- 应用名称：`短剧互动`
- Android package / appId：`com.shortvedio.interaction`
- Web 资源目录：`dist`
- Android 背景色：`#000000`

`web/package.json` 已配置：

- `android:add`：生成 Capacitor Android 工程
- `android:sync`：构建 Web 并同步到 Android 工程
- `android:open`：打开 Android Studio
- `android:apk`：同步 Web 产物并打包 debug APK

WebView APK 中包含：

- 竖屏短剧播放器主界面
- 内置 mp4 短剧视频资源
- 弹幕输入与滚动展示
- 第 5 集打脸互动
- Canvas 粒子、震屏、Combo、K.O. 反馈
- 高光进度点与播放进度控制

## 构建环境要求

- Node.js 18+
- npm
- JDK 17+
- Android SDK / Android Studio
- Windows 下建议使用 Android Studio 自带 Gradle 和 SDK 管理器

当前若命令行无法识别 `java`、`gradle`、`ANDROID_HOME` 或 `ANDROID_SDK_ROOT`，说明本机还没有配置完整 Android 构建环境。此时仍可完成 Web 构建和 Capacitor 工程生成，但无法在命令行直接产出 APK。

## 构建步骤

安装依赖：

```powershell
cd web
npm install
```

生成 Web 静态资源：

```powershell
cd web
npm run build
```

首次生成 Android 工程：

```powershell
cd web
npm run android:add
```

同步 Web 产物：

```powershell
cd web
npm run android:sync
```

打包 debug APK：

```powershell
cd web
npm run android:apk
```

APK 输出路径：

```text
web/android/app/build/outputs/apk/debug/app-debug.apk
```

也可以使用 Android Studio 打开 `web/android/`，等待 Gradle 同步完成后执行 `Build APK(s)`。

## 验收建议

1. 安装 APK 到 Android 真机或模拟器。
2. 打开应用后确认直接进入竖屏短剧播放器。
3. 验证第 5 集可离线播放，不依赖公网视频地址。
4. 验证播放/暂停、上下滑切集、点赞、弹幕输入、进度条跳转。
5. 进入打脸互动后点击脸部区域，确认拳头、粒子、震屏、Combo 效果正常。
6. 配合后端 Swagger 和 `demo/` 录屏完成结赛提交。

## 正式发布前仍需配置

1. Release 签名
   当前建议先使用 debug APK 结赛演示；正式发布需要补充 keystore、签名配置和版本号策略。

2. 真机兼容验证
   需要在目标 Android 机型上验证视频解码、触摸事件、WebView 性能和安全区适配。

3. 后端联调地址
   当前 APK 演示主链路可以离线播放；如果后续接入实时接口，需要配置可访问的服务端地址。
