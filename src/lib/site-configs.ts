// 网页特殊处理 — 各网站的跳过规则配置

import type { SiteConfig } from './site-config-util'
import { siteConfigManager } from './site-config-util'

export const SITE_CONFIGS: SiteConfig[] = [
  {
    pattern: 'github.com',
    priority: 10,
    skipSelectors: ['[data-skip-target-assigned="false"]'],
  },
]

siteConfigManager.configs = SITE_CONFIGS
