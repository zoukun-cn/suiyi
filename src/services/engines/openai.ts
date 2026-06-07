// OpenAI 翻译引擎 (占位 — 需要 API Key)
import type { TranslationEngine } from '../translator'
import type { LanguageCode, EngineType } from '../../types'

export class OpenAITranslateEngine implements TranslationEngine {
  readonly type: EngineType = 'openai'
  readonly name = 'OpenAI'
  private apiKey: string | null = null
  private model: string = 'gpt-4o-mini'

  setApiKey(key: string): void {
    this.apiKey = key
  }

  async translate(text: string, from: LanguageCode, to: LanguageCode): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are a professional translator. Translate the following text from ${from === 'auto' ? 'the detected language' : from} to ${to}. Only output the translation, no explanations.`,
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
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    }
    return data.choices[0]?.message?.content?.trim() || ''
  }

  supports(_from: LanguageCode, _to: LanguageCode): boolean {
    if (!this.apiKey) return false
    return true // OpenAI 支持几乎所有语言
  }
}
