import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor 配置
 *
 * 因为「忘了么」是 TanStack Start SSR 应用（含登录、AI 对话等服务端逻辑），
 * 不能简单地打包成纯静态资源。所以这里采用 **远程模式**：
 * APK 内只是一个 WebView 外壳，直接加载已发布的官网。
 *
 * 优点：
 *  - 零后端改造，所有功能（登录、聊天、Supabase）原样可用
 *  - 网页更新即客户端更新，无需用户重装 APK
 *
 * 如果以后改为离线/原生混合模式，把 server 段去掉，
 * 改为 webDir: "dist" 并提供静态构建即可。
 */
const config: CapacitorConfig = {
  appId: "com.wangleme.app",
  appName: "忘了么",
  // webDir 必须存在但远程模式下不会被使用，构建脚本会创建占位目录
  webDir: "android-www",
  server: {
    url: "https://wangleme.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
