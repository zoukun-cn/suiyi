// 网页特殊处理 — 各网站的跳过规则配置

import { SiteConfigManager } from './site-config-util'

const SITE_CONFIGS = [
  {
    urlPattern: 'https://github.com/',
    priority: 10,
    skipSelectors: [
      // GitHub 首页的 "跳转到内容" 链接，翻译后会导致页面结构变化，影响后续文本定位
      'a[data-skip-target-assigned="false"].js-skip-to-content'
    ],
  },
]

export const siteConfigManager = new SiteConfigManager(SITE_CONFIGS)