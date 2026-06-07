// 悬停翻译工具条渲染 — 鼠标悬停在文本上自动翻译
import type { PlasmoCSConfig } from 'plasmo'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_end',
}

// ==================== 悬停检测 ====================

let hoverTimer: ReturnType<typeof setTimeout> | null = null
let hoverTooltip: HTMLDivElement | null = null
let isTranslating = false
let lastHoveredText = ''

function getOrCreateHoverTooltip(): HTMLDivElement {
  if (hoverTooltip) return hoverTooltip

  hoverTooltip = document.createElement('div')
  hoverTooltip.id = 'suiyi-hover-tooltip'
  hoverTooltip.setAttribute('style', `
    position: fixed;
    z-index: 2147483646;
    background: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    padding: 10px 14px;
    max-width: 320px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    display: none;
  `)

  document.body.appendChild(hoverTooltip)
  return hoverTooltip
}

function showHoverTooltip(x: number, y: number): void {
  const tip = getOrCreateHoverTooltip()
  tip.style.left = `${x}px`
  tip.style.top = `${y}px`
  tip.style.display = 'block'
}

function setHoverTooltipContent(original: string, translated: string): void {
  const tip = getOrCreateHoverTooltip()
  tip.innerHTML = `
    <div style="color: #6c757d; font-size: 12px; margin-bottom: 4px;">${escapeHtml(original)}</div>
    <div style="color: #4f46e5; font-weight: 500;">${escapeHtml(translated)}</div>
  `
}

function setHoverTooltipLoading(): void {
  const tip = getOrCreateHoverTooltip()
  tip.textContent = '⏳ 翻译中...'
}

function hideHoverTooltip(): void {
  if (hoverTooltip) {
    hoverTooltip.style.display = 'none'
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// ==================== 悬停事件 ====================

document.addEventListener('mouseover', (e) => {
  const target = e.target as HTMLElement

  // 跳过自己的 tooltip
  if (target.closest('#suiyi-hover-tooltip') || target.closest('#suiyi-selection-tooltip')) {
    return
  }

  // 获取直接文本内容 (不包含子元素文本)
  const directText = getDirectText(target)

  if (directText && directText.length > 2 && directText.length < 500 && isTranslatable(directText)) {
    if (directText === lastHoveredText) return

    hoverTimer = setTimeout(() => {
      lastHoveredText = directText
      translateAndShow(directText, e.clientX, e.clientY + 20)
    }, 800) // 悬停 800ms 后触发
  }
})

document.addEventListener('mouseout', (e) => {
  const target = e.target as HTMLElement
  if (target.closest('#suiyi-hover-tooltip')) return

  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  // 延迟隐藏，用户可能移动到 tooltip 上
  setTimeout(() => {
    if (!hoverTooltip?.matches(':hover')) {
      hideHoverTooltip()
      lastHoveredText = ''
    }
  }, 100)
})

// tooltip 自身不触发翻译
document.addEventListener('mouseover', (e) => {
  if ((e.target as HTMLElement).closest('#suiyi-hover-tooltip')) {
    if (hoverTimer) {
      clearTimeout(hoverTimer)
      hoverTimer = null
    }
  }
}, true)

// ==================== 辅助函数 ====================

function getDirectText(element: HTMLElement): string | null {
  // 跳过特定的非文本元素
  const tag = element.tagName.toLowerCase()
  if (['script', 'style', 'code', 'pre', 'img', 'svg', 'canvas', 'input', 'textarea', 'select'].includes(tag)) {
    return null
  }

  // 获取直接文本节点
  let text = ''
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || ''
    }
  }
  return text.trim() || null
}

function isTranslatable(text: string): boolean {
  return /[一-鿿぀-ゟ゠-ヿa-zA-ZЀ-ӿ؀-ۿ]/.test(text)
}

async function translateAndShow(text: string, x: number, y: number): Promise<void> {
  if (isTranslating) return

  isTranslating = true
  showHoverTooltip(x, y)
  setHoverTooltipLoading()

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_TEXT',
      payload: {
        text,
        from: 'auto',
        to: 'zh-CN',
      },
    })

    if (response?.success && response.data) {
      setHoverTooltipContent(text, response.data.translated)
    } else {
      hideHoverTooltip()
    }
  } catch {
    hideHoverTooltip()
  } finally {
    isTranslating = false
  }
}

console.log('[Suiyi] Tooltip renderer content script loaded')
