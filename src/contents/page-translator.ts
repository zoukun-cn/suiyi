// 页面翻译注入内容脚本 — 双语对照翻译
import type { PlasmoCSConfig } from 'plasmo'
import { extractTranslatableSegments, isTranslatable } from '../lib/text-parser'
import { debounce } from '../lib/dom-utils'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_idle',
}

// ==================== 翻译状态 ====================

let isTranslating = false
const translatedCache = new Map<string, string>()
const TRANSLATED_ATTR = 'data-suiyi-translated'

// ==================== 消息监听 ====================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TRANSLATE_PAGE') {
    if (isTranslating) {
      sendResponse({ success: false, error: 'Translation already in progress' })
      return false
    }
    translatePage(message.payload)
      .then((count) => sendResponse({ success: true, data: { count } }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (message.type === 'EXECUTE_PAGE_TRANSLATE') {
    translatePage(message.payload)
      .then((count) => sendResponse({ success: true, data: { count } }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  return false
})

// ==================== 页面翻译 ====================

async function translatePage(payload: {
  from: string
  to: string
  engine?: string
}): Promise<number> {
  const { from, to, engine } = payload
  console.log(`[Suiyi CS] Translating page: ${from} → ${to} via ${engine || 'default'}`)

  isTranslating = true
  let translatedCount = 0

  try {
    // 提取页面可翻译文本
    const segments = extractTranslatableSegments(document.body)
    const texts = segments.map((s) => s.text)

    console.log(`[Suiyi CS] Found ${segments.length} translatable segments`)

    // 批量翻译 (逐步处理，避免请求过大)
    const batchSize = 10

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)

      for (const text of batch) {
        if (translatedCache.has(text)) continue

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'TRANSLATE_TEXT',
            payload: { text, from, to, engine },
          })

          if (response?.success && response.data) {
            translatedCache.set(text, response.data.translated)
          }
        } catch {
          // 单条失败继续
        }
      }
    }

    // 注入译文到页面
    translatedCount = injectTranslations(segments)
    console.log(`[Suiyi CS] Injected ${translatedCount} translations`)
  } finally {
    isTranslating = false
  }

  return translatedCount
}

// ==================== 译文注入 ====================

function injectTranslations(
  segments: ReturnType<typeof extractTranslatableSegments>
): number {
  let count = 0

  for (const seg of segments) {
    const translation = translatedCache.get(seg.text)
    if (!translation || !isTranslatable(seg.text)) continue

    const parent = seg.node.parentElement
    if (!parent || parent.hasAttribute(TRANSLATED_ATTR)) continue

    // 创建译文容器
    const translateEl = document.createElement('suiyi-translate')
    translateEl.setAttribute('style', `
      display: inline;
      color: #6366f1;
      background: rgba(99, 102, 241, 0.06);
      border-bottom: 1px dashed rgba(99, 102, 241, 0.3);
      margin-left: 2px;
      font-style: italic;
    `)
    translateEl.textContent = translation
    translateEl.title = seg.text // 原文作为 tooltip

    // 在文本节点后插入译文
    if (seg.node.parentNode) {
      seg.node.after(translateEl)
      parent.setAttribute(TRANSLATED_ATTR, '')
      count++
    }
  }

  return count
}

// ==================== 清除翻译 ====================

function clearAllTranslations(): void {
  document.querySelectorAll('suiyi-translate').forEach((el) => el.remove())
  document.querySelectorAll(`[${TRANSLATED_ATTR}]`).forEach((el) =>
    el.removeAttribute(TRANSLATED_ATTR)
  )
  translatedCache.clear()
}

console.log('[Suiyi] Page translator content script loaded')
