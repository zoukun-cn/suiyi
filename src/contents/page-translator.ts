// 页面翻译注入内容脚本 — 双语对照翻译（支持滚动动态内容）
import type { PlasmoCSConfig } from 'plasmo'
import { sendMessage } from '../lib/messaging'
import { TranslatedSegment, type ParagraphTextSegment, type Segment } from '../lib/text-parser'
import { textParser } from '../lib/text-parser-service'
import { partition } from '../lib/batch-utils'
import { $ } from '../lib/dom-utils'
import { SiteConfigManager } from '../lib/site-config-util'
import { TipStyleManager } from '../lib/tip-style-manager'
import { ViewportSegmentFilter } from '../lib/viewport-filter'
import { observeMutations } from '../services/dom-injector'

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
  private mutationObserver:MutationObserver|null = null;
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
  async addTranslateQueue(segment:Segment[]):Promise<PageTranslator> {
    this.filter.add(segment);
    return this;
  }

  /** 启 动 MutationObserver，监听 DOM 动态新增内容并自动翻译 */
  enableObserveMutations(listener: (segments: Segment[]) => void): PageTranslator {
    // 复用 init 时缓存的站点配置，动态内容也需要过滤
    const siteMgr = new SiteConfigManager(this.siteConfigs)

    this.mutationObserver = observeMutations((nodes) => {
      // 1. 只处理 Element 节点（MutationObserver 回调可能包含 Text、Comment 等）
      // 2. 跳过已翻译子树（检查 data-suiyi-has-translation 标记 + 内部译文元素）
      // 3. 对每个新 Element 执行段落解析，展平为 Segment[]
      const segments = nodes
        .filter((n): n is Element => n.nodeType === Node.ELEMENT_NODE)
        .filter((el) => !this.isSubtreeTranslated(el))
        .flatMap((el) => textParser.parse(el, 'paragraph'))
        .filter((seg) => seg && !seg.isEmpty())

      if (segments.length === 0) return

      // 应用站点跳过规则（与 parseText 保持一致）
      const filtered = siteMgr.handle(segments, location.href)
      if (filtered.length > 0) {
        console.log(`[Suiyi CS] Dynamic content: ${filtered.length} new segments`)
        listener(filtered)
      }
    })
    return this
  }

  /** 检查元素所在子树是否已被翻译（向上查标记属性 + 向下查注入元素） */
  private isSubtreeTranslated(el: Element): boolean {
    // 向上查：祖先节点是否已标记为已翻译
    let current: Element | null = el
    while (current && current !== document.documentElement) {
      if (current.hasAttribute(PARENT_TRANSLATED_ATTR)) return true
      current = current.parentElement
    }
    // 向下查：子树内是否已注入译文元素（处理父容器整体移动的场景）
    return el.querySelector(`suiyi-translated[${TRANSLATED_ATTR}]`) !== null
  }

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

    this.mutationObserver?.disconnect();
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
      // 开启动态内容监听：MutationObserver 检测 DOM 变化 → 解析新段落 → 送入视口翻译队列
      .then(t => t.enableObserveMutations(s => t.addTranslateQueue(s)))
      .then(t => t.start())
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
