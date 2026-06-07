import type { UserSettings, TranslateMode } from '../../types'

interface SettingsFormProps {
  settings: UserSettings
  onChange: (partial: Partial<UserSettings>) => void
}

const MODE_LABELS: { value: TranslateMode; label: string }[] = [
  { value: 'bilingual', label: '双语对照' },
  { value: 'replacement', label: '直接替换' },
  { value: 'hover-only', label: '仅悬停翻译' },
]

export default function SettingsForm({ settings, onChange }: SettingsFormProps) {
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
    </div>
  )
}
