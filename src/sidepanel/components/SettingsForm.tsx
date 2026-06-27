import { useState, useEffect } from 'react'
import type { UserSettings, TranslateMode, EngineType } from '../../types'
import { getApiKey, setApiKey, removeApiKey } from '../../services/storage'
import TranslationTipStyleSettings from './TranslationTipStyleSettings'

interface SettingsFormProps {
  settings: UserSettings
  onChange: (partial: Partial<UserSettings>) => void
}

const MODE_LABELS: { value: TranslateMode; label: string }[] = [
  { value: 'bilingual', label: '双语对照' },
  { value: 'replacement', label: '直接替换' },
  { value: 'hover-only', label: '仅悬停翻译' },
]

const API_KEY_ENGINES: { type: EngineType; name: string; placeholder: string }[] = [
  { type: 'deepseek', name: 'DeepSeek', placeholder: 'sk-...' },
  { type: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { type: 'deepl', name: 'DeepL', placeholder: 'DeepL Auth Key' },
]

export default function SettingsForm({ settings, onChange }: SettingsFormProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})

  useEffect(() => {
    // 加载已保存的 API Keys
    Promise.all(API_KEY_ENGINES.map((e) => getApiKey(e.type))).then((keys) => {
      const map: Record<string, string> = {}
      API_KEY_ENGINES.forEach((e, i) => {
        if (keys[i]) map[e.type] = keys[i]!
      })
      setApiKeys(map)
    })
  }, [])

  const handleApiKeyChange = async (engine: EngineType, key: string) => {
    const trimmed = key.trim()
    setApiKeys((prev) => ({ ...prev, [engine]: trimmed }))

    if (trimmed) {
      await setApiKey(engine, trimmed)
    } else {
      await removeApiKey(engine)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600 }}>偏好设置</h3>

      <div className="suiyi-select-group">
        <label>翻译模式</label>
        <select
          className="suiyi-select"
          value={settings.translateMode}
          onChange={(e) => onChange({ translateMode: e.target.value as TranslateMode })}
        >
          {MODE_LABELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={settings.enableHover}
          onChange={(e) => onChange({ enableHover: e.target.checked })}
        />
        <span style={{ fontSize: 14 }}>启用悬停翻译</span>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={settings.enableSelection}
          onChange={(e) => onChange({ enableSelection: e.target.checked })}
        />
        <span style={{ fontSize: 14 }}>启用划词翻译</span>
      </label>

      <TranslationTipStyleSettings
        value={settings.translationTipStyles}
        onChange={(translationTipStyles) => onChange({ translationTipStyles })}
      />

      <hr style={{ border: 'none', borderTop: '1px solid var(--suiyi-border)', margin: 0 }} />

      <h3 style={{ fontSize: 14, fontWeight: 600 }}>API Keys</h3>

      {API_KEY_ENGINES.map(({ type, name, placeholder }) => (
        <div key={type} className="suiyi-select-group">
          <label>{name}</label>
          <input
            className="suiyi-select"
            type="password"
            placeholder={placeholder}
            value={apiKeys[type] || ''}
            onChange={(e) => handleApiKeyChange(type, e.target.value)}
            style={{ fontSize: 13 }}
          />
        </div>
      ))}
    </div>
  )
}
