# Chrome 翻译扩展插件设计文档

## 项目概述

基于 Manifest V3 的 Google Chrome 浏览器翻译扩展插件，支持划词悬浮翻译、右键菜单翻译、整页翻译以及 Popup 输入框翻译。采用 TypeScript + Vite 构建，翻译服务采用可插拔架构。

## 技术栈

- **Manifest V3** Chrome 扩展规范
- **TypeScript** 全项目类型安全
- **Vite** 构建工具，配合 `vite-plugin-web-extension` 插件
- **原生 DOM API** 保持轻量，不引入 React/Vue 等前端框架

## 目录结构

```
src/
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
│   ├── pass-through.ts       # 默认原样输出实现 (PassThroughService)
│   ├── registry.ts           # TranslationServiceRegistry 注册表
│   └── manager.ts            # TranslationManager 转发管理器
├── manifest.json             # MV3 清单
└── vite-env.d.ts
```

## 功能模块

### 1. 划词悬浮翻译
- Content Script 监听 `mouseup` 事件
- 获取 `window.getSelection().toString()`，非空时发送翻译请求
- Service Worker 通过 TranslationManager 转发到具体服务
- 结果通过浮窗 (`TooltipRenderer`) 在光标附近展示
- 浮窗支持点击外部或按 ESC 关闭

### 2. 右键菜单翻译
- Service Worker 注册 `chrome.contextMenus`
- 用户右键选中文本后点击菜单项
- Service Worker 获取选中文本，走内部翻译流程
- 结果通过 `chrome.tabs.sendMessage` 回传给对应标签页 Content Script 展示浮窗

### 3. 整页翻译
- Content Script 接收 `translate-page` 指令
- 使用 `document.createTreeWalker` 遍历页面文本节点
- 批量收集文本内容，批量发送翻译请求
- 翻译结果替换原文，原文保存到 `data-original-text` 属性
- 已翻译节点标记 `data-translated="true"`，避免重复处理
- 支持 `restore-page` 指令恢复原文

### 4. Popup 输入框翻译
- Popup 提供文本输入域 + 源/目标语言选择 + 翻译按钮
- 翻译请求发送给 Service Worker
- 结果在 Popup 内展示
- 同时提供服务选择下拉框和功能开关

## 核心架构

### Language 枚举

```typescript
enum Language {
  AUTO = 'auto',
  ZH_CN = 'zh-CN',
  ZH_TW = 'zh-TW',
  EN = 'en',
  JA = 'ja',
  KO = 'ko',
  FR = 'fr',
  DE = 'de',
  ES = 'es',
  RU = 'ru',
}
```

### ITranslationService 接口

```typescript
interface TranslationRequest {
  text: string;
  sourceLang: Language;
  targetLang: Language;
}

interface TranslationResult {
  translatedText: string;
  sourceLang: Language;
  targetLang: Language;
  serviceName: string;
}

interface ITranslationService {
  readonly name: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}
```

### PassThroughService（默认实现）

原样输出输入文本，用于占位和测试：

```typescript
class PassThroughService implements ITranslationService {
  readonly name = 'pass-through';
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return {
      translatedText: request.text,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      serviceName: this.name,
    };
  }
}
```

### TranslationServiceRegistry

管理所有 `ITranslationService` 实现：

- `register(service: ITranslationService)`：注册服务
- `getService(name: string): ITranslationService | undefined`：按名称获取
- `getAll(): ITranslationService[]`：获取全部
- `getDefault(): ITranslationService`：返回 `PassThroughService`

### TranslationManager

**调用方唯一入口**，负责转发到具体的 `ITranslationService`：

- `translate(request: TranslationRequest): Promise<TranslationResult>`：核心翻译入口
- `setActiveService(name: string): boolean`：切换当前服务
- `getActiveServiceName(): string`
- `listAvailableServices(): string[]`

设计意图：
- 调用方（Service Worker、Popup、Content Script）不直接持有 `ITranslationService`
- 统一通过 Manager 入口调用
- 后续扩展（缓存、批量合并、错误降级、日志）在 Manager 层实现，对调用方无感知

### Service Worker 消息路由

监听 `chrome.runtime.onMessage`，根据 `action` 分发：

| Action | 描述 |
|--------|------|
| `translate` | 调用 `TranslationManager.translate()`，返回 `TranslationResult` |
| `list-services` | 返回 `manager.listAvailableServices()` |
| `set-active-service` | 调用 `manager.setActiveService()` 并持久化到 storage |

## 数据流

```
[用户交互: 划词 / 右键 / Popup输入]
    -> 组装 TranslationRequest { text, sourceLang, targetLang }
    -> Content Script / Popup 发送消息
    -> Service Worker
    -> TranslationManager.translate(request)     【统一入口】
    -> Registry.getService(activeName) ?? getDefault()
    -> ITranslationService.translate(request)
    -> TranslationResult
    -> 返回结果
    -> 渲染展示（浮窗 / Popup / DOM替换）
```

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 翻译服务未找到 | Manager 自动降级到 `PassThroughService` |
| 内容脚本注入失败 | 翻译前检查 `chrome.tabs.sendMessage` 错误，静默跳过 |
| 空文本或纯空白字符 | 前端直接拦截，不发送请求 |
| Storage 读取失败 | 使用硬编码默认值（`pass-through` + `Language.AUTO / EN`） |

## 边界情况

- **SPA 动态加载**：Content Script 在 `mouseup` 时实时获取选区，不依赖初始 DOM
- **iframe 内文本**：首期不做特殊处理（MV3 Content Script 默认不注入 iframe）
- **大段文本**：整页翻译时按段落分批处理，避免单条消息过大
- **重复翻译**：已翻译节点标记 `data-translated="true"`

## Manifest V3 权限

```json
{
  "manifest_version": 3,
  "permissions": [
    "activeTab",
    "contextMenus",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

## 构建配置

- 使用 `vite-plugin-web-extension` 处理 Manifest 解析和 HMR
- 输出目录：`dist/`
- TypeScript 严格模式开启
- 开发模式支持 Content Script 和 Service Worker 热更新
