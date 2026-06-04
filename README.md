# Chrome 翻译扩展插件

基于 Manifest V3 的 Google Chrome 浏览器翻译扩展插件，支持划词悬浮翻译、右键菜单翻译、整页翻译以及 Popup 输入框翻译。

## 技术栈

- **Manifest V3** Chrome 扩展规范
- **TypeScript** 全项目类型安全
- **Vite** 构建工具，配合 `vite-plugin-web-extension`
- **原生 DOM API** 保持轻量

## 目录结构

```
├── background/
│   ├── index.ts              # Service Worker 入口
│   ├── message-handler.ts    # 统一消息路由
│   └── context-menu.ts       # 右键菜单注册与处理
├── content/
│   ├── index.ts              # Content Script 入口
│   ├── selection-handler.ts  # 划词/悬停监听
│   ├── tooltip-renderer.ts   # 翻译浮窗渲染
│   └── page-translator.ts    # 整页翻译 DOM 操作
├── popup/
│   ├── index.html
│   ├── index.ts              # Popup 入口
│   └── popup.css             # Popup 样式
├── services/
│   ├── interface.ts          # ITranslationService 接口、Language 枚举
│   ├── pass-through.ts       # 默认原样输出实现
│   ├── registry.ts           # TranslationServiceRegistry 注册表
│   └── manager.ts            # TranslationManager 转发管理器
├── icons/                    # 扩展图标
├── manifest.json             # MV3 清单
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 支持的功能

| 功能 | 描述 |
|------|------|
| 划词悬浮翻译 | 选中网页文字，悬浮显示翻译结果 |
| 右键菜单翻译 | 选中文本后右键点击翻译菜单项 |
| 整页翻译 | 一键翻译整个网页内容，支持恢复原文 |
| Popup 输入框翻译 | 在插件弹窗中输入文本进行翻译 |

## 核心架构

### 可插拔翻译服务

- **ITranslationService**：翻译服务核心接口
- **PassThroughService**：默认实现，原样输出输入文本
- **TranslationServiceRegistry**：服务注册表，管理所有实现
- **TranslationManager**：统一转发入口，调用方不直接依赖具体实现

### 数据流

```
[用户交互] -> TranslationRequest -> Service Worker -> TranslationManager -> ITranslationService -> TranslationResult -> 展示
```

## 开发

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

### 加载到 Chrome

1. 打开 Chrome 扩展管理页面：`chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录下的 `dist/` 文件夹

## 扩展说明

- 翻译服务采用**可插拔架构**，默认实现为原样输出，方便接入真实翻译 API
- 所有翻译请求通过 `TranslationManager` 统一转发，便于后续扩展缓存、日志、降级等能力
