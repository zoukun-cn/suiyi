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

// ==================== jQuery-like 元素选择器 ====================

/**
 * 元素集合 — 对一组 DOM 元素进行批量操作，支持链式调用。
 *
 * 类似 jQuery 对象，但仅包含项目实际需要的子集：
 * - $(selector)   → CSS 选择器查询
 * - $(element)    → 单个元素包装
 * - .each()       → 遍历
 * - .remove()     → 移除元素
 * - .attr()       → 读取/设置/移除属性
 *
 * @example
 * $('.item.xx').remove()                        // 移除所有匹配元素
 * $('a').attr('href')                           // 读取第一个元素的 href
 * $('[data-x]').attr('data-x', '1').each(...)   // 链式操作
 */
class DomCollection<T extends Element = HTMLElement> {
  private elements: T[]

  constructor(elements: Iterable<T>) {
    this.elements = Array.from(elements)
  }

  /** 集合中元素的数量 */
  get length(): number {
    return this.elements.length
  }

  /** 遍历每个元素，返回 this 以支持链式调用 */
  each(fn: (el: T, index: number) => void): this {
    this.elements.forEach((el, i) => fn(el, i))
    return this
  }

  /** 支持 for...of 遍历 */
  [Symbol.iterator](): Iterator<T> {
    return this.elements[Symbol.iterator]()
  }

  /** 从 DOM 中移除所有元素 */
  remove(): this {
    for (const el of this.elements) {
      el.remove()
    }
    return this
  }

  /**
   * 读取第一个元素的属性值。
   * 设置所有元素的属性值。value 为 null 时移除属性。
   */
  attr(name: string): string | undefined
  attr(name: string, value: string | null): this
  attr(name: string, value?: string | null): string | undefined | this {
    if (value === undefined) {
      return this.elements[0]?.getAttribute(name) ?? undefined
    }
    for (const el of this.elements) {
      if (value === null) {
        el.removeAttribute(name)
      } else {
        el.setAttribute(name, value)
      }
    }
    return this
  }

  /** 移除所有元素的指定属性 */
  removeAttr(name: string): this {
    for (const el of this.elements) {
      el.removeAttribute(name)
    }
    return this
  }
}

// 重载签名
export function $(selector: string): DomCollection<HTMLElement>
export function $<T extends Element>(el: T): DomCollection<T>
// 实现
export function $<T extends Element>(input: string | T): DomCollection<T> {
  if (typeof input === 'string') {
    return new DomCollection(
      document.querySelectorAll<HTMLElement>(input)
    ) as unknown as DomCollection<T>
  }
  return new DomCollection([input])
}
