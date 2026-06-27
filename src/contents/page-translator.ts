// 页面翻译注入内容脚本 — 双语对照翻译（支持滚动动态内容）
import type { PlasmoCSConfig } from 'plasmo'
import { sendMessage } from '../lib/messaging'
import { TranslatedSegment, type ParagraphTextSegment, type Segment } from '../lib/text-parser'
import { textParser } from '../lib/text-parser-service'
import { partition } from '../lib/batch-utils'
import { $ } from '../lib/dom-utils'
import { siteConfigManager } from '../lib/site-configs'
import { observeMutations } from '../services/dom-injector'
import { TipStyleManager } from '../lib/tip-style-manager'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_idle',
}

// ==================== 常量 ====================

const TRANSLATED_ATTR = 'data-suiyi-translated'
const PARENT_TRANSLATED_ATTR = 'data-suiyi-has-translation'

// ==================== 翻译管道（纯函数） ====================

/** 批量翻译 segments，支持进度回调（每批完成后传出已翻译的 TranslatedSegment[]） */
async function translateSegments(
  segments: Segment[],
  from: string,
  to: string,
  engine?: string,
  onBatchComplete?: (translated: TranslatedSegment[]) => void,
): Promise<TranslatedSegment[]> {
  const translatedResult: TranslatedSegment[] = [];

  for (const batch of partition(segments, 40)) {
    const texts = batch.map((s) => s.text)
    try {
      const response = await sendMessage('BATCH_TRANSLATE_TEXT', { texts, from, to, engine })
      if (response?.success && response.data) {
        const results = response.data as Record<string, string>
        const batchResults = parseBatchTranslatedResult(batch, results)
        batchResults.forEach((e) => { translatedResult.push(e) })
        onBatchComplete?.(batchResults)
      }
    } catch (err) {
      console.warn('[Suiyi CS] Batch translate failed, trying individual fallback...', err)
    }
  }

  function parseBatchTranslatedResult(orginSegment: Segment[], res: Record<string, string>): TranslatedSegment[]{
      const translationMap = new Map<string, string>()
      for (const [original, translated] of Object.entries(res)) {
          if (translated) translationMap.set(original, translated)
      }
    return orginSegment
    .filter((s) => translationMap.has(s.text))
    .map((s) => new TranslatedSegment(s, translationMap.get(s.text)!))
  }

  return translatedResult;
}

/** 将译文注入 DOM，插入到原文节点之后 */
function injectBilingual(translatedSegments: TranslatedSegment[], translatedBlocks?: WeakSet<Element>): number {
  let count = 0
  for (const seg of translatedSegments) {
    if (!seg.topNode.parentNode) continue
    try {
      const translatedEl = document.createElement('suiyi-translated')
      translatedEl.textContent = seg.translated
      translatedEl.style.cssText = `
        display: block;
        color: #4338ca;
        margin: 2px 0;
        font-style: italic;
        font-size: 0.92em;
        border-radius: 0 4px 4px 0;
      `
      translatedEl.setAttribute(TRANSLATED_ATTR, '')
      const parent = seg.topNode.parentNode
      parent.insertBefore(translatedEl, seg.topNode.nextSibling)
      if (parent instanceof Element) {
        parent.setAttribute(PARENT_TRANSLATED_ATTR, '')
      }
      if (translatedBlocks && seg.topNode instanceof Element) {
        translatedBlocks.add(seg.topNode)
      }
      count++
    } catch {
      console.warn('[Suiyi CS] Failed to inject translation for segment:', seg)
    }
  }
  return count
}

// ==================== Background 状态通知 ====================

function notifyStatus(status: 'translated' | 'restored'): void {
  sendMessage('PAGE_TRANSLATION_STATUS', { status }).catch(() => {})
}

// ==================== PageTranslator ====================

class PageTranslator {
  private translatedBlocks = new WeakSet<Element>()
  private inProgressBlocks = new Set<Element>()
  private params: { from: string; to: string; engine?: string } | null = null
  private active = false
  private mutationObserver: MutationObserver | null = null
  private tipStyleManager = new TipStyleManager()

  get isTranslating(): boolean {
    return this.active
  }

  // ========== 启动 ==========

