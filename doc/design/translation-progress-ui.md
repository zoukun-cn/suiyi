# 页面翻译「翻译中」状态 UI — 设计方案

> 创建时间：2026-06-22
> 状态：已审批，待实现

---

## 一、背景与目标

### 当前问题

`PageTranslator`（[page-translator.ts](../../src/contents/page-translator.ts)）在翻译过程中没有任何视觉反馈：页面解析 → 静默等待 → 译文注入。翻译耗时较长时，用户不知道翻译是否在进行，体验不佳。

### 目标

1. 提供**至少两种**翻译中提示样式，用户可多选独立开关
2. 架构**可扩展**，后续新增提示样式只需实现接口 + 注册 + 加配置项
3. 对现有翻译流程侵入最小

---

## 二、提示样式

### 样式一：骨架屏占位 (Skeleton)

- **触发时机**：文本解析完成后，翻译开始前，立即在每个待翻译元素后插入占位骨架
- **视觉效果**：灰色圆角条，高度匹配原文行高，低透明度呼吸动画（pulse），左边有个小小旋转加载圆圈
- **消失时机**：译文注入时自动替换（骨架元素在译文注入前批量移除）
- **DOM 元素**：`<suiyi-skeleton>` 自定义标签，带 `data-suiyi-skeleton` 属性

```
原文段落内容...
┌─────────────────────────────┐  ← 骨架屏占位条（呼吸动画），左边有旋转圆圈
│ ⠋ ░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────┘
    ↓ 翻译完成后替换为 ↓
┌─────────────────────────────┐
│ 译文内容...                  │  ← <suiyi-translated>
└─────────────────────────────┘
```

### 样式二：底部进度条 (Progress Bar)

- **触发时机**：翻译开始时出现在页面底部居中
- **视觉效果**：半透明卡片，左侧旋转加载图标，文字 "正在翻译 32%"
- **消失时机**：翻译完成后切换为 "翻译完成 ✓" 持续 1.5s 再淡出消失
- **DOM 元素**：`<suiyi-progress-bar>` 自定义标签，`position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 99999`

```
翻译中：
┌─────────────────────────┐
│  ⠋  正在翻译 32%        │  ← 底部居中浮动卡片
└─────────────────────────┘

完成后（1.5s 后淡出）：
┌─────────────────────────┐
│  ✓  翻译完成             │
└─────────────────────────┘
```

---

## 三、架构设计

### 3.1 策略模式：TranslationTipStyle 接口

与现有翻译引擎（`BaseTranslationEngine`）保持一致，采用策略模式：

```typescript
// 文件：src/lib/translation-tip-style.ts（新建）

/** 翻译进度信息 */
interface TranslationProgress {
  completed: number   // 已完成段数
  total: number       // 总段数
}

/** 翻译提示样式接口 —— 每种提示样式实现此接口 */
interface TranslationTipStyle {
  /** 唯一标识，对应配置 key */
  readonly id: string
  /** 显示名称，用于设置 UI */
  readonly name: string

  /** 翻译开始：传入所有待翻译段 */
  start(segments: Segment[]): void

  /** 进度更新：每批翻译完成后调用 */
  updateProgress(progress: TranslationProgress): void

  /** 翻译完成（成功或失败） */
  finish(): void

  /** 销毁：移除所有注入的 DOM 元素 */
  destroy(): void
}
```

### 3.2 TipStyleManager

```typescript
// 文件：src/lib/tip-style-manager.ts（新建）

class TipStyleManager {
  private styles: TranslationTipStyle[] = []

  register(style: TranslationTipStyle): void
  start(segments: Segment[]): void
  updateProgress(progress: TranslationProgress): void
  finish(): void
  destroy(): void
}
```

管理器遍历所有已注册的样式调用对应方法，每个样式内部自行处理 DOM 操作。

### 3.3 实现类

两个具体实现类都 `implements TranslationTipStyle`：

```
TranslationTipStyle                    ← 接口（src/lib/translation-tip-style.ts）
    ↑ implements
    ├── SkeletonTipStyle                ← 骨架屏占位（src/lib/tip-styles/skeleton-tip-style.ts）
    └── ProgressBarTipStyle             ← 底部进度条（src/lib/tip-styles/progress-bar-tip-style.ts）
```

| 文件 | 类 | 实现接口 | 说明 |
|---|---|---|---|
| `src/lib/translation-tip-style.ts` | `TranslationTipStyle` | — | 接口定义 + `TranslationProgress` 类型 |
| `src/lib/tip-styles/skeleton-tip-style.ts` | `SkeletonTipStyle` | `implements TranslationTipStyle` | 样式一：骨架屏占位 |
| `src/lib/tip-styles/progress-bar-tip-style.ts` | `ProgressBarTipStyle` | `implements TranslationTipStyle` | 样式二：底部进度条 |

`TipStyleManager` 持有 `TranslationTipStyle[]`，只依赖接口不依赖具体类。新增提示样式只需写一个 `implements TranslationTipStyle` 的类即可，Manager 和 PageTranslator 无需改动。

### 3.4 数据流

```
PageTranslator.start()
  │
  ├─ 1. textParser.parse() → segments
  │
  ├─ 2. TipStyleManager.start(segments)             ← NEW
  │     ├─ SkeletonTipStyle.start()    → 注入 <suiyi-skeleton>
  │     └─ ProgressBarTipStyle.start() → 注入 <suiyi-progress-bar>
  │
  ├─ 3. for each batch of segments:
  │     ├─ translateSegments(batch)
  │     └─ TipStyleManager.updateProgress()          ← NEW
  │           └─ ProgressBarTipStyle.updateProgress() → 更新百分比
  │
  ├─ 4. TipStyleManager.finish()                     ← NEW
  │     ├─ SkeletonTipStyle.finish()    → 移除所有骨架（译文即将注入）
  │     └─ ProgressBarTipStyle.finish() → 显示 ✓ → 1.5s 后淡出
  │
  └─ 5. injectBilingual() → 注入 <suiyi-translated>
```

