import { useState, useEffect, useCallback } from 'react'
import LanguageSelector from '../sidepanel/components/LanguageSelector'
import EngineSelector from '../sidepanel/components/EngineSelector'
import SettingsForm from '../sidepanel/components/SettingsForm'
import { getSettings, updateSettings } from '../services/storage'
import type { LanguageCode, EngineType, UserSettings } from '../types'

const DEFAULT_SETTINGS: UserSettings = {
  defaultFrom: 'auto',
  defaultTo: 'zh-CN',
  defaultEngine: 'google',
  translateMode: 'bilingual',
  enableHover: true,
  enableSelection: true,
}

export default function OptionsApp() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  const handleSettingsChange = useCallback(async (partial: Partial<UserSettings>) => {
    const next = await updateSettings(partial)
    setSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [])

  return (
    <div className="suiyi-options">
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>随译 Suiyi</h1>
        <p style={{ color: 'var(--suiyi-text-secondary)', marginTop: 4 }}>翻译插件设置</p>
      </header>

      <section>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>默认翻译设置</h3>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 16,
            background: 'var(--suiyi-bg-secondary)',
            borderRadius: 'var(--suiyi-radius)',
          }}
        >
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
        </div>
      </section>

      <section>
        <SettingsForm settings={settings} onChange={handleSettingsChange} />
      </section>

      <footer style={{ textAlign: 'center' }}>
        {saved && (
          <span style={{ color: 'var(--suiyi-accent)', fontSize: 13 }}>✓ 设置已保存</span>
        )}
        <p style={{ fontSize: 12, color: 'var(--suiyi-text-secondary)', marginTop: 8 }}>
          随译 v0.0.1 · 一款支持双语对照、划词翻译、悬停翻译的浏览器翻译插件
        </p>
      </footer>
    </div>
  )
}
