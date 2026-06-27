# 站点跳过规则 — 用户可配置化

## 背景

当前 `src/lib/site-configs.ts` 硬编码了 GitHub 的跳过规则。用户在运行时不修改代码的情况下无法添加自己的规则。需要开放到侧边栏设置中，让用户可以增删站点跳过规则。

## 核心设计 — 内置规则作为默认值

**不区分"内置"和"用户"，统一作为 `UserSettings.siteConfigs`。** 内置 GitHub 规则直接写在 `DEFAULT_SETTINGS` 里 —— 用户首次安装自动获得，可编辑可删除。

这样最简单：
- 不需要 `mergeSiteConfigs`、不需要 `BUILTIN_PRIORITY_OFFSET`
- 翻译时直接从 payload 拿 `siteConfigs`，`new SiteConfigManager(configs).handle()`
- 用户编辑 → 覆盖 storage，完全控制

## 不新增类型，复用现有 `SiteConfig`

`SiteConfig` 已定义在 `src/lib/site-config-util.ts`。`UserSettings` 直接使用 `SiteConfig[]`。

React key 用数组 index（列表 ≤ 10 条，无拖拽排序）。

---

## UI — 独立顶级 Tab「站点规则」

```
┌─────────────────────────────────────────────┐
│  翻译  │  历史  │  设置  │  站点规则        │  ← 新增 Tab
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 站点跳过规则                                 │
│ 设置后，匹配规则的页面元素将不会被翻译          │
├─────────────────────────────────────────────┤
│ ┌ URL 模式 ─────────────────────── [×] ┐    │
│ │ [https://github.com/*            ]    │    │
│ │ CSS 选择器                            │    │
│ │ [.js-skip-to-content, [class*=Vi] ]   │    │
│ └──────────────────────────────────────┘    │
│ ┌ URL 模式 ─────────────────────── [×] ┐    │
│ │ [https://example.com/*           ]    │    │
│ │ CSS 选择器                            │    │
│ │ [.nav, .footer                    ]    │    │
│ └──────────────────────────────────────┘    │
│                                             │
│           [+ 添加规则]            已用 2/10   │
└─────────────────────────────────────────────┘
```

---

## 数据流

```
Sidepanel (「站点规则」Tab)
  │ SiteConfigEditor.onChange(siteConfigs)
  │ App.handleSettingsChange({ siteConfigs })
  ▼
chrome.storage.sync['suiyi_settings'].siteConfigs

触发翻译 (右键菜单 / 侧边栏按钮)
  │ getSettings() 读取 siteConfigs
  ▼
Background → EXECUTE_PAGE_TRANSLATE (payload 带 siteConfigs)
  │
  ▼
PageTranslator.start()
  │ new SiteConfigManager(configs)  ← 直接用 settings 中的配置
  ▼
configManager.handle(segments, url)
```

---

## 改动清单

### 1. `src/types/index.ts`

```ts
export interface UserSettings {
  // ... 现有字段不变 ...
  /** 用户自定义的站点跳过规则（最多 MAX_USER_SITE_CONFIGS 条） */
  siteConfigs: import('../lib/site-config-util').SiteConfig[]
}

export const MAX_USER_SITE_CONFIGS = 10
```

### 2. `src/lib/site-config-util.ts`

- `handleBySelectors` 中 `el.closest(sel)` 包 try-catch，防止用户输入非法选择器导致崩溃
- 其余不变

### 3. `src/services/storage.ts`

`DEFAULT_SETTINGS` 中内置 GitHub 规则：

```ts
siteConfigs: [
  {
    urlPattern: 'https://github.com/',
    priority: 10,
    skipSelectors: [
      'a[data-skip-target-assigned="false"].js-skip-to-content',
      '[class*="VisuallyHidden"]',
    ],
  },
],
```

### 4. `src/lib/site-configs.ts`

- 移除 `SITE_CONFIGS` 数组和 `siteConfigManager` 单例
- 文件可删除或保留为空壳（后续不再需要）

### 5. `src/styles/global.css`

新增样式：
- `.suiyi-site-config-list` — 规则列表容器
- `.suiyi-site-config-card` — 单条规则卡片（border, radius, bg-secondary）
- `.suiyi-site-config-card input` — 输入框，焦点高亮 accent 色
- `.suiyi-site-config-delete` — 删除按钮（link-btn 风格）

### 6. `src/sidepanel/components/SiteConfigEditor.tsx`（新建）

整个组件作为「站点规则」Tab 的完整内容，包含标题、说明、规则卡片列表、添加按钮。

Props：
```ts
interface SiteConfigEditorProps {
  value: SiteConfig[]
  onChange: (next: SiteConfig[]) => void
}
```

- 每条规则一个卡片：URL 输入框 + 选择器输入框（逗号分隔，实时 split/trim）+ 删除按钮
- 底部「添加规则」按钮，达到 `MAX_USER_SITE_CONFIGS` 时禁用并显示 "已用 N/10"
- 新增时 `priority` 默认 0，`skipAttrs`/`skipStyles` 不设置

### 7. `src/sidepanel/App.tsx`

新增「站点规则」Tab：

- Tab 列表 `['translate', 'history', 'settings', 'site-rules']`
- Tab 标签 `{ translate: '翻译', history: '历史', settings: '设置', 'site-rules': '站点规则' }`
- 渲染：
  ```tsx
  {activeTab === 'site-rules' && (
    <SiteConfigEditor
      value={settings?.siteConfigs ?? []}
      onChange={(siteConfigs) => handleSettingsChange({ siteConfigs })}
    />
  )}
  ```

### 8. `src/background/index.ts`

- 上下文菜单 `MENU_TRANSLATE`：payload 添加 `siteConfigs: settings.siteConfigs`
- `handlePageTranslate`：读取 settings，注入 `siteConfigs` 到 payload

### 9. `src/contents/page-translator.ts`

- 移除 `import { siteConfigManager } from '../lib/site-configs'`
- `start()` 和 MutationObserver 中，每次翻译时创建新的 `SiteConfigManager`：
  ```ts
  const configManager = new SiteConfigManager(siteConfigs ?? [])
  segments = configManager.handle(segments, location.href)
  ```
- 将 `siteConfigs` 存为实例字段，MutationObserver 回调中复用

---

## 实现顺序

| 步骤 | 文件 | 说明 |
|------|------|------|
| 1 | `src/types/index.ts` | 添加 `siteConfigs` 字段 + `MAX_USER_SITE_CONFIGS` |
| 2 | `src/lib/site-config-util.ts` | closest() 加 try-catch |
| 3 | `src/services/storage.ts` | DEFAULT_SETTINGS 添加 GitHub 规则 |
| 4 | `src/lib/site-configs.ts` | 移除单例 |
| 5 | `src/styles/global.css` | 新增样式 |
| 6 | `src/sidepanel/components/SiteConfigEditor.tsx` | 新建组件 |
| 7 | `src/sidepanel/App.tsx` | 新增 Tab |
| 8 | `src/background/index.ts` | payload 传递 siteConfigs |
| 9 | `src/contents/page-translator.ts` | 用实例化 Manager 替代单例 |

---

## 边界情况

- **首次安装**：`DEFAULT_SETTINGS` 自带 GitHub 规则，UI 即刻可见
- **用户删光**：`siteConfigs: []`，所有元素正常翻译
- **旧版升级**：`getSettings()` 的 spread 合并自动补默认值（含 GitHub 规则）
- **非法 CSS 选择器**：`el.closest()` 包了 try-catch，静默跳过
- **chrome.storage.sync 配额**：10 条规则约 3KB，在 8KB 限制内安全
