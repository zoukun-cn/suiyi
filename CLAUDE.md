# CLAUDE.md — Suiyi（随译）

> 浏览器翻译扩展，基于 Plasmo（Manifest V3），支持双语整页翻译 / 划词翻译 / 悬停翻译。
> 详细文档见 `doc/` 目录。

## 技术栈

- **框架**：Plasmo v0.91+（扩展框架，目录路由约定）
- **UI**：React 18.3 + TypeScript 5.5+（strict mode）
- **构建**：esbuild（Plasmo 内置）、pnpm
- **样式**：纯 CSS Variables（定义在 `src/styles/global.css`，零运行时，禁用 CSS-in-JS）
- **存储**：`@plasmohq/storage`（封装 `chrome.storage`）
- **外部 API**：Google Translate / DeepL / OpenAI / DeepSeek

## 常用命令

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发模式（热更新），产物在 build/chrome-mv3-dev/
pnpm build          # 生产构建，产物在 build/chrome-mv3-prod/
pnpm clean          # 清理构建产物
```

## 关键文件速查

| 文件 | 作用 |
|---|---|
| `src/background/index.ts` | Service Worker — 消息中枢、引擎注册、右键菜单 |
| `src/contents/page-translator.ts` | 整页双语翻译 content script |
| `src/contents/selection-handler.ts` | 划词翻译 content script |
| `src/contents/tooltip-renderer.ts` | 悬停翻译 content script |
| `src/services/translator.ts` | 策略模式 — 引擎接口 + 调度器 |
| `src/services/storage.ts` | 设置/历史/API Key 持久化 |
| `src/services/engines/*.ts` | Google / DeepL / OpenAI / DeepSeek 引擎实现 |
| `src/lib/text-parser.ts` | DOM 文本提取与段落分组 |
| `src/lib/messaging.ts` | chrome.runtime.sendMessage 类型化封装 |
| `src/sidepanel/App.tsx` | 侧边栏主 UI（翻译 / 历史 / 设置三个 Tab） |
| `src/options/App.tsx` | 选项页（复用 sidepanel 组件） |
| `src/types/index.ts` | 所有类型、枚举、常量、消息类型定义 |

## 架构要点

**通信模型**：Content Script → `chrome.runtime.sendMessage` → Background → 外部 API。Content script 绝不直接调用外部 API。

**翻译引擎**：策略模式，`BaseTranslationEngine` 抽象类 → 各引擎实现。LLM 引擎（OpenAI、DeepSeek）覆写 `batchTranslate()` 用 JSON 批量模式一次请求完成多条翻译。

**页面翻译流程**：`TRANSLATE_PAGE` 消息 → TextParserService 提取文本 → 每 1000 条分片 → `BATCH_TRANSLATE_TEXT` 批量翻译 → 注入 `<suiyi-translated>` 元素 → MutationObserver 监听动态内容。

**消息类型**（定义在 `src/types/index.ts`）：
- `TRANSLATE_TEXT` — 单条翻译（划词/悬停/侧边栏输入）
- `BATCH_TRANSLATE_TEXT` — 批量翻译（整页翻译用）
- `TRANSLATE_PAGE` / `PAGE_TRANSLATION_STATUS` — 页面翻译控制与状态同步
- `GET_SETTINGS` / `SAVE_SETTINGS` — 设置读写

## 编码约定

- 文件名 kebab-case，类/接口/组件 PascalCase，函数/变量 camelCase，常量/枚举 UPPER_SNAKE_CASE
- 无路径别名，导入用相对路径
- 类型定义集中在 `src/types/index.ts`，添加功能前先加类型
- 业务逻辑放 `src/services/`，纯工具放 `src/lib/`，React 组件放 `src/sidepanel/components/`
- 存储：设置 → `chrome.storage.sync`，历史和 API Key → `chrome.storage.local`
- Content script 操作 DOM 前检查 `document.readyState`；注入文本前做 HTML 转义
- 遵循 `translate="no"`、`aria-hidden="true"`、`display:none` 等跳过规则
- 不要手动创建 `manifest.json`（Plasmo 自动生成）；不要编辑 `.plasmo/` 和 `build/`
- Commit 风格：中文描述
- 默认引擎：deepseek

## 文档索引

| 文档 | 内容 |
|---|---|
| [doc/README.md](doc/README.md) | 项目概览、功能、引擎、技术栈 |
| [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md) | 架构图、设计模式、数据流、存储布局 |
| [doc/DEVELOPMENT.md](doc/DEVELOPMENT.md) | 环境搭建、目录结构、开发流程、调试方法 |
| [doc/MESSAGING.md](doc/MESSAGING.md) | 消息协议、类型定义、消息流图、错误处理 |
| [doc/CONVENTIONS.md](doc/CONVENTIONS.md) | 命名规范、React/DOM/CSS/Storage 编码规范 |
