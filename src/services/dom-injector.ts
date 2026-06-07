// DOM 注入服务 — 网页内双语对照翻译的渲染
import { extractTranslatableSegments, isTranslatable } from '../lib/text-parser'

/** 已翻译节点的标记属性 */
const TRANSLATED_ATTR = 'data-suiyi-translated'

/**
 * 在页面上执行双语对照翻译
 * 在原文节点之后插入译文
 */
export async function injectBilingualTranslation(
  translatedMap: Map<string, string>
): Promise<number> {
  let injected = 0

  const segments = extractTranslatableSegments(document.body)

  for (const seg of segments) {
    const translation = translatedMap.get(seg.text)
    if (!translation || !isTranslatable(seg.text)) continue

    const parent = seg.node.parentElement
    if (!parent) continue

    // 检查是否已经翻译过
    if (parent.hasAttribute(TRANSLATED_ATTR)) continue

    // 创建译文容器
    const translateEl = document.createElement('suiyi-translate')
    translateEl.textContent = translation
    translateEl.style.cssText = `
      display: inline;
      color: #6366f1;
      background: rgba(99, 102, 241, 0.06);
      border-bottom: 1px dashed rgba(99, 102, 241, 0.3);
      margin-left: 2px;
      font-style: italic;
    `

    // 标记已翻译
    parent.setAttribute(TRANSLATED_ATTR, 'true')

    // 在原文后插入译文 (简单策略：替换文本节点的父元素内容)
    // 更精确的实现需要在 text node 级别操作
    if (seg.node.parentElement) {
      seg.node.parentElement.append(translateEl)
      injected++
    }
  }

  return injected
}

/**
 * 清除页面上的所有翻译注入
 */
export function clearTranslations(): number {
  const elements = document.querySelectorAll(`[${TRANSLATED_ATTR}]`)
  elements.forEach((el) => el.removeAttribute(TRANSLATED_ATTR))

  const translateEls = document.querySelectorAll('suiyi-translate')
  let count = translateEls.length
  translateEls.forEach((el) => el.remove())

  return count
}

/**
 * 监听 DOM 变化，对新内容自动翻译
 */
export function observeMutations(
  onNewContent: (addedNodes: NodeList) => void
): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        onNewContent(mutation.addedNodes)
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  return observer
}
