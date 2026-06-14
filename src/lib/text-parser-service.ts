// 文本解析服务 — 统一管理解析策略

import type { TranslatableTextParser, TextSegment } from './text-parser'
import { TranslatableTextNodeParser, TranslatableParagraphParser } from './text-parser'

type ParserType = 'text' | 'paragraph'

class TextParserService {
  private parsers = new Map<ParserType, TranslatableTextParser<any>>()

  constructor() {
    this.parsers.set('text', new TranslatableTextNodeParser())
    this.parsers.set('paragraph', new TranslatableParagraphParser())
  }

  parse(root: Node, type: ParserType): TextSegment[] {
    const parser = this.parsers.get(type)
    if (!parser) throw new Error(`Unknown parser type: ${type}`)
    return parser.extractSegments(root)
  }
}

export const textParser = new TextParserService()
