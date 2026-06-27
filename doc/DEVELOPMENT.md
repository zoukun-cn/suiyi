# 开发指南

## 环境要求

- **Node.js** ≥ 18
- **pnpm**（包管理器）
- **Chrome** 或 Chromium 内核浏览器

## 初始化

```bash
# 安装依赖
pnpm install

# 启动开发模式（热更新）
pnpm dev

# 生产构建
pnpm build

# 打包为扩展 zip
pnpm package

# 清理构建产物
pnpm clean
```

## 在 Chrome 中加载扩展

1. 运行 `pnpm dev` 或 `pnpm build`
2. 打开 Chrome → `chrome://extensions/`
3. 开启右上角"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `build/chrome-mv3-dev/`（开发）或 `build/chrome-mv3-prod/`（生产）

## 项目目录结构

```
src/
├── background/          # Service Worker — 消息中枢、引擎管理
│   └── index.ts
├── contents/            # Content Script — 注入到网页中运行
│   ├── page-translator.ts    # 整页双语翻译
│   ├── selection-handler.ts   # 划词 → 弹出翻译
│   └── tooltip-renderer.ts   # 悬停 → 弹出翻译
├── services/            # 业务逻辑（无 DOM 操作、无 React）
│   ├── translator.ts         # 策略模式 — 引擎调度
│   ├── storage.ts            # 设置/历史/API Key 持久化
│   ├── dom-injector.ts       # MutationObserver 处理动态内容
│   └── engines/
│       ├── google.ts
│       ├── deepl.ts
│       ├── openai.ts
│       └── deepseek.ts
├── lib/                 # 纯工具函数（无副作用）
│   ├── text-parser.ts         # DOM 文本提取与分组
│   ├── text-parser-service.ts # 解析器策略注册
│   ├── messaging.ts           # chrome.runtime 类型化封装
│   ├── dom-utils.ts           # 类 jQuery DOM 辅助工具
│   ├── batch-utils.ts         # 数组分片
│   ├── retry-utils.ts         # 带退避的重试工具
│   ├── site-config-util.ts    # 站点级元素跳过规则
│   ├── site-configs.ts        # 已注册的站点配置
│   ├── translation-tip-style.ts  # TranslationTipStyle 接口定义
│   ├── tip-style-manager.ts   # 提示样式管理器
│   └── tip-styles/
│       ├── skeleton-tip-style.ts    # 骨架屏占位动画
│       └── progress-bar-tip-style.ts # 底部进度条
├── sidepanel/           # 侧边栏 UI (React)
│   ├── index.tsx              # 入口
│   ├── App.tsx                # Tab 导航（翻译/历史/设置）
│   └── components/
│       ├── TranslatePanel.tsx
│       ├── HistoryList.tsx
│       ├── LanguageSelector.tsx
│       ├── EngineSelector.tsx
│       ├── SettingsForm.tsx
│       └── TranslationTipStyleSettings.tsx
├── options/             # 选项页 (React)
│   ├── index.tsx
│   └── App.tsx               # 复用 sidepanel 组件
├── components/          # 预留给共享组件（当前为空）
├── hooks/               # React Hooks
│   ├── useActiveTab.ts
│   ├── useStorage.ts
│   └── useTranslation.ts
├── styles/
│   └── global.css            # CSS Variables 主题，所有样式集中于此
├── styles.d.ts               # CSS 模块类型声明
└── types/
    └── index.ts              # 所有类型、常量、枚举、消息类型
```

## Plasmo 约定

本项目基于 [Plasmo](https://docs.plasmo.com/) 构建，它提供**基于目录的路由**。文件位置决定扩展入口：

```
src/background/index.ts    →  Service Worker
src/contents/*.ts          →  Content Script
src/sidepanel/index.tsx    →  Side Panel
src/options/index.tsx      →  Options Page
src/popup/index.tsx        →  Popup（暂未使用）
```

**不要**手动创建 `manifest.json` — Plasmo 会从 `package.json` 自动生成。

## 开发流程

### 添加新的翻译引擎

1. 创建 `src/services/engines/<name>.ts`
2. 实现 `TranslationEngine` 接口（或继承 `BaseTranslationEngine`）
3. 在 `src/background/index.ts` 中注册：
   ```ts
   const engine = new YourEngine(apiKey)
   translatorService.registerEngine(engine)
   translatorService.setActiveEngine('your-engine')
   ```
4. 在 `src/types/index.ts` 中将引擎添加至 `EngineType` 和 `ENGINES`
5. 在 `SettingsForm.tsx` 中添加 API Key 存储和 UI

### 添加站点规则

在 `src/lib/site-configs.ts` 中添加：
```ts
siteConfigs.push({
  urlPattern: '*.example.com/*',
  skipSelectors: ['.no-translate', '#nav'],
  // skipAttributes、skipStyles 同样可用
})
```

### 在侧边栏添加 UI 功能

1. 在 `src/sidepanel/components/` 中创建组件
2. 在 `src/sidepanel/App.tsx` 中引入并使用
3. 如果选项页也需要，同样引入即可

## 调试

- **Background script**：`chrome://extensions/` → 点击扩展下方的 "Service Worker"
- **Content script**：DevTools → Sources → Content Scripts
- **Sidepanel / Options**：标准 React DevTools
- **Storage**：DevTools → Application → Storage → chrome.storage

## 构建产物

```
build/
├── chrome-mv3-dev/      # 开发构建（未压缩）
└── chrome-mv3-prod/     # 生产构建（压缩）
```

`.plasmo/` 包含生成的中间文件 — 永远不要编辑这些文件。

## 注意事项

- Content script 与 background 之间**仅**通过 `chrome.runtime.sendMessage` 通信 — 绝不直接调用外部 API
- Background Service Worker 可能随时被 Chrome 终止 — 状态必须持久化到 storage
- `chrome.storage.sync` 有配额限制 — 仅存储设置项；历史记录和 API Key 使用 `chrome.storage.local`
- 对 `document.body` 的 MutationObserver 必须做防抖处理（当前 300ms），避免性能问题
- CSS 使用纯 CSS Variables（定义在 `src/styles/global.css`）— 不要引入 CSS-in-JS
