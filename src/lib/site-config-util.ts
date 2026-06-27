// 网页特殊处理 — 站点配置类型与工具函数

import { Segment } from "./text-parser"

// ==================== Types ====================

/** 单个站点的跳过规则配置 */
export interface SiteConfig {
  /** URL 匹配模式（支持 * 通配符，如 "https://github.com/*"） */
  urlPattern: string
  /** 优先级，数字越大越优先，默认 0 */
  priority?: number
  /** CSS 选择器，匹配的元素整棵子树跳过 */
  skipSelectors?: string[]
  /** 属性值对，el.getAttribute(k) === v 时跳过 */
  skipAttrs?: Record<string, string>
  /** CSS 样式，getComputedStyle(el).getPropertyValue(k) === v 时跳过 */
  skipStyles?: Record<string, string>
}


// ==================== Manager ====================

export class SiteConfigManager {
  configs: SiteConfig[] = []

  constructor(configs: SiteConfig[]) {
    this.configs = [...configs].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  }

  /** 返回所有匹配当前 URL 的 SiteConfig，按 priority 降序 */
  protected matchConfigs(url: string): SiteConfig[] {
    return this.configs
      .filter(c => this.globMatch(c, url))
  }


  /** 按优先级依次应用所有匹配的站点配置，过滤掉应跳过的 segments */
  handle<T extends Segment>(segments: T[], url: string): T[] {
    const configs = this.matchConfigs(url)
    console.log(`[SiteConfigManager] Matched ${configs.length} configs for URL: ${url}`, configs)
    let result = segments
    for (const cfg of configs) {
      if (cfg.skipSelectors?.length) {
        result = this.handleBySelectors(result, cfg.skipSelectors)
      }
      if (cfg.skipAttrs) {
        result = this.handleByAttrs(result, cfg.skipAttrs)
      }
      if (cfg.skipStyles) {
        result = this.handleByStyles(result, cfg.skipStyles)
      }
    }
    return result
  }

  protected handleBySelectors<T extends Segment>(segments: T[], selectors: string[]): T[] {
    const shouldSkip = (node: Node | Text): boolean => {
      const el = node.nodeType === Node.TEXT_NODE ? (node as Text).parentElement : node as Element
      if (!el) return false
      return selectors.some(sel => {
        try { return el.closest(sel) !== null }
        catch { return false }
      })
    }
    return segments
      .map(s => this.handleSegment(s, shouldSkip))
      .filter((s): s is T => s !== undefined)
  }

  protected handleByAttrs<T extends Segment>(segments: T[], attrs: Record<string, string>): T[] {
    const entries = Object.entries(attrs)
    const shouldSkip = (node: Node | Text): boolean => {
      const el = node.nodeType === Node.TEXT_NODE ? (node as Text).parentElement : node as Element
      if (!el) return false
      return entries.some(([k, v]) => el.getAttribute(k) === v)
    }
    return segments
      .map(s => this.handleSegment(s, shouldSkip))
      .filter((s): s is T => s !== undefined)
  }

  protected handleByStyles<T extends Segment>(segments: T[], styles: Record<string, string>): T[] {
    const entries = Object.entries(styles)
    const shouldSkip = (node: Node | Text): boolean => {
      const el = node.nodeType === Node.TEXT_NODE ? (node as Text).parentElement : node as Element
      if (!el || !(el instanceof HTMLElement)) return false
      const style = window.getComputedStyle(el)
      return entries.some(([prop, val]) => style.getPropertyValue(prop) === val)
    }
    return segments
      .map(s => this.handleSegment(s, shouldSkip))
      .filter((s): s is T => s !== undefined)
  }

  protected handleSegment<T extends Segment>(segment: T, shouldSkip: (node: Node | Text) => boolean): T | undefined {
    // topNode 命中 → 整个 segment 跳过
    if (shouldSkip(segment.topNode)) return
    // 所有 textNode 都命中 → 整个 segment 跳过
    if (segment.textNodes.every(n => shouldSkip(n))) return
    return segment
  }


  protected globMatch(config: SiteConfig, url: string): boolean {
    const re = new RegExp(config.urlPattern.replace(/\./g, '\\.').replace(/\*/g, '.*'))
    return re.test(url)
  }

}

