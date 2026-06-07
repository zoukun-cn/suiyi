// DeepSeek 翻译引擎 — 覆写 batchTranslate 为 JSON 合并请求
import { BaseTranslationEngine } from '../translator'
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

interface ChatOptions {
  maxTokens?: number
  responseFormat?: { type: 'json_object' | 'text' }
}

export class DeepSeekEngine extends BaseTranslationEngine {
  readonly type: EngineType = 'deepseek'
  readonly name = 'DeepSeek'
  private apiKey: string | null = null
  private model: string = 'deepseek-v4-flash'

  setApiKey(key: string): void {
    this.apiKey = key
  }

  // ==================== 统一请求方法 ====================

  private async chat(
    system: string,
    user: string,
    options: ChatOptions = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key is not configured')
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: options.maxTokens ?? 4096,
    }

    if (options.responseFormat) {
      body.response_format = options.responseFormat
    }

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `DeepSeek API error: ${response.status} ${response.statusText}${errorText ? ` — ${errorText}` : ''}`
      )
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }
    return data.choices[0]?.message?.content?.trim() || ''
  }

  // ==================== 单条翻译 ====================

  async translate(text: string, from: LanguageCode, to: LanguageCode): Promise<string> {
    const fromName = from === 'auto' ? 'the detected language' : (LANG_NAMES[from] || from)
    const toName = LANG_NAMES[to] || to

    return this.chat(
      `You are a professional translator. Translate the following text from ${fromName} to ${toName}. Only output the translation, no explanations, no notes.`,
      text
    )
  }

  // ==================== 批量翻译 ====================
  
  override async batchTranslate(
    texts: string[],
    from: LanguageCode,
    to: LanguageCode
  ): Promise<Map<string, string>> {
    if (texts.length === 0) return new Map()

    const fromName = from === 'auto' ? 'the detected language' : (LANG_NAMES[from] || from)
    const toName = LANG_NAMES[to] || to

    const indexed = texts.map((t, i) => `${i}: ${t}`).join('\n')

    const system = `You are a professional translator. Translate the following ${texts.length} texts from ${fromName} to ${toName}.

Rules:
1. Return ONLY a valid JSON object (no markdown, no backticks).
2. Keys are the numeric indices (0, 1, 2, ...), values are the translations.
3. Preserve the original meaning, tone, and style.
4. Do NOT add any explanations or notes.

Example output format:
{"0":"translated text 0","1":"translated text 1"}`

    const content = await this.chat(system, indexed, {
      maxTokens: 4096 * Math.max(1, Math.ceil(texts.length / 20)),
      responseFormat: { type: 'json_object' },
    })

    // 容错：去除可能的 markdown 代码块包裹
    const cleaned = content
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()

    let parsed: Record<string, string>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[DeepSeek batch] Failed to parse JSON response:', cleaned.slice(0, 200))
      throw new Error('Failed to parse batch translation response')
    }

    // 构建 原文 → 译文 映射
    const result = new Map<string, string>()
    for (let i = 0; i < texts.length; i++) {
      const translation = parsed[String(i)]
      if (translation) result.set(texts[i], translation)
    }

    console.log(`[DeepSeek batch] Translated ${result.size}/${texts.length} texts in one request`)
    return result
  }

  supports(): boolean {
    return true
  }
}
