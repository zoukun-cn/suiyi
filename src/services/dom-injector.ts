// DOM 注入服务 — 网页内双语对照翻译的渲染

/** 已翻译节点的标记属性 */
const TRANSLATED_ATTR = 'data-suiyi-translated'

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
