// 翻译提示样式接口 — 策略模式，每种提示样式实现此接口

import type { Segment, TranslatedSegment } from './text-parser'

/** 翻译提示样式接口 — 每种提示样式实现此接口 */
export interface TranslationTipStyle {
  /** 唯一标识，对应配置 key */
  readonly id: string
  /** 显示名称，用于设置 UI */
  readonly name: string

  /** 展示"翻译中"提示 UI：传入本批待翻译段 */
  showTranslatingTipStyle(segments: Segment[]): void

  /** 进度更新：每批翻译完成后调用，传入本批完成的译文段 */
  updateProgress(translatedSegments: TranslatedSegment[]): void

  /** 展示"翻译完成"提示 UI。success=true 显示 ✓ 后自动淡出，success=false 立刻移除 DOM */
  showTranslatedTipStyle(success: boolean): void
}
