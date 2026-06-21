// 翻译服务抽象 — 策略模式管理多翻译引擎
import type { LanguageCode, EngineType, TranslateResult } from '../types'

// ==================== 引擎接口 ====================

export interface TranslationEngine {
  /** 引擎唯一标识 */
  readonly type: EngineType
  /** 引擎显示名称 */
  readonly name: string
  /** 翻译文本 */
  translate(text: string, from: LanguageCode, to: LanguageCode): Promise<string>
  /** 批量翻译 */
  batchTranslate(texts: string[], from: LanguageCode, to: LanguageCode): Promise<Map<string, string>>
  /** 检查是否支持某语言 */
  supports(from: LanguageCode, to: LanguageCode): boolean
}

// ==================== 引擎基类 ====================

/**
 * 翻译引擎抽象基类
 * 默认 batchTranslate 实现为循环调用 translate
 * LLM 类引擎可覆写为合并单次请求
 */
export abstract class BaseTranslationEngine implements TranslationEngine {
  abstract readonly type: EngineType
  abstract readonly name: string
  abstract translate(text: string, from: LanguageCode, to: LanguageCode): Promise<string>
  abstract supports(from: LanguageCode, to: LanguageCode): boolean

  /** 默认批量：逐条翻译，子类可按需覆写 */
  async batchTranslate(texts: string[],  from: LanguageCode, to: LanguageCode): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    for (const text of texts) {
      try {
        result.set(text, await this.translate(text, from, to))
      } catch {
        // 单条失败跳过
      }
    }
    return result
  }

}

// ==================== 翻译服务 ====================

class TranslatorService {
  private engines = new Map<EngineType, TranslationEngine>()
  private defaultEngine: EngineType = 'google'

  /** 注册翻译引擎 */
  register(engine: TranslationEngine): void {
    this.engines.set(engine.type, engine)
    console.log(`[Translator] Registered engine: ${engine.name}`)
  }

  /** 注销翻译引擎 */
  unregister(type: EngineType): void {
    this.engines.delete(type)
  }

  /** 获取已注册的引擎列表 */
  list(): EngineType[] {
    return Array.from(this.engines.keys())
  }

  /** 获取引擎实例 */
  get(type: EngineType): TranslationEngine | undefined {
    return this.engines.get(type)
  }

  /** 设置默认引擎 */
  setDefault(engine: EngineType): void {
    if (!this.engines.has(engine)) {
      throw new Error(`Engine "${engine}" is not registered`)
    }
    this.defaultEngine = engine
  }

  /** 执行翻译 */
  async translate(
    text: string,
    from: LanguageCode = 'auto',
    to: LanguageCode = 'zh-CN',
    engine?: EngineType
  ): Promise<TranslateResult> {
    const targetEngine = engine || this.defaultEngine
    const eng = this.engines.get(targetEngine)

    if (!eng) {
      throw new Error(`Translation engine "${targetEngine}" is not available`)
    }

    if (!eng.supports(from, to)) {
      throw new Error(`Engine "${targetEngine}" does not support ${from} → ${to}`)
    }

    const translated = await eng.translate(text, from, to)

    return {
      original: text,
      translated,
      engine: targetEngine,
      timestamp: Date.now(),
    }
  }
}

// 全局单例
export const translator = new TranslatorService()
