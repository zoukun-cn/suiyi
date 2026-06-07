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
  /** 检查是否支持某语言 */
  supports(from: LanguageCode, to: LanguageCode): boolean
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
