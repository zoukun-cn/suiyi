// DOM 注入服务 — 网页内双语对照翻译的渲染
import { $, debounce } from '../lib/dom-utils'

/** 已翻译节点的标记属性 */
const TRANSLATED_ATTR = 'data-suiyi-translated'

/**
 * 清除页面上的所有翻译注入
 */
export function clearTranslations(): number {
  $(`[${TRANSLATED_ATTR}]`).removeAttr(TRANSLATED_ATTR)
  const translateEls = $('suiyi-translated')
  const count = translateEls.length
  translateEls.remove()
  return count
}

/**
 * 监听 DOM 变化，对新内容自动翻译。
 * 多次 mutation 的 addedNodes 聚合后经 300ms debounce 统一回调。
 */
export function observeMutations(
  onNewContent: (addedNodes: Node[]) => void
): MutationObserver {
  let pendingNodes: Node[] = []

  const flush = debounce(() => {
    if (pendingNodes.length > 0) {
      onNewContent(pendingNodes)
      pendingNodes = []
    }
  }, 300)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        pendingNodes.push(...Array.from(mutation.addedNodes))
      }
    }
    flush()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  return observer
}
