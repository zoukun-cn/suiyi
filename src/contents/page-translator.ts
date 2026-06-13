// 页面翻译注入内容脚本 — 双语对照翻译
import type { PlasmoCSConfig } from 'plasmo'
import { sendMessage } from '../lib/messaging'
import { extractTranslatableSegmentsByParagraph, SKIP_SELECTOR } from '../lib/text-parser'
import { partition } from '../lib/batch-utils'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_idle',
}

// ==================== 翻译状态 ====================

let isTranslating = false
const TRANSLATED_ATTR = 'data-suiyi-translated'

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
    const segments = extractTranslatableSegmentsByParagraph(document.body)
    const texts = segments.map((s) => s.text)
    const translationMap = new Map<string, string>()

    for (const batch of partition(texts, 1000)) {
      try {
        const response = await sendMessage('BATCH_TRANSLATE_TEXT', {texts: batch, from, to, engine})
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

    // 注入译文
    return injectBilingual(segments, translationMap)
  } finally {
    isTranslating = false
  }
}

// ==================== 双语注入 ====================

function injectBilingual(
  segments: ReturnType<typeof extractTranslatableSegmentsByParagraph>,
  translationMap: Map<string, string>
): number {
  let count = 0

  for (const seg of segments) {
    const translation = translationMap.get(seg.text)
    if (!translation) continue

    const el = seg.node.parentElement
    if (!el) continue

    // 检查文本节点还在 DOM 中
    if (!seg.node.parentNode) continue

    try {
      // 创建译文（放在原文下方）
      const translatedEl = document.createElement('suiyi-translated')
      translatedEl.textContent = translation
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
      seg.paragraphNode.after(translatedEl)
      count++
    } catch {
      // DOM 操作失败，跳过
    }
  }

  return count
}

// ==================== 还原原文 ====================

function restorePage(): number {
  let count = 0

  // 还原：移除所有译文元素，原文文本节点未动无需恢复
  document.querySelectorAll(`suiyi-translated[${TRANSLATED_ATTR}]`).forEach((el) => {
    el.remove()
    count++
  })

  console.log(`[Suiyi CS] Restored ${count} translations`)
  return count
}

console.log('[Suiyi] Page translator content script loaded')
