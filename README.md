# 报告连载助手 | Report Serialization Pro

这是一个基于 AI 的生产级报告连载策划与撰写系统。它旨在通过自动化的工作流，将厚重的 PDF 行业报告转化视觉表现力强、适合社交媒体传播的系列连载内容。

A production-grade, AI-driven serialization system designed to transform dense PDF reports into visually compelling, multi-part serialized content optimized for social media and professional publishing.

---

## ✨ 核心特性 | Key Features

### 1. 多模型智能路由 (Multi-Model Router)
- **全生态支持**: 原生支持 Google Gemini (Pro/Flash)、Vertex AI、DeepSeek、Moonshot (Kimi)、通义千问 (Qwen)、智谱清言 (GLM) 等主流大模型。
- **动态配置**: 支持根据供应商自动切换配置，并可在 UI 界面直接管理不同模型的 API Key。
- **Wide Model Support**: Native integration with Gemini (Pro/Flash), Vertex AI, DeepSeek, Kimi, Qwen, and GLM-4.
- **Dynamic Routing**: Automatic supplier-specific configuration with in-app API key management.

### 2. 高级视觉资产管线 (Advanced Visual Pipeline)
- **工业琥珀 DNA (Industrial Amber)**: 预置高审美视觉风格，生成专业、结构化的 B2B 风格配图（头图与信息图）。
- **风格架构师 (Style Architect)**: 支持自定义视觉 DNA 名片，通过 Prompt 元素精确控制图像生成风格。
- **自动锚点对齐 (Snap-to-Slot)**: AI 生成的图像自动“吸附”到 Markdown 中的预设锚点，实现图文实时精准排版。
- **Design Excellence**: Preset "Industrial Amber" theme for B2B technical aesthetics.
- **Style Architect**: Granular control over visual identity via custom DNA cards and specialized prompt engineering.
- **Smart Alignment**: Generated assets automatically snap into Markdown anchors for precise layout control.

### 3. 企业级任务管理 (Enterprise Task Management)
- **秒级中断 (AbortController)**: 支持异步任务的实时取消（点击“停止”按钮立即释放 AI 算力）。
- **项目便携化 (Portable Projects)**: 支持导出包含所有状态、版本历史和视觉资产的加密 ZIP 包，实现跨设备零损迁移。
- **版本回溯**: 完整的历史快照管理，支持侧边栏一键对比与还原。
- **Task Control**: Native `AbortController` support for instant task cancellation and resource management.
- **Portability**: Export/Import portable ZIP bundles containing full project states, version history, and visual assets.
- **Version Control**: Side-by-side history comparison and one-click restoration.

---

## 🚀 快速开始 | Quick Start

### 1. 环境准备 (Prerequisites)
- **Node.js**: v18.0.0+
- **Bun** (可选，推荐用于后端脚本): [bun.sh](https://bun.sh/)

### 2. 安装 (Installation)
```bash
git clone <repo-url>
cd reportserialize-pro
npm install
```

### 3. 配置环境变量 (Configuration)
在项目根目录创建 `.env` 文件 (Create `.env` in root):
```env
# Google AI Studio
GEMINI_API_KEY=your_gemini_key

# Google Cloud Vertex AI (Optional)
VERTEX_PROJECT_ID=your_project_id
VERTEX_LOCATION=global
VERTEX_SA_KEY_PATH=path/to/service_account.json

# WeChat Publishing (Optional)
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret
```

### 4. 运行 (Running)
```bash
npm run dev
```
访问 `http://localhost:5173` 即可开始你的连载策划。

---

## 🛠️ 发布到微信 (Publish to WeChat)
1. 在「发布设置」中配置微信小程序的 AppID 和 AppSecret。
2. 系统会自动完成 **WebP -> JPEG** 格式转换，以符合微信封面图规范。
3. 点击「发布到草稿箱」，系统将自动上传所有本地图片并同步文章。

1. Configure WeChat Credentials in the "Publish Settings".
2. The system automatically handles format conversion (**WebP to JPEG**) for cover images.
3. One-click sync to WeChat Draft Box with automated asset uploading.

---

## 🎨 视觉风格推荐 (Visual Styles)
- **工业琥珀 (Industrial Amber)**: 温暖象牙白背景 + 复古琥珀线条 (Warm ivory + Amber lines).
- **深海蓝调 (Deep Sea)**: 科技感十足的深蓝渐变 (Professional deep blue gradients).
- **工程蓝图 (Blueprint)**: 传统工程图纸风格 (Classic technical blueprint aesthetic).

---
Driven by **Google AI Studio** & **Antigravity Architect**.