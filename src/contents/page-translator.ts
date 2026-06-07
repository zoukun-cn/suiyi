// 页面翻译注入内容脚本 — 双语对照翻译
import type { PlasmoCSConfig } from 'plasmo'
import { sendMessage } from '../lib/messaging'
import { extractTranslatableSegments } from '../lib/text-parser'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_idle',
}

// ==================== 翻译状态 ====================

let isTranslating = false
const translatedCache = new Map<string, string>()
const TRANSLATED_ATTR = 'data-suiyi-translated'

// ==================== Toast ====================

let toast: HTMLDivElement | null = null

function getOrCreateToast(): HTMLDivElement {
  if (toast) return toast
  toast = document.createElement('div')
  toast.id = 'suiyi-toast'
  toast.setAttribute('style', `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    background: #1a1a2e;
    color: #ffffff;
    padding: 10px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    display: none;
    pointer-events: none;
  `)
  document.body.appendChild(toast)
  return toast
}

function showToast(text: string, duration = 3000): void {
  const t = getOrCreateToast()
  t.textContent = text
  t.style.display = 'block'
  setTimeout(() => { t.style.display = 'none' }, duration)
}

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
    const segments = extractTranslatableSegments(document.body)
    const texts = segments.map((s) => s.text)

    console.log(`[Suiyi CS] Found ${segments.length} translatable segments`)

    showToast(`正在翻译... 0/${texts.length}`)

    // 分批翻译
    const batchSize = 10
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)

      for (const text of batch) {
        if (translatedCache.has(text)) continue

        try {
          const response = await sendMessage('TRANSLATE_TEXT', { text, from, to, engine })
          if (response?.success && response.data) {
            translatedCache.set(text, (response.data as { translated: string }).translated)
          }
        } catch {
          // 单条失败继续
          console.warn(`[Suiyi CS] Failed to translate segment: "${text.slice(0, 50)}..."`)
        }
      }

      // 更新进度
      const done = Math.min(i + batchSize, texts.length)
      showToast(`正在翻译... ${done}/${texts.length}`, 0)
    }

    // 注入译文
    const count = injectBilingual(segments)
    showToast(`翻译完成 (${count} 处)`)
    console.log(`[Suiyi CS] Injected ${count} translations`)
    return count
  } finally {
    isTranslating = false
  }
}

// ==================== 双语注入 ====================

function injectBilingual(
  segments: ReturnType<typeof extractTranslatableSegments>
): number {
  let count = 0

  for (const seg of segments) {
    const translation = translatedCache.get(seg.text)
    if (!translation) continue

    const parent = seg.node.parentElement
    if (!parent) continue

    // 跳过不可翻译元素的父节点
    const tag = parent.tagName.toLowerCase()
    if (['script', 'style', 'code', 'pre', 'noscript', 'textarea'].includes(tag)) continue

    // 跳过已经翻译的
    if (parent.hasAttribute(TRANSLATED_ATTR)) continue

    // 检查文本节点还在 DOM 中
    if (!seg.node.parentNode) continue

    try {
      // 用 <suiyi-original> 包裹原文
      const originalWrap = document.createElement('suiyi-original')
      originalWrap.textContent = seg.node.textContent
      originalWrap.style.cssText = 'all: inherit; display: inline;'

      // 创建译文
      const translatedEl = document.createElement('suiyi-translated')
      translatedEl.textContent = translation
      translatedEl.style.cssText = `
        display: inline;
        color: #4338ca;
        background: rgba(99, 102, 241, 0.08);
        border-bottom: 1px dashed rgba(99, 102, 241, 0.4);
        margin-left: 2px;
        font-style: italic;
        font-size: 0.95em;
        border-radius: 2px;
        padding: 0 1px;
      `

      // 替换原文文本节点为 original wrap
      seg.node.replaceWith(originalWrap)
      // 在原文后插入译文
      originalWrap.after(translatedEl)

      // 标记父元素
      parent.setAttribute(TRANSLATED_ATTR, '')
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

  // 移除译文
  document.querySelectorAll('suiyi-translated').forEach((el) => {
    el.remove()
    count++
  })

  // 解包原文：把 <suiyi-original> 的文本内容还原为裸文本节点
  document.querySelectorAll('suiyi-original').forEach((el) => {
    const text = el.textContent || ''
    const textNode = document.createTextNode(text)
    el.replaceWith(textNode)
  })

  // 清除标记
  document.querySelectorAll(`[${TRANSLATED_ATTR}]`).forEach((el) => {
    el.removeAttribute(TRANSLATED_ATTR)
  })

  // 清理 toast
  if (toast) {
    toast.remove()
    toast = null
  }

  translatedCache.clear()

  showToast('已还原原文')
  console.log(`[Suiyi CS] Restored ${count} translations`)
  return count
}

console.log('[Suiyi] Page translator content script loaded')
