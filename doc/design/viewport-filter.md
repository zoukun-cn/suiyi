# ViewportSegmentFilter — 基于 IntersectionObserver 的视口过滤队列

## Context

当前 page-translator 全量翻译所有 segment（含视口外不可见内容）。用 `ViewportSegmentFilter` 将 IntersectionObserver 与队列结合，消费者异步拉取可见的 segment 批次。

## 核心流程

```
parse() + siteConfig.handle() → segments[]
                                      ↓
                              filter.add(segments)
                                      ↓
                    ┌─ IntersectionObserver（生产者）
                    │   进入视口 → 入队
                    ▼
              ┌───────────┐
              │   queue   │
              └─────┬─────┘
                    │
                    │ tryTakeBatch(count, timeout)  ← 消费者拉取
                    ▼
              translateSegments(batch) → inject
```

## 类接口

```ts
// src/lib/viewport-filter.ts（新建）

/** 推模式监听器配置 */
export interface ViewportFilterListener {
  /** 收到一批可见段时回调 */
  onBatch: (batch: Segment[]) => void
  /** 攒够多少条触发，默认 10 */
  batchSize?: number
  /** 超时 ms（即便不足 batchSize 也触发），默认 100 */
  batchTimeout?: number
}

export class ViewportSegmentFilter {
  constructor(options?: {
    rootMargin?: string          // 默认 '300px'
    threshold?: number           // 默认 0
    listener?: ViewportFilterListener  // 指定后进入推模式
  })

  /** 追加待监听的段。每个 textNode.parentElement 注册到 observer */
  add(segments: Segment[]): void

  /** [拉模式] 严格拉取 — 超时且队列为空时抛异常 */
  async takeBatch(count: number, timeout?: number): Promise<Segment[]>

  /** [拉模式] 宽松拉取 — 超时后有多少返回多少，不抛异常 */
  async tryTakeBatch(count: number, timeout: number): Promise<Segment[]>

  /** 所有段已消费完毕 */
  get done(): boolean

  /** 尚未消费的段数 */
  get pending(): number

  /** 清空队列 + 断开 observer */
  destroy(): void
}
```

## 内部状态

```
segmentStatusMap: Map<Segment, 1 | 2>   // 所有 Segment 状态：1=待处理，2=已消费
pendingCount: number                     // status=1 的数量
elementMap: Map<Element, Segment>        // textNode.parentElement → Segment
queue: Segment[]                         // 已进入视口，待消费
```

| 派生值 | 计算 |
|--------|------|
| `pending` | `pendingCount + queue.length` |
| `done` | `pendingCount === 0 && queue.length === 0` |

Segment 生命周期：`add()` → status=1 → observer 回调 → 移出 Map → 入 queue → 消费 → status=2

## 关键行为

**add(segments)**:
```
for each seg:
  segmentSet.add(seg)
  for each n of seg.textNodes:
    el = n.parentElement
    if el: elementMap.set(el, seg); observer.observe(el)
```

**IntersectionObserver 回调** (entry.isIntersecting):
```
seg = elementMap.get(entry.target)
if seg:
  // 移除该 seg 所有映射 + 停止观察
  for each n of seg.textNodes:
    el = n.parentElement
    if el: elementMap.delete(el); observer.unobserve(el)
  queue.push(seg)
if resolver: resolver()
```

**observer 回调（推模式 — 有 listener 时）**:
```
seg 入队后:
  queue.length >= batchSize → 立即 splice + listener(batch)
  否则 → 启动 batchTimeout 定时器，到期后 listener(queue 现有数据)
```

**observer 回调（拉模式 — 无 listener 时）**:
```
seg 入队后 → 唤醒 resolver（等待中的 takeBatch）
```

**takeBatch / tryTakeBatch**（拉模式）:
```
tryResolve():
  queue >= count → splice 返回
  done → 返回 queue 剩余
  否则 → resolver = tryResolve（挂起）

takeBatch:  超时 + queue 空 → throw
tryTakeBatch: 超时 → 返回 queue 已有数据
消费后: segmentSet.delete(seg) for each consumed seg
```

## page-translator 中使用

```ts
class PageTranslator {
  private filter: ViewportSegmentFilter

  async start(payload) {
    const { from, to, engine } = payload
    let segments = textParser.parse(document.body, 'paragraph')
    segments = new SiteConfigManager(this.siteConfigs).handle(segments, location.href)

    let count = 0
    this.filter = new ViewportSegmentFilter({
      rootMargin: '300px',
      listener: {
        batchSize: 30,
        batchTimeout: 100,
        onBatch: (batch) => {
          translateSegments(batch, from, to, engine, (translated) => {
            count += injectBilingual(translated, this.translatedBlocks)
          })
        },
      },
    })

    this.filter.add(segments)

    // 等待全部消费
    while (!this.filter.done) {
      await new Promise(r => setTimeout(r, 200))
    }
    this.tipStyleManager.showTranslatedTipStyle(true)
    this.setupMutationObserver()
  }

  stop() {
    this.filter?.destroy()
  }

  // MutationObserver 回调中:
  // const newSegments = parse(el) + handle()
  // this.filter.add(newSegments)
}
```

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/lib/viewport-filter.ts` | **新建** |
| `src/contents/page-translator.ts` | 移除诊断代码；引入 ViewportSegmentFilter；重写 start()/stop() |
