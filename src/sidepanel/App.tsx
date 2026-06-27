import { useState, useEffect, useCallback } from 'react'
import TranslatePanel from './components/TranslatePanel'
import LanguageSelector from './components/LanguageSelector'
import EngineSelector from './components/EngineSelector'
import HistoryList from './components/HistoryList'
import SettingsForm from './components/SettingsForm'
import { useTranslation } from '../hooks/useTranslation'
import { getSettings, updateSettings, getHistory, addHistory, clearHistory } from '../services/storage'
import type { LanguageCode, EngineType, UserSettings, HistoryItem } from '../types'

type Tab = 'translate' | 'history' | 'settings'

const DEFAULT_SETTINGS: UserSettings = {
  defaultFrom: 'auto',
  defaultTo: 'zh-CN',
  defaultEngine: 'google',
  translateMode: 'bilingual',
  enableHover: true,
  enableSelection: true,
  translationTipStyles: {
    skeleton: true,
    progressBar: true,
  },
}

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [activeTab, setActiveTab] = useState<Tab>('translate')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [sourceText, setSourceText] = useState('')

  const { translated, loading, error, translate } = useTranslation({
    from: settings.defaultFrom,
    to: settings.defaultTo,
    engine: settings.defaultEngine,
  })

  // 加载设置和历史
  useEffect(() => {
    getSettings().then(setSettings)
    getHistory().then(setHistory)
  }, [])

  // 保存设置
  const handleSettingsChange = useCallback(async (partial: Partial<UserSettings>) => {
    const next = await updateSettings(partial)
    setSettings(next)
  }, [])

  // 执行翻译
  const handleTranslate = useCallback(async (text: string) => {
    if (!text.trim()) return
    setSourceText(text)

    const result = await translate(text)
    if (result) {
      const item: HistoryItem = {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        original: result.original,
        translated: result.translated,
        from: settings.defaultFrom,
        to: settings.defaultTo,
        engine: result.engine as EngineType,
        timestamp: result.timestamp,
      }
      await addHistory(item)
      // 刷新历史列表
      const updated = await getHistory()
      setHistory(updated)
    }
  }, [translate, settings.defaultFrom, settings.defaultTo])

  // 处理历史条目点击 (填入输入框)
  const handleHistorySelect = useCallback((item: HistoryItem) => {
    setSourceText(item.original)
    setActiveTab('translate')
  }, [])

  // 清空历史
  const handleClearHistory = useCallback(async () => {
    await clearHistory()
    setHistory([])
  }, [])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'translate', label: '翻译' },
    { key: 'history', label: '历史' },
    { key: 'settings', label: '设置' },
  ]

  return (
    <div className="suiyi-sidepanel">
      <header className="suiyi-header">
        <h1>随译 Suiyi</h1>
        <span className="suiyi-version">v0.0.1</span>
      </header>

      {/* Tab 导航 */}
      <nav style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--suiyi-border)', paddingBottom: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className="suiyi-btn"
            style={{
              background: activeTab === tab.key ? 'var(--suiyi-accent)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--suiyi-text-secondary)',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              border: activeTab === tab.key ? '1px solid var(--suiyi-accent)' : '1px solid transparent',
              padding: '8px 16px',
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 翻译 Tab */}
      {activeTab === 'translate' && (
        <>
          <section className="suiyi-controls">
            <LanguageSelector
              from={settings.defaultFrom}
              to={settings.defaultTo}
              onChangeFrom={(from: LanguageCode) => handleSettingsChange({ defaultFrom: from })}
              onChangeTo={(to: LanguageCode) => handleSettingsChange({ defaultTo: to })}
            />
            <EngineSelector
              active={settings.defaultEngine}
              onChange={(engine: EngineType) => handleSettingsChange({ defaultEngine: engine })}
            />
          </section>

          <section className="suiyi-main">
            <TranslatePanel
              sourceText={sourceText}
              translatedText={translated}
              error={error}
              loading={loading}
              onTranslate={handleTranslate}
              onSourceChange={setSourceText}
            />
          </section>
        </>
      )}

      {/* 历史 Tab */}
      {activeTab === 'history' && (
        <section className="suiyi-main">
          <HistoryList
            items={history}
            onSelect={handleHistorySelect}
            onClear={handleClearHistory}
          />
        </section>
      )}

      {/* 设置 Tab */}
      {activeTab === 'settings' && (
        <section className="suiyi-main">
          <SettingsForm
            settings={settings}
            onChange={handleSettingsChange}
          />
        </section>
      )}
    </div>
  )
}