**MutationObserver 动态内容**也复用相同流程：新节点解析 → `start(segments)` → 翻译 → `updateProgress` → `finish`。

---

## 四、配置与存储

### 4.1 UserSettings 扩展

```typescript
// src/types/index.ts 中 UserSettings 增加字段：

interface UserSettings {
  // ... 现有字段保持不变 ...
  
  /** 翻译中提示样式开关（多选） */
  translationTipStyles: {
    skeleton: boolean       // 骨架屏占位，默认 true
    progressBar: boolean    // 底部进度条，默认 true
  }
}
```

### 4.2 存储

跟随现有 `UserSettings` 存储在 `chrome.storage.sync`，key 为 `suiyi_settings`。无需额外存储。

### 4.3 默认值

`DEFAULT_SETTINGS` 中 `translationTipStyles` 默认全部开启。

---

## 五、设置 UI

在 `SettingsForm.tsx` 中新增配置区域：

```
偏好设置
  ├── 翻译模式: [下拉选择]
  ├── ☑ 启用悬停翻译
  ├── ☑ 启用划词翻译
  └── 翻译中提示样式 (新增)
        ├── ☑ 骨架屏占位动画
        └── ☑ 底部进度条百分比
API Keys
  └── ...
```

新增组件 `TranslationTipStyleSettings.tsx`，渲染多选框列表。未来新增样式时只需在配置数组中加一项即可自动渲染。

### 扩展新样式的步骤

1. 在 `src/lib/tip-styles/` 下新建文件，实现 `TranslationTipStyle` 接口
2. 在 `UserSettings.translationTipStyles` 中加一个 boolean 字段
3. 在 `TranslationTipStyleSettings` 的配置数组中加一项
4. 在 `PageTranslator` 初始化时 `register` 新样式

---

## 六、文件变更清单

| 操作 | 文件 | 说明 |
|---|---|---|
| 新建 | `src/lib/translation-tip-style.ts` | `TranslationTipStyle` 接口 + `TranslationProgress` 类型 |
| 新建 | `src/lib/tip-style-manager.ts` | `TipStyleManager` 类 |
| 新建 | `src/lib/tip-styles/skeleton-tip-style.ts` | 骨架屏实现 |
| 新建 | `src/lib/tip-styles/progress-bar-tip-style.ts` | 进度条实现 |
| 修改 | `src/types/index.ts` | `UserSettings` 增加 `translationTipStyles` 字段 |
| 修改 | `src/services/storage.ts` | `DEFAULT_SETTINGS` 增加默认值 |
| 修改 | `src/contents/page-translator.ts` | 集成 `TipStyleManager` |
| 新建 | `src/sidepanel/components/TranslationTipStyleSettings.tsx` | 设置 UI 多选框 |
| 修改 | `src/sidepanel/components/SettingsForm.tsx` | 引入 TranslationTipStyleSettings |
| 修改 | `CLAUDE.md` | 更新关键文件表 |
| 修改 | `doc/ARCHITECTURE.md` | 更新架构设计模式 |
| 修改 | `doc/DEVELOPMENT.md` | 更新目录结构 |

---

## 七、细节决策

### 7.1 Skeleton vs Translated 元素的生命周期

- `start()` 注入 `<suiyi-skeleton>` 到每个 segment.topNode 之后
- `finish()` 批量移除所有 `<suiyi-skeleton>`
- 紧接着 `injectBilingual()` 注入 `<suiyi-translated>`
- **不在 updateProgress 中逐条替换**——那样 DOM 操作太频繁。采用批量策略：全部翻译完成后一次性替换。

### 7.2 动态内容（MutationObserver）的提示处理

MutationObserver 触发新内容翻译时，只对新 segments 调用 `start()` 和 `finish()`，不影响已翻译内容。进度条需支持「追加」模式：`total` 累加新段数。

### 7.3 错误处理

- `finish()` 始终会被调用（`try/finally` 包裹），确保骨架屏不会永久残留
- 翻译失败时 `finish()` 直接销毁提示元素（不显示 ✓）

### 7.4 性能

- 骨架屏元素使用 `display: block` 和简洁 CSS，无复杂动画（pulse 用 `opacity` 过渡）
- 进度条使用 `position: fixed`，不参与文档流，不触发 reflow
- 禁用 CSS-in-JS，样式直接写在实现类的 `injectStyle()` 方法中

---

## 八、验证方法

1. `pnpm dev` 加载扩展
2. 打开任意英文网页，右键「🌐 翻译网页」
3. 验证骨架屏立即出现在每个段落下方，带有呼吸动画
4. 验证底部出现 "正在翻译 X%" 浮动卡片，数字随翻译推进增长
5. 翻译完成后骨架屏消失、译文出现、进度条显示 "翻译完成 ✓" 后淡出
6. 进入设置页面，只关闭骨架屏，重新翻译——仅底部进度条出现
7. 只关闭进度条，重新翻译——仅骨架屏出现
8. 全部关闭，重新翻译——无任何额外 UI（行为同修改前）
9. 滚动页面触发动态内容翻译，验证新增内容的提示正常工作
