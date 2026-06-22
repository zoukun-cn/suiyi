# 编码规范

## TypeScript

### 严格模式
`tsconfig.json` 中启用了 `strict: true`。所有代码必须完整标注类型 — 不允许隐式 `any`。

### 命名规范

| 类别 | 规范 | 示例 |
|---|---|---|
| 文件名 | kebab-case | `page-translator.ts` |
| 类 | PascalCase | `PageTranslator`, `GoogleEngine` |
| 接口 | PascalCase | `TranslationEngine` |
| Type | PascalCase | `TranslateMode`, `EngineType` |
| 函数 | camelCase | `parseTextNodes` |
| 变量 | camelCase | `activeEngine` |
| 常量 / 枚举 | UPPER_SNAKE_CASE | `SKIP_TAGS`, `ENGINES` |
| React 组件 | PascalCase | `TranslatePanel` |
| Hook | `use` + PascalCase | `useStorage`, `useActiveTab` |
| CSS 类名 | kebab-case | `.engine-chip` |
| 消息名 | UPPER_SNAKE_CASE | `TRANSLATE_TEXT` |
| Storage key | snake_case | `suiyi_apikey_openai` |

### 导入规范

- 无路径别名 — 所有导入使用相对路径
- 导入顺序：外部库 → 内部 services/lib → 内部 components → 样式
- 仅需类型时使用 `import type { ... }`

### 错误处理

- 异步函数应始终返回结果，绝不跨消息边界抛出异常
- 在服务边界（API 调用、storage 读取）使用 try/catch
- 临时性故障使用 `src/lib/retry-utils.ts` 中的重试工具

## React 规范

- **仅使用函数组件** — 不使用 class 组件
- Props 类型内联写在函数参数中：
  ```tsx
  export function TranslatePanel({ onTranslate }: { onTranslate: (text: string) => void }) {
  ```
- 共享状态逻辑使用 `src/hooks/` 中的 Hook
- 不使用外部状态管理库 — React state + chrome.storage 已足够
- `src/sidepanel/components/` 中的组件**不是**一个独立的共享包 — Options 页面直接通过 `../sidepanel/components/` 导入

## DOM 操作

- Content script 使用自定义标签 `<suiyi-translated>` 注入元素
- 使用 `src/lib/dom-utils.ts` 中的 `DomCollection`（类 jQuery API）进行 DOM 遍历：
  ```ts
  const $items = $('suiyi-translated')
  $items.each(el => el.remove())
  ```
- 插入 DOM 之前务必对文本进行转义（防止 XSS）
- MutationObserver 回调必须做防抖（默认 300ms）

## CSS

- **仅使用纯 CSS Variables** — 不使用 CSS-in-JS，不生成运行时 CSS
- 所有变量在 `src/styles/global.css` 的 `:root` 中定义
- 使用 CSS 变量实现主题和一致性间距：
  ```css
  color: var(--color-primary);
  padding: var(--spacing-md);
  ```
- 组件样式通过根 class 的后代选择器限定作用域
- 不使用 CSS modules — 样式是全局的，通过组件 class 名称限域

## Storage

- 使用 `src/services/storage.ts` 中的 `StorageService`（而非直接调用 chrome.storage API）
- 设置项 → `chrome.storage.sync`（跨设备同步，配额受限）
- 历史记录 + API Key → `chrome.storage.local`（更大配额，仅本地）
- Storage key 在 `src/services/storage.ts` 中定义为常量
- API Key 的 key 遵循模式：`suiyi_apikey_<engine_name>`

## Content Script

- 操作 DOM 前始终检查 `document.readyState`
- 仅通过 `chrome.runtime.sendMessage` 通信 — **绝不**在 content script 中直接调用 `fetch`
- 扩展停止/重启时应移除注入的元素（通过 `page-translator.stop()` 清理）
- 遵循 `translate="no"`、`aria-hidden="true"` 和 `display: none` 属性
- 跳过 `SKIP_TAGS` 和 `SKIP_ATTRS` 常量匹配的元素

## 添加功能的标准流程

1. **类型先行** — 先在 `src/types/index.ts` 中添加类型/枚举，再写实现
2. **Service 层** — 业务逻辑放在 `src/services/` 中，绝不出现在 UI 组件中
3. **工具函数** — 纯函数放在 `src/lib/` 中
4. **Background 接线** — 在 `src/background/index.ts` 中注册引擎、添加消息监听
5. **UI** — React 组件放在 `src/sidepanel/components/` 中

## Plasmo 专属规则

- **不要**手动创建 `manifest.json` — Plasmo 从 `package.json` 自动生成
- **不要**编辑 `.plasmo/` 或 `build/` 中的文件
- **不要**直接使用 `chrome.scripting.executeScript` 注入 content script — 优先使用 Plasmo 的 `contents/` 目录约定，或在 background 中手动注入
- 扩展页面（sidepanel, options）由目录名自动发现

## Git

- 分支：`main`（唯一分支）
- Commit 风格：中文描述（如"滚动翻译支持"、"代码优化"）
- 当前无 PR/Issue 模板
