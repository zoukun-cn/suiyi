// Google 翻译引擎 — 使用免费 Google Translate API
import { BaseTranslationEngine } from '../translator'
import type { LanguageCode, EngineType } from '../../types'

const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single'

export class GoogleTranslateEngine extends BaseTranslationEngine {
  readonly type: EngineType = 'google'
  readonly name = 'Google 翻译'

  async translate(text: string, from: LanguageCode, to: LanguageCode): Promise<string> {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: from === 'auto' ? 'auto' : from,
      tl: to,
      dt: 't',
      q: text,
    })

    const response = await fetch(`${GOOGLE_TRANSLATE_API}?${params.toString()}`)

    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Google Translate 返回格式: [[["译文","原文",...],...],...]
    // 第一层数组是多个句子，每个句子的第一层包含翻译候选
    const translated = (data[0] as Array<Array<string>>)
      .filter((item) => item && item[0])
      .map((item) => item[0])
      .join('')

    return translated
  }

  supports(_from: LanguageCode, _to: LanguageCode): boolean {
    // Google 翻译支持几乎所有语言组合
    return true
  }
}
