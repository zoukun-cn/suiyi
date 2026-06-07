import { LANGUAGES } from '../../types'
import type { LanguageCode } from '../../types'

interface LanguageSelectorProps {
  from: LanguageCode
  to: LanguageCode
  onChangeFrom: (from: LanguageCode) => void
  onChangeTo: (to: LanguageCode) => void
}

export default function LanguageSelector({
  from,
  to,
  onChangeFrom,
  onChangeTo,
}: LanguageSelectorProps) {
  const swapLanguages = () => {
    if (from !== 'auto') {
      onChangeFrom(to as LanguageCode)
    }
    onChangeTo(from === 'auto' ? 'zh-CN' : from)
  }

  return (
    <div className="suiyi-select-group">
      <label>源语言</label>
      <select
        className="suiyi-select"
        value={from}
        onChange={(e) => onChangeFrom(e.target.value as LanguageCode)}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>

      <button
        className="suiyi-btn"
        onClick={swapLanguages}
        title="交换语言"
        style={{ padding: '4px 8px', fontSize: 16 }}
      >
        ⇄
      </button>

      <label>目标语言</label>
      <select
        className="suiyi-select"
        value={to}
        onChange={(e) => onChangeTo(e.target.value as LanguageCode)}
      >
        {LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  )
}
