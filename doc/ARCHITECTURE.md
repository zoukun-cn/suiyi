# 架构

## 整体结构

```
┌──────────────────────────────────────────────────────────────┐
│                      任意网页                                │
│                                                              │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ page-translator  │  │ selection-    │  │  tooltip-    │   │
│  │ (双语翻译)        │  │ handler      │  │  renderer    │   │
│  └────────┬─────────┘  └──────┬───────┘  └──────┬───────┘   │
│           │                   │                   │          │
└───────────┼───────────────────┼───────────────────┼──────────┘
            │                   │                   │
            │     chrome.runtime.sendMessage        │
            │                   │                   │
            ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────────┐
│                background/index.ts                           │
│                (Service Worker)                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              TranslatorService                       │   │
│  │  ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐   │   │
│  │  │  Google  │ │ DeepL  │ │ OpenAI │ │ DeepSeek │   │   │
│  │  └──────────┘ └────────┘ └────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              StorageService                          │   │
│  │  chrome.storage.sync  (设置项)                        │   │
│  │  chrome.storage.local  (历史记录、API Key)             │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
            │
            │  外部 HTTP 请求
            ▼
┌──────────────────────────────────────────────────────────────┐
│  translate.googleapis.com  /  api-free.deepl.com            │
│  api.openai.com            /  api.deepseek.com              │
└──────────────────────────────────────────────────────────────┘
```

## UI 结构

```
┌───────────────────┐    ┌─────────────────┐    ┌──────────────┐
│    Sidepanel      │    │  Options Page   │    │   Popup      │
│ src/sidepanel/    │    │ src/options/    │    │ (暂无自定义)   │
│                   │    │                 │    │              │
│ App.tsx (3 个标签) │    │ App.tsx         │    │ Plasmo 桩    │
│ ├ TranslatePanel  │    │ (复用 sidepanel │    │              │
│ ├ HistoryList     │    │  组件)          │    │              │
│ └ SettingsForm    │    │                 │    │              │
│                   │    │                 │    │              │
│ 共享组件            │    │                 │    │              │
│ ├ EngineSelector  │◄───┤ (从 sidepanel/  │    │              │
│ ├ LanguageSelector│    │  components/    │    │              │
│ └ SettingsForm    │    │  导入)           │    │              │
└───────────────────┘    └─────────────────┘    └──────────────┘
```

## 核心设计模式

### 1. 策略模式 — 翻译引擎

**相关文件：** `src/services/translator.ts`, `src/services/engines/*.ts`

```
TranslationEngine (接口)
    │
    ▼
BaseTranslationEngine (抽象类 — 默认顺序 batchTranslate 实现)
    │
    ├── GoogleEngine      — 免费，无需 API Key
    ├── DeepLEngine       — 需要 API Key
    ├── OpenAIEngine      — 覆写 batchTranslate，单请求 JSON 批量翻译
    └── DeepSeekEngine    — 覆写 batchTranslate，单请求 JSON 批量翻译
```

LLM 引擎覆写 `batchTranslate()`，将所有文本打包进一次 API 调用，通过 JSON 结构化输出批量返回翻译结果，减少延迟和费用。

引擎的注册/切换完全在运行时完成 — 引擎实例在 `background/index.ts` 中 Service Worker 启动时注册。

### 2. 策略模式 — 翻译中提示样式

**相关文件：** `src/lib/translation-tip-style.ts`, `src/lib/tip-style-manager.ts`, `src/lib/tip-styles/*.ts`

```
TranslationTipStyle (接口)
    │
    ├── SkeletonTipStyle       — 骨架屏占位动画，翻译前在段落下方显示灰条呼吸动画
    └── ProgressBarTipStyle    — 底部进度条浮动卡片，显示翻译百分比
```

