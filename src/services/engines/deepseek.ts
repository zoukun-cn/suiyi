// DeepSeek 翻译引擎 — 兼容 OpenAI API 格式
import type { TranslationEngine } from '../translator'
import type { LanguageCode, EngineType } from '../../types'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

// 语言代码 → 语言名称映射（用于 prompt）
const LANG_NAMES: Record<string, string> = {
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  th: 'Thai',
  vi: 'Vietnamese',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  id: 'Indonesian',
}

export class DeepSeekEngine implements TranslationEngine {
  readonly type: EngineType = 'deepseek'
  readonly name = 'DeepSeek'
  private apiKey: string | null = null
  private model: string = 'deepseek-v4-pro'

  setApiKey(key: string): void {
    this.apiKey = key
  }

  constructor() {
    // 可根据需要调整默认模型
    this.model = 'deepseek-v4-pro'
    this.apiKey = ''
  }

  async translate(text: string, from: LanguageCode, to: LanguageCode): Promise<string> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key is not configured')
    }

    const fromName = from === 'auto' ? 'the detected language' : (LANG_NAMES[from] || from)
    const toName = LANG_NAMES[to] || to

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text from ${fromName} to ${toName}. Only output the translation, no explanations, no notes.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}${errorText ? ` — ${errorText}` : ''}`)
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }
    return data.choices[0]?.message?.content?.trim() || ''
  }

  supports(_from: LanguageCode, _to: LanguageCode): boolean {
    // if (!this.apiKey) return false
    return true
  }
}
