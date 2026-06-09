# Android / iOS 部署说明

## 当前结论

当前仓库已经具备 Expo / React Native 移动端交付工程，可以作为 Android/iOS 端主交付。项目已补齐 Expo 基础资源和 EAS 构建配置，可进入开发预览、Android 内测 APK 和 iOS 模拟器构建流程。

需要注意的是，正式发布到 Android 应用市场或 iOS TestFlight / App Store 仍然依赖账号、证书、签名和线上后端地址，这些属于发布环境配置，不是代码仓库本身能够完全替代的内容。

推荐验收口径：

- 主交付：Android/iOS 移动端 + FastAPI 服务端。
- 辅助展示：Web 端可用于浏览器演示和录屏补充。

## 已完成部分

`mobile/app.json` 已配置：

- 应用名称：`短剧互动`
- Expo slug：`short-vedio-interaction`
- 竖屏方向：`portrait`
- iOS bundle identifier：`com.shortvedio.interaction`
- Android package：`com.shortvedio.interaction`
- 图标资源：`assets/icon.png`
- 启动页资源：`assets/splash.png`
- Android adaptive icon：`assets/adaptive-icon.png`

`mobile/eas.json` 已配置：

- `development`：开发客户端 / Android APK / iOS simulator
- `preview`：内部测试包，Android 输出 APK
- `production`：生产构建，版本号自动递增

移动端代码中已包含：

- 短剧播放器主界面
- 高光互动浮层
- 打脸 / 连击 / 反馈组件
- 本地剧集和高光数据
- 后端 API 客户端雏形

## 正式发布前仍需配置

1. 签名和账号配置  
   Android 需要 keystore 或使用 EAS 托管签名；iOS 需要 Apple Developer 账号、证书和 provisioning profile。

2. 真实后端地址  
   `mobile/src/services/api.ts` 中开发环境地址仍是局域网占位 IP，正式包需要替换为可访问的服务端地址。

3. 真机兼容验证  
   需要分别在 Android 真机和 iOS 真机上验证视频播放、触摸互动、性能、网络请求和安全区适配。

## 构建步骤

安装依赖：

```powershell
cd mobile
npm install
```

本地预览：

```powershell
cd mobile
npm run start
```

Android 内测 APK：

```powershell
npx eas build --platform android --profile preview
```

iOS TestFlight / 生产包：

```powershell
npx eas build --platform ios --profile production
```

## 验收建议

课堂或项目验收建议使用以下方式：

1. 使用 Expo Go 或 development build 展示移动端播放器和互动效果。
2. 启动 FastAPI 后端，展示移动端接口契约和后端 Swagger。
3. 使用 `demo/` 录屏作为最终展示产物备份。
4. 如需正式安装包，优先构建 Android preview APK；iOS 需要 Apple Developer 账号支持。
