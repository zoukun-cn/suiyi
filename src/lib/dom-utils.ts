// DOM 操作工具

/**
 * 在指定元素之后插入兄弟元素
 */
export function insertAfter(newNode: Node, referenceNode: Node): void {
  const parent = referenceNode.parentNode
  if (!parent) return
  parent.insertBefore(newNode, referenceNode.nextSibling)
}

/**
 * 判断元素是否可见 (未被 CSS 隐藏)
 */
export function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  )
}

/**
 * 获取光标/选区的位置 (屏幕坐标)
 */
export function getSelectionRect(): DOMRect | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (range.collapsed) return null

  const rect = range.getBoundingClientRect()
  return rect
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
