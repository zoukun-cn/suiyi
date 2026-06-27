// 底部进度条提示样式 — 页面底部居中浮动卡片显示翻译进度

import type { TranslationTipStyle } from '../translation-tip-style'
import type { TranslatedSegment } from '../text-parser'
import type { Segment } from '../text-parser'

const PROGRESS_TAG = 'suiyi-progress-bar'
const PROGRESS_ATTR = 'data-suiyi-progress-bar'

export class ProgressBarTipStyle implements TranslationTipStyle {
  readonly id = 'progressBar'
  readonly name = '底部进度条百分比'

  private el: HTMLElement | null = null
  private total = 0
  private completed = 0
  private finishTimer: ReturnType<typeof setTimeout> | null = null
  private styleInjected = false

  // ========== TranslationTipStyle 实现 ==========

  showTranslatingTipStyle(segments: Segment[]): void {
    // 累加段数，支持动态内容追加模式
    this.total += segments.length
    this.ensureElement()
    this.render()
  }

  updateProgress(translatedSegments: TranslatedSegment[]): void {
    this.completed += translatedSegments.length
    this.render()
  }

  showTranslatedTipStyle(success: boolean): void {
    if (!this.el) return

    if (success) {
      // 显示完成状态 ✓，1.5s 后淡出
      this.clearFinishTimer()
      this.el.style.opacity = '1'
      this.el.innerHTML = this.buildContent(true)

      this.finishTimer = setTimeout(() => {
        if (this.el) {
          this.el.style.transition = 'opacity 0.3s ease'
          this.el.style.opacity = '0'
        }
        this.finishTimer = setTimeout(() => {
          this.el?.remove()
          this.el = null
        }, 350)
      }, 1500)
    } else {
      // 立刻移除
      this.clearFinishTimer()
      this.el.remove()
      this.el = null
    }

    this.total = 0
    this.completed = 0
  }

  // ========== 内部方法 ==========

  private ensureElement(): void {
    if (this.el) return

    this.injectStyle()

    this.el = document.createElement(PROGRESS_TAG)
    this.el.setAttribute(PROGRESS_ATTR, '')
    this.el.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: rgba(30, 30, 30, 0.88);
      color: #fff;
      border-radius: 12px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      user-select: none;
      pointer-events: none;
      white-space: nowrap;
    `
    document.body.appendChild(this.el)
  }

  private render(): void {
    if (!this.el) return
    this.el.innerHTML = this.buildContent(false)
  }

  private buildContent(done: boolean): string {
    if (done) {
      return `
        <span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;color:#4ade80;font-size:16px;">✓</span>
        <span>翻译完成</span>
      `
    }

    const pct = this.total > 0 ? Math.round((this.completed / this.total) * 100) : 0
    return `
      <span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;">
        <svg width="16" height="16" viewBox="0 0 16 16" style="animation: suiyi-progress-spin 0.8s linear infinite;">
          <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          <circle cx="8" cy="8" r="6" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="20" stroke-linecap="round"/>
        </svg>
      </span>
      <span>正在翻译 ${pct}%</span>
    `
  }

  private clearFinishTimer(): void {
    if (this.finishTimer) {
      clearTimeout(this.finishTimer)
      this.finishTimer = null
    }
  }

  // ========== 样式注入 ==========

  private injectStyle(): void {
    if (this.styleInjected) return
    const styleId = 'suiyi-progress-bar-style'
    if (document.getElementById(styleId)) {
      this.styleInjected = true
      return
    }

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes suiyi-progress-spin {
        to { transform: rotate(360deg); }
      }
    `
    document.head.appendChild(style)
    this.styleInjected = true
  }
}
