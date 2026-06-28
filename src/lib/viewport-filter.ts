// 视口段过滤器 — IntersectionObserver + 队列，异步拉取可见的翻译段
import type { Segment } from './text-parser'

/** 推模式监听器配置 */
export interface ViewportFilterListener {
  onBatch: (batch: Segment[]) => void
  batchSize?: number
  batchTimeout?: number
}

enum SegmentStatus { PENDING = 1, QUEUED = 2, PROCESSED = 3 }

export class ViewportSegmentFilter {
  private segmentStatusMap = new Map<Segment, SegmentStatus>()
  private elementMap = new Map<Element, Segment>()
  private observer: IntersectionObserver
  private listener: ViewportFilterListener | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(options?: {rootMargin?: string, threshold?: number, listener?: ViewportFilterListener}) {
    this.listener = options?.listener ?? null
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const seg = this.elementMap.get(entry.target as Element)
          if (!seg) continue

          // 移除该 seg 的所有映射 + 停止观察
          for (const n of seg.textNodes) {
            const el = n.parentElement
            if (el) {
              this.elementMap.delete(el)
              this.observer.unobserve(el)
            }
          }
          this.segmentStatusMap.set(seg, SegmentStatus.QUEUED)
          if (this.listener) this.flushListener()
        }
      },
      {
        rootMargin: options?.rootMargin ?? '300px',
        threshold: options?.threshold ?? 0,
      },
    )
  }

  /** 追加待监听的段 */
  add(segments: Segment[]): void {
    for (const seg of segments) {
      if (this.segmentStatusMap.has(seg)) continue
      this.segmentStatusMap.set(seg, SegmentStatus.PENDING)
      for (const n of seg.textNodes) {
        const el = n.parentElement
        if (el) {
          this.elementMap.set(el, seg)
          this.observer.observe(el)
        }
      }
    }
  }

  /** 推模式：队列触发推送 */
  private flushListener(): void {
    if (!this.listener) return

    const size = this.listener.batchSize ?? 10
    const queued = this.countByStatus(SegmentStatus.QUEUED)

    if (queued >= size) {
      if (this.timer) { clearTimeout(this.timer); this.timer = null }
      this.listener.onBatch(this.extractQueued())
      return
    }

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null
        if (this.countByStatus(SegmentStatus.QUEUED) === 0) return
        this.listener!.onBatch(this.extractQueued())
      }, this.listener.batchTimeout ?? 100)
    }
  }

  /** 从 Map 中取出前 limit 个 QUEUED 段（FIFO，利用 Map 插入顺序） */
  private extractQueued(limit?: number): Segment[] {
    const batch: Segment[] = []
    for (const [seg, status] of this.segmentStatusMap) {
      if (status === SegmentStatus.QUEUED) {
        batch.push(seg)
        if (limit !== undefined && batch.length >= limit) break
      }
    }
    for (const seg of batch) {
      this.segmentStatusMap.set(seg, SegmentStatus.PROCESSED)
    }
    return batch
  }

  get done(): boolean {
    return this.countByStatus(SegmentStatus.PENDING) === 0   && this.countByStatus(SegmentStatus.QUEUED) === 0
  }

  get pending(): number {
    return this.countByStatus(SegmentStatus.PENDING)  + this.countByStatus(SegmentStatus.QUEUED)
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer)
    this.observer.disconnect()
    this.elementMap.clear()
    this.segmentStatusMap.clear()
  }

  private countByStatus(status: SegmentStatus): number {
    let n = 0
    for (const v of this.segmentStatusMap.values()) {
      if (v === status) n++
    }
    return n
  }
}
