// 页面翻译注入内容脚本 — 双语对照翻译（支持滚动动态内容）
import type { PlasmoCSConfig } from 'plasmo'
import { sendMessage } from '../lib/messaging'
import { TranslatedSegment, type ParagraphTextSegment, type Segment } from '../lib/text-parser'
import { textParser } from '../lib/text-parser-service'
import { partition } from '../lib/batch-utils'
import { $ } from '../lib/dom-utils'
import { SiteConfigManager } from '../lib/site-config-util'
import { observeMutations } from '../services/dom-injector'
import { TipStyleManager } from '../lib/tip-style-manager'
import { ViewportSegmentFilter } from '../lib/viewport-filter'

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
  private translatedCount = 0
  private inProgressBlocks = new Set<Element>()
  private params: { from: string; to: string; engine?: string;} = { from:"", to:"" }
  private active = false
  private tipStyleManager = new TipStyleManager()
  private siteConfigs: import('../lib/site-config-util').SiteConfig[] = []
  private filter: ViewportSegmentFilter =  new ViewportSegmentFilter({
    listener: {
      batchSize: 30,
      batchTimeout: 100,
      onBatch: (batch) => this.translate(batch)
    },
  })

  private async translate(segments: Segment[]): Promise<void> {
    console.log(`[Suiyi CS] Translating page, segment count : ${segments.length}`)
    this.showTranslatingTipStyle(segments)
    await translateSegments(segments, this.params.from, this.params.to, this.params.engine,
      (batchTranslated) => {
        this.tipStyleManager.updateProgress(batchTranslated)
        this.translatedCount += injectBilingual(batchTranslated, this.translatedBlocks)
      },
    )
  }

  get isTranslating(): boolean {
    return this.active
  }

  async init(payload: { from: string; to: string; engine?: string; siteConfigs?: import('../lib/site-config-util').SiteConfig[] }) : Promise<PageTranslator> {
    await this.tipStyleManager.initByUserSettings()
    const { from, to, engine, siteConfigs } = payload
    this.params = { from, to, engine }
    this.siteConfigs = siteConfigs ?? []
    return this
  }

  async parseText() : Promise<Segment[]> {
      let segments = textParser.parse(document.body, 'paragraph')
      segments = new SiteConfigManager(this.siteConfigs).handle(segments, location.href)
      console.log(`[Suiyi CS] Parsed ${segments.length} segments`)
      return segments
  }

  showTranslatingTipStyle(segments: Segment[]): PageTranslator{
     this.tipStyleManager.showTranslatingTipStyle(segments)
     return this;
  }

  // 添加到翻译队列
  async addTranslateQueue(segment:Segment[]) {
    this.filter.add(segment);
  }

  // ========== 启动 ==========

  async start() {
    console.log(`[Suiyi CS] Translating page: ${this.params.from} → ${this.params.to}`)
    this.active = true
    try {
      // 4. 翻译完成，移除提示样式
      // this.tipStyleManager.showTranslatedTipStyle(true)

    } catch (err) {
      this.tipStyleManager.showTranslatedTipStyle(false)
      this.stop()
      throw err
    }
  }

  // ========== 还原 ==========

  stop(): number {
    this.active = false

    // 清理视口过滤器
    this.filter?.destroy()

    // 清理提示样式
    this.tipStyleManager.showTranslatedTipStyle(false)

    const els = $(`suiyi-translated[${TRANSLATED_ATTR}]`)
    const count = els.length
    els.remove()

    this.translatedBlocks = new WeakSet()
    this.translatedCount = 0
    this.inProgressBlocks.clear()
    this.params = { from: '', to: '' }

    console.log(`[Suiyi CS] Restored ${count} translations`)
    return count
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
      .init(message.payload)
      .then(t => t.parseText())
      .then(t => translator.addTranslateQueue(t))
      .then((t) => translator.start())
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
