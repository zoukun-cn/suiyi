// 划词翻译内容脚本 — 选中文本后弹出翻译工具条
import type { PlasmoCSConfig } from 'plasmo'
import { sendMessage } from '../lib/messaging'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_end',
}

// ==================== 工具条 DOM ====================

let tooltip: HTMLDivElement | null = null

function getOrCreateTooltip(): HTMLDivElement {
  if (tooltip) return tooltip

  tooltip = document.createElement('div')
  tooltip.id = 'suiyi-selection-tooltip'
  tooltip.setAttribute('style', `
    position: fixed;
    z-index: 2147483647;
    background: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    padding: 12px 16px;
    max-width: 360px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    display: none;
    color: #1a1a2e;
  `)

  document.body.appendChild(tooltip)
  return tooltip
}

function showTooltip(x: number, y: number, text: string): void {
  const tip = getOrCreateTooltip()
  tip.textContent = text
  tip.style.left = `${x}px`
  tip.style.top = `${y + 12}px`
  tip.style.display = 'block'
}

function hideTooltip(): void {
  if (tooltip) {
    tooltip.style.display = 'none'
  }
}

// ==================== 选区处理 ====================

let debounceTimer: ReturnType<typeof setTimeout> | null = null

document.addEventListener('mouseup', () => {
  const selection = window.getSelection()
  const text = selection?.toString().trim()

  if (!text || text.length < 2 || text.length > 1000) {
    hideTooltip()
    return
  }

  // 获取选区位置
  const range = selection?.getRangeAt(0)
  if (!range) return

  const rect = range.getBoundingClientRect()
  if (!rect) return

  // 防抖：避免快速多次选词
  if (debounceTimer) clearTimeout(debounceTimer)

  debounceTimer = setTimeout(async () => {
    try {
      const response = await sendMessage('TRANSLATE_TEXT', {
        text,
        from: 'auto',
        to: 'zh-CN',
      })

      if (response?.success && response.data) {
        const translated = (response.data as { translated: string }).translated
        showTooltip(
          rect.left + window.scrollX,
          rect.bottom + window.scrollY,
          translated
        )
      }
    } catch {
      // 翻译失败，静默处理
    }
  }, 300) // 300ms 防抖
})

// 点击其他位置隐藏工具条
document.addEventListener('mousedown', (e) => {
  if (tooltip && !tooltip.contains(e.target as Node)) {
    hideTooltip()
  }
})

console.log('[Suiyi] Selection handler content script loaded')