  async start(payload: { from: string; to: string; engine?: string }): Promise<number> {
    const { from, to, engine } = payload
    console.log(`[Suiyi CS] Translating page: ${from} → ${to} via ${engine || 'default'}`)
    this.active = true
    this.params = { from, to, engine }

    try {
      // 0. 根据设置注册启用的提示样式
      await this.tipStyleManager.initByUserSettings()

      // 1. 解析全页段落
      let segments = textParser.parse(document.body, 'paragraph')
      segments = siteConfigManager.handle(segments, location.href)

      // 2. 启动提示样式
      this.tipStyleManager.showTranslatingTipStyle(segments)

      // 3. 分批翻译，每批完成立即注入 DOM 并更新进度
      let count = 0
      await translateSegments(segments, from, to, engine, (batchTranslated) => {
        this.tipStyleManager.updateProgress(batchTranslated)
        count += injectBilingual(batchTranslated, this.translatedBlocks)
      })

      // 4. 翻译完成，移除提示样式
      this.tipStyleManager.showTranslatedTipStyle(true)

      console.log(`[Suiyi CS] ${count} blocks translated`)

      // 5. 监听动态内容（滚动加载、SPA 切换）
      this.setupMutationObserver()
      return count
    } catch (err) {
      // 翻译失败，清理提示元素（不显示 ✓）
      this.tipStyleManager.showTranslatedTipStyle(false)
      this.stop()
      throw err
    }
  }

  // ========== 还原 ==========

  stop(): number {
    this.active = false

    this.mutationObserver?.disconnect()
    this.mutationObserver = null

    // 清理提示样式
    this.tipStyleManager.showTranslatedTipStyle(false)

    const els = $(`suiyi-translated[${TRANSLATED_ATTR}]`)
    const count = els.length
    els.remove()

    this.translatedBlocks = new WeakSet()
    this.inProgressBlocks.clear()
    this.params = null

    console.log(`[Suiyi CS] Restored ${count} translations`)
    return count
  }

  // ========== MutationObserver ==========

  private setupMutationObserver(): void {
    this.mutationObserver = observeMutations((addedNodes) => {
      if (!this.active) return
      console.log(`[Suiyi CS] Detected ${addedNodes.length} new nodes, checking for translatable content...`)
      const { from, to, engine } = this.params!
      const newSegments: ParagraphTextSegment[] = []

      for (const node of addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue
        const el = node as Element

        // 过滤自注入的译文元素和提示元素
        if (
          el.tagName === 'SUIYI-TRANSLATED'
          || el.hasAttribute(TRANSLATED_ATTR)
          || el.tagName === 'SUIYI-SKELETON'
          || el.hasAttribute('data-suiyi-skeleton')
          || el.tagName === 'SUIYI-PROGRESS-BAR'
          || el.hasAttribute('data-suiyi-progress-bar')
        ) continue

        // 解析新增子树
        let segs = textParser.parse(el, 'paragraph')
        segs = siteConfigManager.handle(segs, location.href)

        for (const seg of segs) {
          const top = seg.topNode
          if (!(top instanceof Element)) continue
          if (this.translatedBlocks.has(top) || this.inProgressBlocks.has(top)) continue

          // 父节点已有译文 → 内容更新，清除旧译文
          if (top.parentElement?.hasAttribute(PARENT_TRANSLATED_ATTR)) {
            top.parentElement
              .querySelectorAll(`suiyi-translated[${TRANSLATED_ATTR}]`)
              .forEach((e) => e.remove())
          }

          newSegments.push(seg as ParagraphTextSegment)
        }
      }

      if (newSegments.length === 0) return

      // 启动提示样式（动态内容：追加骨架屏、累加进度条总数）
      this.tipStyleManager.showTranslatingTipStyle(newSegments)

      // 标记新增段为进行中（取首个节点作为代表）
      if (newSegments[0]?.topNode instanceof Element) {
        this.inProgressBlocks.add(newSegments[0].topNode)
      }
      translateSegments(newSegments, from, to, engine, (batchTranslated) => {
        // 每批完成立即注入 DOM 并更新进度
        this.tipStyleManager.updateProgress(batchTranslated)
        injectBilingual(batchTranslated, this.translatedBlocks)
      })
        .then(() => {
          if (!this.active) return
          // 翻译完成，移除新内容的提示样式
          this.tipStyleManager.showTranslatedTipStyle(true)
          cleanupInProgress()
        })
        .catch(() => {
          // 失败时清理提示元素
          this.tipStyleManager.showTranslatedTipStyle(false)
          cleanupInProgress()
        })

      const cleanupInProgress = (): void => {
        for (const seg of newSegments) {
          if (seg.topNode instanceof Element) {
            this.inProgressBlocks.delete(seg.topNode)
          }
        }
      }
    })
  }

}

// ==================== 单例 & 消息监听 ====================

const translator = new PageTranslator()

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXECUTE_PAGE_TRANSLATE') {
    if (translator.isTranslating) {
      sendResponse({ success: false, error: 'Translation already in progress' })
      return false
    }
    translator
      .start(message.payload)
      .then((count) => {
        sendResponse({ success: true, data: { count } })
        notifyStatus('translated')
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === 'RESTORE_PAGE') {
    const count = translator.stop()
    sendResponse({ success: true, data: { count } })
    notifyStatus('restored')
    return false
  }

  return false
})

console.log('[Suiyi] Page translator content script loaded')
