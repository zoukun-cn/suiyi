// 网页特殊处理 — 站点配置类型与工具函数

import { ParagraphTextSegment } from "./text-parser"

// ==================== Types ====================

/** 单个站点的跳过规则配置 */
export interface SiteConfig {
  /** URL glob 模式（如 "github.com"） */
  pattern: string
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

class SiteConfigManager {
  configs: SiteConfig[] = []

  constructor(configs: SiteConfig[]) {
    this.configs = [...configs].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  }

  /** 返回所有匹配当前 URL 的 SiteConfig，按 priority 降序 */
  protected matchConfigs(url: string): SiteConfig[] {
    return this.configs
      .filter(c => this.globMatch(c, url))
  }


  handle(segments: ParagraphTextSegment[], url: string): ParagraphTextSegment[] {
    const configs = this.matchConfigs(url)
    configs.forEach(cfg => {
      // TODO
    })
    return segments
  }


  protected globMatch(config: SiteConfig, url: string): boolean {
    const re = new RegExp(config.pattern.replace(/\./g, '\\.').replace(/\*/g, '.*'))
    return re.test(url)
  }


}

export const siteConfigManager = new SiteConfigManager([])