采用与翻译引擎一致的策略模式。每种提示样式实现 `TranslationTipStyle` 接口（`start` / `updateProgress` / `finish` / `destroy`），由 `TipStyleManager` 统一管理生命周期。用户可在设置中多选独立的提示样式开关。新增样式只需实现接口 + 注册 + 加配置项即可，Manager 和 PageTranslator 无需改动。

### 3. 观察者模式 — 动态内容处理

**相关文件：** `src/services/dom-injector.ts`, `src/contents/page-translator.ts`

使用 `MutationObserver` 监听 `document.body` 的 DOM 变化（SPA 导航、无限滚动等）。当新内容出现时：
1. 300ms 防抖
2. 通过 `TextParserService` 提取新的可翻译文本节点
3. 经由 background 批量翻译
4. 将翻译结果注入 DOM

### 4. Service Worker 消息中枢

**文件：** `src/background/index.ts`

background script 是唯一的消息中转站。Content script 绝不直接调用翻译 API — 所有请求必须经过 background。这集中管理了 API Key、引擎调度和错误处理。

### 5. 文本解析策略

**文件：** `src/lib/text-parser.ts`, `src/lib/text-parser-service.ts`

两种解析模式：
- **文本模式** (`TranslatableTextNodeParser`)：提取单个文本节点，适合精确的 DOM 注入
- **段落模式** (`TranslatableParagraphParser`)：将内联文本节点按块级父元素分组，适合上下文翻译

两种模式共享相同的跳过逻辑：`SKIP_TAGS`、`SKIP_ATTRS`、`SKIP_STYLES` 常量定义在 `src/types/index.ts` 中。

### 6. 站点规则引擎

**文件：** `src/lib/site-config-util.ts`, `src/lib/site-configs.ts`

支持通过 CSS 选择器在特定域名上跳过指定元素（glob URL 匹配）。目前有一条针对 GitHub 的规则。可通过在 `site-configs.ts` 中添加条目来扩展。

## 数据流 — 整页翻译

```
1. 用户点击"翻译页面"（右键菜单或侧边栏）
2. Background 向当前 tab 发送 TRANSLATE_PAGE 消息
3. page-translator.ts content script 接收消息
4. TextParserService 提取可翻译文本节点
5. 文本按每批 1000 条分片
6. 每批通过 BATCH_TRANSLATE_TEXT 发送到 background
7. Background 调度到当前激活引擎的 batchTranslate()
8. 引擎调用外部 API
9. 翻译结果返回给 content script
10. Content script 在原文下方注入 <suiyi-translated> 元素
11. 注册 MutationObserver 处理后续动态内容
```

## 数据流 — 划词/悬停翻译

```
1. 用户在页面上选择/悬停文字
2. Content script (selection-handler 或 tooltip-renderer) 捕获文本
3. 防抖处理 (划词 300ms, 悬停 800ms)
4. 发送 TRANSLATE_TEXT 到 background
5. Background 调度到当前激活引擎的 translate()
6. 翻译结果返回给 content script
7. Content script 在光标/选区位置渲染翻译气泡
```

## 存储布局

| Storage 区域 | Key 模式 | 内容 |
|---|---|---|
| `chrome.storage.sync` | `settings` | UserSettings（引擎、语言、模式、开关） |
| `chrome.storage.local` | `suiyi_history` | TranslationHistory[]（最多 100 条） |
| `chrome.storage.local` | `suiyi_apikey_<engine>` | 每个引擎的 API Key |

## 权限模型

```json
{
  "permissions": ["storage", "activeTab", "sidePanel", "scripting", "tabs", "contextMenus"],
  "host_permissions": ["http://*/*", "https://*/*"]
}
```

- `sidePanel` — 打开侧边栏 UI
- `scripting` — 动态注入 content script
- `contextMenus` — 右键菜单"翻译页面"/"恢复页面"
- `activeTab` — 无需 `<all_urls>` 即可访问当前标签页
- `host_permissions` — 在所有站点上注入整页翻译 content script
