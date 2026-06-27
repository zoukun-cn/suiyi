// 骨架屏占位提示样式 — 翻译前在每个段落下方显示占位动画

import type { TranslationTipStyle } from '../translation-tip-style'
import type { TranslatedSegment } from '../text-parser'
import type { Segment } from '../text-parser'

const SKELETON_TAG = 'suiyi-skeleton'
const SKELETON_ATTR = 'data-suiyi-skeleton'
const STYLE_ID = 'suiyi-skeleton-style'

export class SkeletonTipStyle implements TranslationTipStyle {
  readonly id = 'skeleton'
  readonly name = '骨架屏占位动画'

  private currentSkeletons: HTMLElement[] = []
  private styleInjected = false

  // ========== TranslationTipStyle 实现 ==========

  showTranslatingTipStyle(segments: Segment[]): void {
    console.log(`[SkeletonTipStyle] showTranslatingTipStyle: ${segments.length} segments`)
    this.injectStyle()

    for (const seg of segments) {
      const topNode = seg.topNode
      if (!topNode.parentNode) continue

      // 跳过已有骨架的节点
      if (this.hasSkeletonAfter(topNode)) continue

      const skeleton = this.createSkeleton(seg)
      topNode.parentNode.insertBefore(skeleton, topNode.nextSibling)
      this.currentSkeletons.push(skeleton)
    }
  }

  updateProgress(_translatedSegments: TranslatedSegment[]): void {
    console.log(`[SkeletonTipStyle] updateProgress: ${_translatedSegments.length} segments`)
    // 骨架屏无需进度更新（全部完成后一次性替换）
  }

  showTranslatedTipStyle(_success: boolean): void {
    console.log(`[SkeletonTipStyle] showTranslatedTipStyle: ${_success}`)
    this.removeCurrentSkeletons()
  }

  // ========== 内部方法 ==========

  private createSkeleton(seg: Segment): HTMLElement {
    const el = document.createElement(SKELETON_TAG)
    el.setAttribute(SKELETON_ATTR, '')

    // 估算原文高度：尝试从 topNode 获取行高或默认 1.2em
    const topNode = seg.topNode
    let lineHeight = '1.2em'
    if (topNode instanceof Element) {
      const computed = window.getComputedStyle(topNode)
      const lh = parseFloat(computed.lineHeight)
      if (!isNaN(lh)) {
        lineHeight = computed.lineHeight // 保留单位（px 或 相对值）
      }
    }

    el.style.cssText = `
      display: block;
      height: ${lineHeight};
      margin: 2px 0;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.15);
      opacity: 0.6;
      animation: suiyi-skeleton-pulse 1.5s ease-in-out infinite;
      position: relative;
      overflow: hidden;
    `

    // 左侧旋转加载圆圈
    const spinner = document.createElement('span')
    spinner.style.cssText = `
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      border: 2px solid rgba(128, 128, 128, 0.2);
      border-top-color: rgba(128, 128, 128, 0.5);
      border-radius: 50%;
      animation: suiyi-skeleton-spin 0.8s linear infinite;
    `
    el.appendChild(spinner)

    return el
  }

  private hasSkeletonAfter(node: Node): boolean {
    const next = node.nextSibling
    return next instanceof HTMLElement
      && next.tagName === SKELETON_TAG.toUpperCase()
      && next.hasAttribute(SKELETON_ATTR)
  }

  private removeCurrentSkeletons(): void {
    for (const el of this.currentSkeletons) {
      el.remove()
    }
    this.currentSkeletons = []
  }

  // ========== 样式注入 ==========

  private injectStyle(): void {
    if (this.styleInjected) return
    if (document.getElementById(STYLE_ID)) {
      this.styleInjected = true
      return
    }

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      @keyframes suiyi-skeleton-pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.8; }
      }
      @keyframes suiyi-skeleton-spin {
        to { transform: translateY(-50%) rotate(360deg); }
      }
    `
    document.head.appendChild(style)
    this.styleInjected = true
  }

}
