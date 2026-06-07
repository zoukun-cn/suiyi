// 文本解析工具 — 将页面文本拆分为可翻译的片段

/** 文本段落 (用于双语对照渲染) */
export interface TextSegment {
  id: string
  text: string
  node: Text // 关联的 DOM 文本节点
  startOffset: number
  endOffset: number
}

/**
 * 从 DOM 文本节点提取可翻译的文本片段
 * 过滤掉纯空白、纯数字、代码等不需要翻译的内容
 */
export function extractTranslatableSegments(root: Node): TextSegment[] {
  const segments: TextSegment[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Text) {
      // 跳过脚本和样式
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT

      const tag = parent.tagName.toLowerCase()
      if (['script', 'style', 'code', 'pre', 'noscript', 'textarea', 'pre'].includes(tag)) {
        return NodeFilter.FILTER_REJECT
      }

      // 跳过空/空白文本
      const text = node.textContent?.trim()
      if (!text || text.length < 2) return NodeFilter.FILTER_REJECT

      // 跳过纯数字/符号
      if (/^[\d\s.,;:!?+\-=*/%^&|@#$~`'"()[\]{}<>\\/]+$/.test(text)) {
        return NodeFilter.FILTER_REJECT
      }
      console.log(`[TextParser] Found segment: "${text}"`)
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let id = 0
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || ''
    segments.push({
      id: `suiyi-seg-${id++}`,
      text,
      node,
      startOffset: 0,
      endOffset: text.length,
    })
  }

  return segments
}

/**
 * 判断文本是否需要翻译
 * (包含至少一个 CJK/拉丁/西里尔/阿拉伯 字符)
 */
export function isTranslatable(text: string): boolean {
  return /[一-鿿぀-ゟ゠-ヿa-zA-ZЀ-ӿ؀-ۿ]/.test(text)
}

/**
 * 将文本按句子分割
 */
export function splitSentences(text: string): string[] {
  // 按常见句末标点分割，保留分隔符
  return text
    .split(/(?<=[。！？.!?\n])\s*/)
    .filter((s) => s.trim().length > 0)
}
