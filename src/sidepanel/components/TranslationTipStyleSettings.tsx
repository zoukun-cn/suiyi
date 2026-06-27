// 翻译中提示样式设置 — 多选框列表，支持新增样式时自动渲染

import type { UserSettings } from '../../types'

interface TipStyleOption {
  key: keyof UserSettings['translationTipStyles']
  label: string
  description: string
}

const TIP_STYLE_OPTIONS: TipStyleOption[] = [
  {
    key: 'skeleton',
    label: '骨架屏占位动画',
    description: '翻译前在段落下方显示占位骨架和旋转加载图标',
  },
  {
    key: 'progressBar',
    label: '底部进度条百分比',
    description: '页面底部显示翻译进度卡片（正在翻译 X%）',
  },
]

interface TranslationTipStyleSettingsProps {
  value: UserSettings['translationTipStyles']
  onChange: (next: UserSettings['translationTipStyles']) => void
}

export default function TranslationTipStyleSettings({
  value,
  onChange,
}: TranslationTipStyleSettingsProps) {
  const handleToggle = (key: keyof UserSettings['translationTipStyles']) => {
    onChange({ ...value, [key]: !value[key] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label
        style={{
          fontSize: 13,
          color: 'var(--suiyi-text-secondary)',
          display: 'block',
        }}
      >
        翻译中提示样式
      </label>

      {TIP_STYLE_OPTIONS.map((option) => (
        <label
          key={option.key}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            cursor: 'pointer',
            padding: '8px 10px',
            borderRadius: 'var(--suiyi-radius)',
            border: '1px solid var(--suiyi-border)',
            background: 'var(--suiyi-bg-secondary)',
          }}
        >
          <input
            type="checkbox"
            checked={value[option.key]}
            onChange={() => handleToggle(option.key)}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{option.label}</div>
            <div style={{ fontSize: 11, color: 'var(--suiyi-text-secondary)', marginTop: 2 }}>
              {option.description}
            </div>
          </div>
        </label>
      ))}
    </div>
  )
}
