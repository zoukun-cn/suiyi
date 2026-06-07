import { useState, useEffect, useCallback } from 'react'
import { sendMessage, sendMessageToTab, getActiveTab } from '../lib/messaging'
import { getSettings } from '../services/storage'
import { LANGUAGES, ENGINES } from '../types'
import type { LanguageCode, EngineType, UserSettings } from '../types'

export default function App() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageStatus, setPageStatus] = useState<string | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  const openSidePanel = useCallback(() => {
    sendMessage('OPEN_SIDE_PANEL').catch(console.error)
  }, [])

  const translateCurrentPage = useCallback(async () => {
    if (!settings) return
    setLoading(true)
    setPageStatus(null)

    try {
      const tab = await getActiveTab()
      if (!tab?.id) throw new Error('无法获取当前标签页')

      const response = await sendMessageToTab(tab.id, 'TRANSLATE_PAGE', {
        from: settings.defaultFrom,
        to: settings.defaultTo,
        engine: settings.defaultEngine,
      })

      setPageStatus(response.success ? '翻译已触发' : '翻译失败')
    } catch (err) {
      setPageStatus(`错误: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }, [settings])

  if (!settings) {
    return (
      <div className="suiyi-popup" style={{ alignItems: 'center', padding: 24 }}>
        <span>加载中...</span>
      </div>
    )
  }

  return (
    <div className="suiyi-popup">
      <header className="suiyi-popup-header">
        <h2>随译 Suiyi</h2>
        <span style={{ fontSize: 12, color: 'var(--suiyi-text-secondary)' }}>
          {ENGINES.find((e) => e.type === settings.defaultEngine)?.name} · {settings.defaultFrom === 'auto' ? '自动' : LANGUAGES.find((l) => l.code === settings.defaultFrom)?.name} → {LANGUAGES.find((l) => l.code === settings.defaultTo)?.name}
        </span>
      </header>

      <div className="suiyi-popup-actions">
        <button
          className="suiyi-btn primary"
          onClick={translateCurrentPage}
          disabled={loading}
        >
          {loading ? '⏳ 翻译中...' : '🌐 翻译当前页面'}
        </button>

        <button className="suiyi-btn secondary" onClick={openSidePanel}>
          📋 打开侧边栏
        </button>
      </div>

      {pageStatus && (
        <p style={{ fontSize: 12, color: pageStatus.includes('失败') ? '#dc2626' : 'var(--suiyi-accent)', textAlign: 'center' }}>
          {pageStatus}
        </p>
      )}

      <div className="suiyi-popup-footer">
        <span style={{ fontSize: 11, color: 'var(--suiyi-text-secondary)' }}>
          快捷键: 开发中
        </span>
      </div>
    </div>
  )
}
