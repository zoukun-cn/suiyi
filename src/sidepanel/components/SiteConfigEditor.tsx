// 站点跳过规则编辑器 — 用户可增删 URL 匹配规则
import { useCallback } from 'react'
import type { SiteConfig } from '../../lib/site-config-util'
import { MAX_USER_SITE_CONFIGS } from '../../types'

interface SiteConfigEditorProps {
  value: SiteConfig[]
  onChange: (next: SiteConfig[]) => void
}

export default function SiteConfigEditor({ value, onChange }: SiteConfigEditorProps) {

  const handleAdd = useCallback(() => {
    if (value.length >= MAX_USER_SITE_CONFIGS) return
    const next = [...value, { urlPattern: '', priority: 0, skipSelectors: [] }]
    onChange(next)
  }, [value, onChange])

  const handleRemove = useCallback((index: number) => {
    const rule = value[index]
    const label = rule.urlPattern || '(未设置 URL 模式)'
    if (!confirm(`确定要删除这条规则吗？\n\n${label}`)) return
    onChange(value.filter((_, i) => i !== index))
  }, [value, onChange])

  const handleUrlChange = useCallback((index: number, url: string) => {
    onChange(value.map((cfg, i) =>
      i === index ? { ...cfg, urlPattern: url } : cfg,
    ))
  }, [value, onChange])

  const handleSelectorChange = useCallback((ruleIndex: number, selIndex: number, text: string) => {
    onChange(value.map((cfg, i) => {
      if (i !== ruleIndex) return cfg
      const selectors = [...(cfg.skipSelectors ?? [])]
      selectors[selIndex] = text
      return { ...cfg, skipSelectors: selectors }
    }))
  }, [value, onChange])

  const handleSelectorAdd = useCallback((ruleIndex: number) => {
    onChange(value.map((cfg, i) =>
      i === ruleIndex ? { ...cfg, skipSelectors: [...(cfg.skipSelectors ?? []), ''] } : cfg,
    ))
  }, [value, onChange])

  const handleSelectorRemove = useCallback((ruleIndex: number, selIndex: number) => {
    onChange(value.map((cfg, i) => {
      if (i !== ruleIndex) return cfg
      return { ...cfg, skipSelectors: (cfg.skipSelectors ?? []).filter((_, j) => j !== selIndex) }
    }))
  }, [value, onChange])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>站点跳过规则</h3>
        <p style={{ fontSize: 12, color: 'var(--suiyi-text-secondary)', margin: 0 }}>
          设置后，匹配规则的页面元素将不会被翻译
        </p>
      </div>

      <div className="suiyi-site-config-list">
        {value.map((cfg, i) => (
          <div key={i} className="suiyi-site-config-card">
            <div className="suiyi-card-header">
              <label>URL 模式</label>
              <button
                className="suiyi-site-config-delete"
                onClick={() => handleRemove(i)}
                title="删除规则"
              >
                ×
              </button>
            </div>
            <input
              type="text"
              placeholder="https://example.com/*"
              value={cfg.urlPattern}
              onChange={(e) => handleUrlChange(i, e.target.value)}
            />

            <label>CSS 选择器</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(cfg.skipSelectors ?? []).map((sel, j) => (
                <div key={j} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder=".nav, [aria-hidden]"
                    value={sel}
                    onChange={(e) => handleSelectorChange(i, j, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="suiyi-site-config-delete"
                    onClick={() => handleSelectorRemove(i, j)}
                    title="删除选择器"
                  >
                    ×
                  </button>
                </div>
              ))}
              {(!cfg.skipSelectors || cfg.skipSelectors.length === 0) && (
                <div style={{ fontSize: 12, color: 'var(--suiyi-text-secondary)', padding: '4px 0' }}>
                  暂未添加选择器
                </div>
              )}
              <button
                className="suiyi-btn secondary"
                style={{ fontSize: 12, padding: '2px 10px', alignSelf: 'flex-start' }}
                onClick={() => handleSelectorAdd(i)}
              >
                + 添加选择器
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="suiyi-site-config-footer">
        <button
          className="suiyi-btn secondary"
          onClick={handleAdd}
          disabled={value.length >= MAX_USER_SITE_CONFIGS}
        >
          + 添加规则
        </button>
        <span style={{ fontSize: 12, color: 'var(--suiyi-text-secondary)' }}>
          {value.length >= MAX_USER_SITE_CONFIGS ? '已达上限' : `已用 ${value.length}/${MAX_USER_SITE_CONFIGS}`}
        </span>
      </div>
    </div>
  )
}
