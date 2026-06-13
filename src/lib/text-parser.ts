// 文本解析工具 — 将页面文本拆分为可翻译的片段

// ==================== Public Interfaces ====================

/** 文本 (用于双语对照渲染) */
export interface TextSegment {
  id: string
  text: string
  node: Text // 关联的 DOM 文本节点
  startOffset: number
  endOffset: number
}

/** 段落文本 (用于双语对照渲染) */
export interface ParagraphTextSegment extends TextSegment {
  paragraphNode?: Element // 可选：关联的块级父元素（如 <p> <div>）
  nodes?: Text[] // 可选：同一段落内的所有文本节点（仅段落模式）
}

/**
 * 从 DOM 文本节点提取可翻译的文本片段
 * 过滤掉纯空白、纯数字、代码等不需要翻译的内容
 */
export function extractTranslatableSegments(root: Node): TextSegment[] {
  return new TranslatableTextNodeParser().extractSegments(root)
}

/** 可翻译文本片段提取器 —— 泛型接口，由具体的解析策略实现 */
interface TranslatableTextParser<T extends TextSegment> {
  extractSegments(root: Node): T[]
}


abstract class AbstractTranslatableTextParser<T extends TextSegment> implements TranslatableTextParser<T> {

  abstract extractSegments(root: Node): T[]

