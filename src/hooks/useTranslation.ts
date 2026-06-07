// 翻译核心 Hook — 封装翻译请求逻辑
import { useState, useCallback } from 'react'
import { sendMessage } from '../lib/messaging'
import type { LanguageCode, EngineType, TranslateResult } from '../types'

interface UseTranslationOptions {
  from: LanguageCode
  to: LanguageCode
  engine: EngineType
}

interface UseTranslationReturn {
  translated: string
  loading: boolean
  error: string | null
  translate: (text: string) => Promise<TranslateResult | null>
  clear: () => void
}

export function useTranslation(options: UseTranslationOptions): UseTranslationReturn {
  const [translated, setTranslated] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const translate = useCallback(
    async (text: string): Promise<TranslateResult | null> => {
      if (!text.trim()) return null

      setLoading(true)
      setError(null)

      try {
        const response = await sendMessage<TranslateResult>('TRANSLATE_TEXT', {
          text,
          from: options.from,
          to: options.to,
          engine: options.engine,
        })

        if (response.success && response.data) {
          setTranslated(response.data.translated)
          return response.data
        } else {
          setError(response.error || '翻译失败')
          return null
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '网络错误'
        setError(msg)
        return null
      } finally {
        setLoading(false)
      }
    },
    [options.from, options.to, options.engine]
  )

  const clear = useCallback(() => {
    setTranslated('')
    setError(null)
  }, [])

  return { translated, loading, error, translate, clear }
}
