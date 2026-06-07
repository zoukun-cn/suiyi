// DeepL 翻译引擎 — 继承默认 batchTranslate（循环调用 translate）
import { BaseTranslationEngine } from '../translator'
import type { LanguageCode, EngineType } from '../../types'

const SUPPORTED_LANGUAGES: LanguageCode[] = [
  'zh-CN', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'it', 'nl', 'pl',
]

export class DeepLEngine extends BaseTranslationEngine {
  readonly type: EngineType = 'deepl'
  readonly name = 'DeepL'
  private apiKey: string | null = null

  setApiKey(key: string): void {
    this.apiKey = key
  }

  async translate(text: string, from: LanguageCode, to: LanguageCode): Promise<string> {
    if (!this.apiKey) {
      throw new Error('DeepL API key is not configured')
    }

    // 将 LanguageCode 映射为 DeepL 语言代码
    const sourceLang = from === 'auto' ? null : this.toDeepLLang(from)
    const targetLang = this.toDeepLLang(to)

    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        ...(sourceLang ? { source_lang: sourceLang } : {}),
        target_lang: targetLang,
      }),
    })

    if (!response.ok) {
      throw new Error(`DeepL API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as { translations: Array<{ text: string }> }
    return data.translations[0]?.text || ''
  }

  supports(from: LanguageCode, to: LanguageCode): boolean {
    if (!this.apiKey) return false
    if (from !== 'auto' && !SUPPORTED_LANGUAGES.includes(from)) return false
    if (!SUPPORTED_LANGUAGES.includes(to)) return false
    return true
  }

  /** 将通用 LanguageCode 转换为 DeepL 语言代码 */
  private toDeepLLang(lang: LanguageCode): string {
    const map: Partial<Record<LanguageCode, string>> = {
      'en': 'EN',
      'zh-CN': 'ZH',
      'ja': 'JA',
      'ko': 'KO',
      'fr': 'FR',
      'de': 'DE',
      'es': 'ES',
      'pt': 'PT',
      'ru': 'RU',
      'it': 'IT',
      'nl': 'NL',
      'pl': 'PL',
    }
    return map[lang] || lang.toUpperCase()
  }
}