  /** 纯数字/符号/标点的正则（无需翻译） */
  readonly SYMBOLS_ONLY_RE = /^[\d\s.,;:!?+\-=*/%^&|@#$~`'"()[\]{}<>\\/]+$/

  /** 不需要翻译的 HTML 标签 */
  protected skipTags: Set<string>

  constructor(skipTags?: Set<string>) {
    this.skipTags = skipTags ?? new Set([
      'script', 'style', 'code', 'pre', 'noscript', 'textarea', 'input', 'kbd', 'nav', 'footer',
    ])
  }

}

class TranslatableTextNodeParser extends AbstractTranslatableTextParser<TextSegment> {
  extractSegments(root: Node): TextSegment[] {
    const segments: TextSegment[] = []
    const skipSelector = [...this.skipTags].join(', ')
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node: Text) {
        // 原生 closest() 沿祖先链检查，确保文本不在排除元素内
        if (node.parentElement?.closest(skipSelector)) {
          return NodeFilter.FILTER_REJECT
        }

        // 跳过空/空白文本
        const text = node.textContent?.trim()
        if (!text || text.length < 2) return NodeFilter.FILTER_REJECT

        // 跳过纯数字/符号/标点的文本（无实际可翻译内容）
        if (this.SYMBOLS_ONLY_RE.test(text)) {
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
  
}

type Piece = {
  parentElement: Element | null
  nodes: Text[]
}

class TranslatableParagraphCtx {
  root: Node
  pieces: Piece[] = []

  constructor(root: Node, pieces: Piece[] = []) {
    this.root = root
    this.pieces = pieces
  }

  currPiece(): Piece | undefined {
    if (this.pieces.length === 0) {
      return undefined
    }
    return this.pieces[this.pieces.length - 1]
  }

  addPiece(piece: Piece): void {
    this.pieces.push(piece)
  }

  currPieceSize(): number {
    const curr = this.currPiece()
    if (!curr) return 0
    return curr.nodes.length;
  }

}


class TranslatableParagraphParser extends AbstractTranslatableTextParser<ParagraphTextSegment> {

  // ---- 内联文本标签：不打断段落 ----
  private static readonly INLINE_TEXT_TAGS = new Set([
    'A', 'ABBR', 'ACRONYM', 'B', 'BDI', 'BDO', 'BIG', 'CITE',
    'CODE', 'DFN', 'EM', 'FONT', 'I', 'INS', 'KBD', 'LABEL',
    'MARK', 'Q', 'RP', 'RT', 'RUBY', 'S', 'SAMP', 'SMALL',
    'SPAN', 'STRIKE', 'STRONG', 'SUB', 'SUP', 'TIME', 'TT',
    'U', 'VAR', 'WBR', 'DEL',
  ])

  // ---- 内联忽略标签：打断段落但不产出翻译内容 ----
  private static readonly INLINE_IGNORE_TAGS = new Set([
    'BR', 'IMG', 'SVG', 'VIDEO', 'AUDIO', 'CANVAS',
    'IFRAME', 'OBJECT', 'EMBED', 'HR', 'INPUT', 'BUTTON',
    'TEXTAREA', 'PROGRESS', 'METER', 'MAP', 'AREA',
    'SELECT', 'DATALIST',
  ])

  extractSegments(root: Node): ParagraphTextSegment[] {

    const ctx = new TranslatableParagraphCtx(root, [{ parentElement: null, nodes: [] }])
    this.walkNode(ctx, root)

    return ctx.pieces.map((p, i) => ({
      id: `suiyi-p-${i}`,
      text: p.nodes.map(n => n.textContent || '').join(''),
      node: p.nodes[0],
      startOffset: 0,
      endOffset: p.nodes.reduce((s, n) => s + (n.textContent?.length || 0), 0),
      paragraphNode: p.parentElement || undefined,
      nodes: p.nodes,
    }))
  }

  // ========== tree walk ==========

  private walkNode(ctx: TranslatableParagraphCtx, node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      this.walkElementNode(ctx, node)
    } else if (node.nodeType === Node.TEXT_NODE) {
      this.walkTextNode(ctx, node as Text)
    }
  }

  private walkElementNode(ctx: TranslatableParagraphCtx, node: Node): void {
    const isShadow = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE
    const el: Element = isShadow ? (node as ShadowRoot).host as Element : (node as Element)

    if (!isShadow) {
      if (
        TranslatableParagraphParser.INLINE_IGNORE_TAGS.has(el.nodeName) ||
        this.skipTags.has(el.nodeName.toLowerCase()) ||
        el.classList.contains('notranslate') ||
        el.getAttribute('translate') === 'no' ||
        (el as HTMLElement).isContentEditable
      ) {
        if (ctx.currPieceSize() > 0) {
          ctx.addPiece({ parentElement: null, nodes: [] })
        }
        return
      }
    }

    this.walkChildren(ctx, isShadow ? (node as ShadowRoot) : el)

    if (el.shadowRoot) {
      this.walkChildren(ctx, el.shadowRoot)
    }
  }

  private walkTextNode(ctx: TranslatableParagraphCtx, node: Text): void {
    const text = node.textContent?.trim()
    if (!text || text.length < 1) return

    if (!ctx.currPiece().parentElement) {
      ctx.currPiece().parentElement = this.findBlockParent(ctx, node)
    }

    ctx.currPiece().nodes.push(node)
  }

  private walkChildren(ctx: TranslatableParagraphCtx, parent: Node): void {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        this.walkNode(ctx, child)
        continue
      }

      const el = child as Element

      if (TranslatableParagraphParser.INLINE_TEXT_TAGS.has(el.nodeName)) {
        this.walkNode(ctx, child)
      } else {
        if (ctx.currPiece().nodes.length > 0) ctx.addPiece({ parentElement: null, nodes: [] })
        this.walkNode(ctx, child)
        if (ctx.currPiece().nodes.length > 0) ctx.addPiece({ parentElement: null, nodes: [] })
      }
    }
  }

  // ========== parent resolution ==========

  private findBlockParent(ctx: TranslatableParagraphCtx, textNode: Node): Element | null {
    let ancestor: Node | null = textNode.parentNode
    while (
      ancestor &&
      ancestor !== ctx.root &&
      (TranslatableParagraphParser.INLINE_TEXT_TAGS.has((ancestor as Element).nodeName || '') ||
        TranslatableParagraphParser.INLINE_IGNORE_TAGS.has((ancestor as Element).nodeName || ''))
    ) {
      ancestor = ancestor.parentNode
    }
    if (ancestor?.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      ancestor = (ancestor as ShadowRoot).host as Element
    }
    return ancestor as Element | null
  }

}
