# Android APK 构建指南

「忘了么」Android 客户端使用 [Capacitor](https://capacitorjs.com/) 打包：APK 内置一个 WebView，直接加载官网 `https://wangleme.lovable.app`。这样保证客户端和网页功能完全一致，且**网页更新即客户端更新**，用户无需重装。

## 一、首次准备（只做一次）

### 1. 安装 Android Studio
下载并安装：https://developer.android.com/studio
（自带 Android SDK 与 JDK 17）

### 2. 配置环境变量

macOS（写入 `~/.zshrc`）：
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```
Linux（写入 `~/.bashrc`）：
```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```
然后 `source ~/.zshrc`（或 `~/.bashrc`）。

### 3. 在项目根目录初始化 Capacitor

```bash
bun add -d @capacitor/cli
bun add @capacitor/core @capacitor/android
bunx cap add android
```

执行 `cap add android` 后会生成 `android/` 目录（已加入 `.gitignore` 推荐）。

## 二、日常打包（每次发版只需一条命令）

```bash
bash scripts/build-android.sh
```

完成后产物位于：
```
public/downloads/wangleme.apk
```

官网首页的下载卡片已经指向 `/downloads/wangleme.apk`，**下次发布网站时用户即可下载**。

## 三、注意事项

- 当前生成的是 **unsigned release APK**。Android 安装时会提示"未知来源应用"，属正常现象，用户在系统设置中允许即可。
- 如果未来需要上架应用商店（华为 / 小米 / 酷安），需要用 `apksigner` 用你的 keystore 签名。
- 想修改应用图标 / 启动图：编辑 `android/app/src/main/res/` 下对应资源后重新构建。
- 想改包名（`com.wangleme.app`）或应用名（`忘了么`）：编辑 `capacitor.config.ts` 后运行 `bunx cap sync android`。
