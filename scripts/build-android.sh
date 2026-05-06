#!/usr/bin/env bash
# 一键构建「忘了么」Android APK
#
# 前置要求（仅首次）：
#   1. 安装 Android Studio（自带 Android SDK + JDK 17）
#      https://developer.android.com/studio
#   2. 设置环境变量（macOS / Linux 加到 ~/.zshrc 或 ~/.bashrc）：
#        export ANDROID_HOME="$HOME/Library/Android/sdk"   # macOS
#        # export ANDROID_HOME="$HOME/Android/Sdk"         # Linux
#        export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
#   3. 在项目根目录执行一次：
#        bun add -d @capacitor/cli
#        bun add @capacitor/core @capacitor/android
#        bunx cap add android
#
# 之后每次打包，只需运行：
#   bash scripts/build-android.sh
#
# 产出：public/downloads/wangleme.apk
# 该文件会被官网首页下载卡片直接引用（href="/downloads/wangleme.apk"）。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> 1/4 准备 webDir 占位目录"
mkdir -p android-www
cat > android-www/index.html <<'HTML'
<!doctype html><meta http-equiv="refresh" content="0;url=https://wangleme.lovable.app">
HTML

echo "==> 2/4 同步 Capacitor 配置到 android/ 工程"
bunx cap sync android

echo "==> 3/4 调用 Gradle 构建 release APK（未签名）"
cd android
if [ ! -f ./gradlew ]; then
  echo "找不到 android/gradlew，请先运行 'bunx cap add android'"; exit 1
fi
./gradlew assembleRelease

APK_SRC="app/build/outputs/apk/release/app-release-unsigned.apk"
if [ ! -f "$APK_SRC" ]; then
  echo "构建失败：$APK_SRC 不存在"; exit 1
fi

echo "==> 4/4 拷贝到 public/downloads/wangleme.apk"
cd "$ROOT_DIR"
mkdir -p public/downloads
cp "android/$APK_SRC" public/downloads/wangleme.apk

SIZE=$(du -h public/downloads/wangleme.apk | cut -f1)
echo ""
echo "✅ 完成！APK 大小：$SIZE"
echo "   本地预览：public/downloads/wangleme.apk"
echo "   发布后下载链接：https://wangleme.lovable.app/downloads/wangleme.apk"
echo ""
echo "⚠️  这是 unsigned APK。Android 安装时会提示'未知来源'，"
echo "    属正常现象。如需上架应用商店，需用 jarsigner / apksigner 进行签名。"
