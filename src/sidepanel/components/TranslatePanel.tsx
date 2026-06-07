import { useState, useCallback, type FormEvent } from 'react'

interface TranslatePanelProps {
  sourceText: string
  translatedText: string
  error: string | null
  loading: boolean
  onTranslate: (text: string) => void
  onSourceChange: (text: string) => void
}

export default function TranslatePanel({
  sourceText,
  translatedText,
  error,
  loading,
  onTranslate,
  onSourceChange,
}: TranslatePanelProps) {
  const [input, setInput] = useState(sourceText)

  // 同步外部 sourceText 到 input
  if (sourceText && input !== sourceText) {
    // 避免循环更新 — 仅在外部改变时同步
  }

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (input.trim()) {
        onSourceChange(input)
        onTranslate(input)
      }
    },
    [input, onSourceChange, onTranslate]
  )

  const handleClear = useCallback(() => {
    setInput('')
    onSourceChange('')
  }, [onSourceChange])

  return (
    <div className="suiyi-translate-panel">
      <form onSubmit={handleSubmit}>
        <textarea
          className="suiyi-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入要翻译的文字..."
          disabled={loading}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="submit"
            className="suiyi-btn primary"
            disabled={loading || !input.trim()}
          >
            {loading ? '翻译中...' : '翻译'}
          </button>
          {input && (
            <button
              type="button"
              className="suiyi-btn secondary"
              onClick={handleClear}
              disabled={loading}
            >
              清空
            </button>
          )}
        </div>
      </form>

      <div className={`suiyi-result-box ${loading ? 'loading' : ''}`}>
        {loading ? (
          <span>⏳ 正在翻译...</span>
        ) : error ? (
          <span style={{ color: '#dc2626' }}>❌ {error}</span>
        ) : translatedText ? (
          <p>{translatedText}</p>
        ) : (
          <span style={{ color: 'var(--suiyi-text-secondary)' }}>
            翻译结果将显示在这里
          </span>
        )}
      </div>
    </div>
  )
}
