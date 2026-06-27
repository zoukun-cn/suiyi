# 内部消息协议

Content script、UI 页面和 background Service Worker 之间的所有通信均通过 `chrome.runtime.sendMessage` 进行。

## 消息格式

```ts
interface Message<T extends MessageType = MessageType> {
  type: T
  payload?: MessagePayloadMap[T]
}

// 所有消息遵循此结构：
// { type: 'MESSAGE_TYPE', payload: { ... } }
```

## 消息类型

### TRANSLATE_TEXT
→ **Background** ← Content Script / Sidepanel / Popup

单条文本翻译（划词、悬停、侧边栏输入）。

```ts
// 请求
{ type: 'TRANSLATE_TEXT', payload: {
  text: string
  from?: LanguageCode       // 未填时使用 'auto'
  to?: LanguageCode         // 未填时使用设置中的默认值
  engine?: EngineType       // 未填时使用设置中的默认值
}}

// 响应: { success: boolean, data?: TranslateResult }
// data: { translation: string, engine: EngineType }
```

### BATCH_TRANSLATE_TEXT
→ **Background** ← page-translator Content Script

批量页面翻译 — 一次发送多条文本。

```ts
// 请求
{ type: 'BATCH_TRANSLATE_TEXT', payload: {
  texts: string[]
  from: LanguageCode
  to: LanguageCode
  engine?: EngineType
}}

// 响应: { success: boolean, data?: Record<string, string> }
// data 为原文→译文的映射: { "original text": "translated text", ... }
```

**注意：** LLM 引擎（OpenAI、DeepSeek）将此优化为一次 API 调用，通过 JSON 输出批量返回。Google / DeepL 引擎则回退为逐条顺序请求。

### TRANSLATE_PAGE
→ **Background** ← Sidepanel / Options / Popup

触发页面翻译（由 Background 统一调度，再发送 EXECUTE_PAGE_TRANSLATE 给 Content Script）。

```ts
// 请求
{ type: 'TRANSLATE_PAGE', payload: {
  sourceLang?: LanguageCode
  targetLang?: LanguageCode
  engine?: EngineType
}}

// 响应: { success: boolean, data?: { count: number } }
```

### EXECUTE_PAGE_TRANSLATE
→ **Content Script** ← Background

Background 向 page-translator content script 发送翻译执行指令。

```ts
// 请求
{ type: 'EXECUTE_PAGE_TRANSLATE', payload: {
  from: LanguageCode
  to: LanguageCode
  engine?: EngineType
}}

// 响应: { success: boolean, data?: { count: number } }
```

### RESTORE_PAGE
→ **Content Script** ← Background

指示 content script 移除所有译文，恢复页面原始状态。

```ts
// 请求
{ type: 'RESTORE_PAGE' }

// 响应: { success: boolean, data?: { count: number } }
```

### PAGE_TRANSLATION_STATUS
→ **Background** ← page-translator Content Script

Content script 向 background 汇报翻译状态（用于控制右键菜单显示"翻译页面"还是"恢复页面"）。

```ts
{ type: 'PAGE_TRANSLATION_STATUS', payload: {
  status: 'translated' | 'restored'
  tabId?: number
}}
```

### GET_SETTINGS
→ **Background** ← 任意上下文

从 storage 读取当前设置。

```ts
// 请求
{ type: 'GET_SETTINGS' }

// 响应: UserSettings
{
  defaultEngine: EngineType    // 默认: 'deepseek'
  defaultFrom: LanguageCode    // 默认: 'auto'
  defaultTo: LanguageCode      // 默认: 'zh-CN'
  translateMode: TranslateMode // 'bilingual' | ...
  enableSelection: boolean     // 默认: true
  enableHover: boolean         // 默认: true
  translationTipStyles: {
    skeleton: boolean          // 骨架屏开关
    progressBar: boolean       // 进度条开关
  }
}
```

### SAVE_SETTINGS
→ **Background** ← Sidepanel / Options Page

持久化设置到 storage。

```ts
// 请求
{ type: 'SAVE_SETTINGS', payload: Partial<UserSettings> }

// 响应: UserSettings (更新后)
```

## 类型化消息工具

定义在 [src/lib/messaging.ts](../src/lib/messaging.ts)：

```ts
// 发送消息并获取类型化响应
sendMessage<T extends MessageType>(type: T, payload?: MessagePayloadMap[T]): Promise<MessageResponseMap[T]>

// 向指定 tab 发送消息
sendMessageToTab<T extends MessageType>(tabId: number, type: T, payload?: MessagePayloadMap[T]): Promise<MessageResponseMap[T]>

// 监听消息
addMessageListener<T extends MessageType>(type: T, handler: (payload: MessagePayloadMap[T], sender, sendResponse) => void): void
```

**务必使用这些类型化封装**，而不是直接调用 `chrome.runtime.sendMessage` — 它们提供 TypeScript 类型推导。

## 消息流图

```
Sidepanel/Options ──TRANSLATE_TEXT──→ Background ──外部 API──→ 翻译结果
       │                                    │
       ├──GET_SETTINGS──────────────────────┤
       ├──SAVE_SETTINGS─────────────────────┤
       ├──TRANSLATE_PAGE────────────────────┤
       │                                    │
       │                    ┌───────────────┤
       │                    │               │
       │           EXECUTE_PAGE_TRANSLATE   PAGE_TRANSLATION_STATUS
       │              RESTORE_PAGE          │
       │                    │               │
       │                    ▼               ▲
       │              page-translator.ts ───┘
       │
       │    selection-handler.ts ──TRANSLATE_TEXT──→ Background
       │    tooltip-renderer.ts  ──TRANSLATE_TEXT──→ Background
```

## 添加新的消息类型

1. 在 [src/types/index.ts](../src/types/index.ts) 中添加到 `MessageType` 枚举
2. 在 `MessagePayloadMap` 中添加 payload 类型
3. 在 `MessageResponseMap` 中添加响应类型
4. 在 `background/index.ts` 中注册消息监听器
5. 使用 `messaging.ts` 中的 `sendMessage` 发送消息

## 错误处理

- Background 中所有消息处理器均捕获错误并返回结构化结果
- Content script 优雅处理失败（例如在气泡中显示错误而不是崩溃）
- 翻译 API 的网络错误由 translator service 捕获，并作为消息响应传递（绝不作为未处理的 rejection 抛出）
