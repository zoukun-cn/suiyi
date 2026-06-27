// 翻译提示样式管理器 — 管理所有已注册的提示样式，统一调度生命周期

import { Storage } from '@plasmohq/storage'
import type { TranslationTipStyle } from './translation-tip-style'
import type { TranslatedSegment } from './text-parser'
import type { Segment } from './text-parser'
import type { UserSettings } from '../types'
import { SkeletonTipStyle } from './tip-styles/skeleton-tip-style'
import { ProgressBarTipStyle } from './tip-styles/progress-bar-tip-style'

const SETTINGS_KEY = 'suiyi_settings'
const storage = new Storage({ area: 'sync' })

export class TipStyleManager {

  private styles: TranslationTipStyle[] = []

  /** 根据用户设置初始化（异步，由调用方在适当时机调用） */
  async initByUserSettings(): Promise<void> {
    // 清空已有样式（原地清空，保持引用一致）
    this.styles.length = 0

    try {
      const settings = await storage.get(SETTINGS_KEY) as UserSettings | undefined
      const tipStyles = settings?.translationTipStyles
      console.log(`[TipStyleManager] settings:${settings} \n tipStyles: ${tipStyles}`);
      if (tipStyles?.skeleton) {
        this.register(new SkeletonTipStyle())
      }
      if (tipStyles?.progressBar) {
        this.register(new ProgressBarTipStyle())
      }
    } catch (err) {
      // 读取失败时默认全部启用
      console.warn('[TipStyleManager] Failed to read settings, enabling all tip styles by default:', err)
      this.register(new SkeletonTipStyle())
      this.register(new ProgressBarTipStyle())
    }
    console.log(`[TipStyleManager] Configured: ${this.styles.map((s) => s.id).join(', ') || 'none'} (${this.styles.length})`)
  }

  /** 注册一个提示样式（通常根据用户设置选择性注册） */
  register(style: TranslationTipStyle): void {
    // 防止重复注册
    if (this.styles.some((s) => s.id === style.id)) {
      console.warn(`[TipStyleManager] Skipped duplicate: ${style.id}`)
      return
    }
    this.styles.push(style)
    console.log(`[TipStyleManager] Registered: ${style.id} (total: ${this.styles.length})`)
  }

  /** 展示"翻译中"提示 UI */
  showTranslatingTipStyle(segments: Segment[]): void {
    for (const style of this.styles) {
      try {
        style.showTranslatingTipStyle(segments)
      } catch (err) {
        console.warn(`[TipStyleManager] ${style.id}.showTranslatingTipStyle() failed:`, err)
      }
    }
  }

  /** 进度更新：每批翻译完成后调用 */
  updateProgress(translatedSegments: TranslatedSegment[]): void {
    console.log(`[TipStyleManager] UpdateProgress finish count: ${translatedSegments.length}`)
    for (const style of this.styles) {
      try {
        style.updateProgress(translatedSegments)
      } catch (err) {
        console.warn(`[TipStyleManager] ${style.id}.updateProgress() failed:`, err)
      }
    }
  }

  /** 展示"翻译完成"提示 UI（success=true 显示 ✓ 淡出，success=false 立刻移除） */
  showTranslatedTipStyle(success: boolean): void {
    for (const style of this.styles) {
      try {
        style.showTranslatedTipStyle(success)
      } catch (err) {
        console.warn(`[TipStyleManager] ${style.id}.showTranslatedTipStyle() failed:`, err)
      }
    }
  }

}
