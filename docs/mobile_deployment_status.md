# Android / iOS 部署现状说明

## 当前结论

当前仓库已经具备 Expo / React Native 移动端原型，可以用于 Android/iOS 的开发预览和功能演示，但还没有完成正式 Android APK/AAB 或 iOS IPA/TestFlight 的生产发布配置。

换句话说：

- Web 端 + 服务端：已经适合作为当前最终演示主链路。
- Android/iOS 端：已有可继续打包的 Expo 项目基础，但正式部署还需要补齐 EAS、图标资源、签名和真机环境配置。

## 已完成部分

`mobile/app.json` 已配置：

- 应用名称：`短剧互动`
- Expo slug：`short-vedio-interaction`
- 竖屏方向：`portrait`
- iOS bundle identifier：`com.shortvedio.interaction`
- Android package：`com.shortvedio.interaction`

移动端代码中已包含：

- 短剧播放器主界面
- 高光互动浮层
- 打脸 / 连击 / 反馈组件
- 本地剧集和高光数据
- 后端 API 客户端雏形

## 尚未完成部分

正式 Android/iOS 部署前还需要补：

1. Expo 图标资源  
   `app.json` 当前引用了 `assets/icon.png`、`assets/splash.png`、`assets/adaptive-icon.png`，但仓库中尚未提供这些图片。

2. EAS 构建配置  
   当前没有 `mobile/eas.json`，还没有区分 development / preview / production 构建 profile。

3. 签名和账号配置  
   Android 需要 keystore 或使用 EAS 托管签名；iOS 需要 Apple Developer 账号、证书和 provisioning profile。

4. 真实后端地址  
   `mobile/src/services/api.ts` 中开发环境地址仍是局域网占位 IP，正式包需要替换为可访问的服务端地址。

5. 真机兼容验证  
   需要分别在 Android 真机和 iOS 真机上验证视频播放、触摸互动、性能、网络请求和安全区适配。

## 推荐后续步骤

如果最终按移动端交付，建议按以下顺序补齐：

```powershell
cd mobile
npm install
npx expo install
npx eas init
npx eas build:configure
```

然后新增 `eas.json`：

```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

Android 内测包：

```powershell
npx eas build --platform android --profile preview
```

iOS TestFlight / 生产包：

```powershell
npx eas build --platform ios --profile production
```

## 当前建议

本项目马上结尾时，建议验收口径写为“单人 Web 端 + 服务端交付，附 Expo 移动端原型”。这样和当前完成度最匹配，也能避免 Android/iOS 正式签名、证书和商店发布流程带来的额外风险。
