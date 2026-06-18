// 页面翻译注入内容脚本 — 双语对照翻译
import type { PlasmoCSConfig } from 'plasmo'
import { sendMessage } from '../lib/messaging'
import { TranslatedSegment, type ParagraphTextSegment, type Segment } from '../lib/text-parser'
import { textParser } from '../lib/text-parser-service'
import { partition } from '../lib/batch-utils'
import { $ } from '../lib/dom-utils'
import { siteConfigManager } from '../lib/site-configs'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_idle',
}

// ==================== 翻译状态 ====================

let isTranslating = false
const TRANSLATED_ATTR = 'data-suiyi-translated'
const PARENT_TRANSLATED_ATTR = 'data-suiyi-has-translation'

// ==================== 消息监听 ====================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXECUTE_PAGE_TRANSLATE') {
    if (isTranslating) {
      sendResponse({ success: false, error: 'Translation already in progress' })
      return false
    }
    translatePage(message.payload)
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
    const count = restorePage()
    sendResponse({ success: true, data: { count } })
    notifyStatus('restored')
    return false
  }

  return false
})

// ==================== 通知 Background 状态 ====================

function notifyStatus(status: 'translated' | 'restored'): void {
  sendMessage('PAGE_TRANSLATION_STATUS', { status }).catch(() => {})
}

// ==================== 页面翻译 ====================

async function translatePage(payload: {
  from: string
  to: string
  engine?: string
}): Promise<number> {
  const { from, to, engine } = payload
  console.log(`[Suiyi CS] Translating page: ${from} → ${to} via ${engine || 'default'}`)
  isTranslating = true

  try {
    let segments = textParser.parse(document.body, 'paragraph')
    segments = siteConfigManager.handle(segments, location.href)
    const translatedSegments = await translateSegment(segments, from, to, engine)
    console.log(`[Suiyi CS] Translated ${translatedSegments.length} segments, injecting into page...`, translatedSegments)
    return injectBilingual(translatedSegments)
  } finally {
    isTranslating = false
  }
}


async function translateSegment(segments: Segment[], from: string, to: string, engine?: string): Promise<TranslatedSegment[]> {
  const translationMap = new Map<string, string>()
  const texts = segments.map((s) => s.text)
  for (const batch of partition(texts, 1000)) {
    try {
      const response = await sendMessage('BATCH_TRANSLATE_TEXT', { texts: batch, from, to, engine })
      if (response?.success && response.data) {
        const results = response.data as Record<string, string>
        for (const [original, translated] of Object.entries(results)) {
          if (translated) translationMap.set(original, translated)
        }
      }
    } catch (err) {
      console.warn('[Suiyi CS] Batch translate failed, trying individual fallback...', err)
      for (const text of batch) {
        try {
          const r = await sendMessage('TRANSLATE_TEXT', { text, from, to, engine })
          if (r?.success && r.data) {
            translationMap.set(text, (r.data as { translated: string }).translated)
          }
        } catch { /* skip */ }
      }
    }
  }

  return segments
    .filter((s) => translationMap.has(s.text))
    .map((s) => new TranslatedSegment(s, translationMap.get(s.text)!))
}

// ==================== 双语注入 ====================

function injectBilingual(  translatedSegments: TranslatedSegment[]): number {
  let count = 0
  for (const seg of translatedSegments) {
    if (!seg.topNode.parentNode) continue
    try {
      // 创建译文（放在原文下方）
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
      // 标记译文，还原时通过此标识清除
      translatedEl.setAttribute(TRANSLATED_ATTR, '')
      // 原文文本节点不动，译文插入到后面
      const parent = seg.topNode.parentNode
      parent.insertBefore(translatedEl, seg.topNode.nextSibling)
      // 给父节点添加标记，表示其子节点中有译文，方便后续处理
      if (parent instanceof Element) {
        parent.setAttribute(PARENT_TRANSLATED_ATTR, '')
      }
      count++
    } catch {
      // DOM 操作失败，跳过
      console.warn('[Suiyi CS] Failed to inject translation for segment:', seg)
    }
  }
  return count
}

// ==================== 还原原文 ====================

function restorePage(): number {
  // 还原：移除所有译文元素，原文文本节点未动无需恢复
  const els = $(`suiyi-translated[${TRANSLATED_ATTR}]`)
  const count = els.length
  els.remove()
  console.log(`[Suiyi CS] Restored ${count} translations`)
  return count
}

console.log('[Suiyi] Page translator content script loaded')
