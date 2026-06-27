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
| `src/lib/translation-tip-style.ts` | TranslationTipStyle 接口定义 |
| `src/lib/tip-style-manager.ts` | TipStyleManager — 管理提示样式生命周期 |
| `src/lib/tip-styles/skeleton-tip-style.ts` | 骨架屏占位提示样式 |
| `src/lib/tip-styles/progress-bar-tip-style.ts` | 底部进度条提示样式 |
| `src/sidepanel/App.tsx` | 侧边栏主 UI（翻译 / 历史 / 设置三个 Tab） |
| `src/options/App.tsx` | 选项页（复用 sidepanel 组件） |
| `src/types/index.ts` | 所有类型、枚举、常量、消息类型定义 |

## 架构要点

**通信模型**：Content Script → `chrome.runtime.sendMessage` → Background → 外部 API。Content script 绝不直接调用外部 API。

**翻译引擎**：策略模式，`BaseTranslationEngine` 抽象类 → 各引擎实现。LLM 引擎（OpenAI、DeepSeek）覆写 `batchTranslate()` 用 JSON 批量模式一次请求完成多条翻译。

**页面翻译流程**：`EXECUTE_PAGE_TRANSLATE` 消息 → TextParserService 提取文本 → TipStyleManager 启动提示样式（骨架屏/进度条）→ 每 40 条分片 → `BATCH_TRANSLATE_TEXT` 批量翻译（进度回调更新进度条，骨架屏逐批移除）→ TipStyleManager.showTranslatedTipStyle() → 注入 `<suiyi-translated>` 元素 → MutationObserver 监听动态内容。

**消息类型**（定义在 `src/types/index.ts`）：
- `TRANSLATE_TEXT` — 单条翻译（划词/悬停/侧边栏输入）
- `BATCH_TRANSLATE_TEXT` — 批量翻译（整页翻译用）
- `TRANSLATE_PAGE` / `EXECUTE_PAGE_TRANSLATE` / `RESTORE_PAGE` — 页面翻译控制
- `PAGE_TRANSLATION_STATUS` — 翻译状态同步（控制右键菜单显示）
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

## 文档维护

项目文档位于 `doc/` 目录，`CLAUDE.md` 位于根目录。**代码变更后必须同步更新对应文档：**

| 变更类型 | 需更新的文档 |
|---|---|
| 新增/修改翻译引擎 | `CLAUDE.md`（关键文件表）、`doc/ARCHITECTURE.md`（引擎章节）、`doc/DEVELOPMENT.md`（添加引擎流程） |
| 新增/修改消息类型 | `doc/MESSAGING.md`（消息类型章节）、`doc/ARCHITECTURE.md`（通信模型） |
| 新增 content script 或修改注入逻辑 | `CLAUDE.md`、`doc/ARCHITECTURE.md`（数据流） |
| 新增/修改 UI 组件 | `doc/DEVELOPMENT.md`（目录结构） |
| 修改存储 key 或数据结构 | `doc/ARCHITECTURE.md`（存储布局）、`doc/MESSAGING.md` |
| 新增 lib 工具函数 | `doc/DEVELOPMENT.md`（目录结构注释） |
| 修改命名/代码规范 | `doc/CONVENTIONS.md` |
| 新增依赖或修改构建配置 | `CLAUDE.md`（技术栈）、`doc/README.md`、`doc/DEVELOPMENT.md` |
| 项目定位/功能变更 | `doc/README.md`、`CLAUDE.md` |

**原则：** 每当 `src/` 下的代码发生变化，在提交前检查：文档描述是否与当前代码一致？不一致就更新。文档是写给人机共同消费的，过时的文档比没有文档更差。

## 文档索引

| 文档 | 内容 |
|---|---|
| [doc/README.md](doc/README.md) | 项目概览、功能、引擎、技术栈 |
| [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md) | 架构图、设计模式、数据流、存储布局 |
| [doc/DEVELOPMENT.md](doc/DEVELOPMENT.md) | 环境搭建、目录结构、开发流程、调试方法 |
| [doc/MESSAGING.md](doc/MESSAGING.md) | 消息协议、类型定义、消息流图、错误处理 |
| [doc/CONVENTIONS.md](doc/CONVENTIONS.md) | 命名规范、React/DOM/CSS/Storage 编码规范 |
