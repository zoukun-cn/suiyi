import { Language } from '../services/interface';

const TRANSLATED_ATTR = 'data-translated';
const ORIGINAL_ATTR = 'data-original-text';

export function setupPageTranslator(): void {
  // 初始化占位
}

export async function translatePage(): Promise<void> {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('script, style, noscript, iframe')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.hasAttribute(TRANSLATED_ATTR)) {
          return NodeFilter.FILTER_REJECT;
        }
        const text = node.textContent?.trim();
        if (!text || text.length < 2) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    nodes.push(node as Text);
  }

  // 分批翻译，每批 20 个节点
  const batchSize = 20;
  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);
    await translateBatch(batch);
  }
}

async function translateBatch(nodes: Text[]): Promise<void> {
  const texts = nodes.map((n) => n.textContent?.trim() ?? '');
  const combined = texts.join('\n---SPLIT---\n');

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'translate',
      request: {
        text: combined,
        sourceLang: Language.AUTO,
        targetLang: Language.ZH_CN,
      },
    });

    if (result?.translatedText) {
      const parts = result.translatedText.split('---SPLIT---');
      nodes.forEach((node, index) => {
        const translated = parts[index]?.trim();
        if (translated) {
          const parent = node.parentElement;
          if (parent) {
            parent.setAttribute(ORIGINAL_ATTR, node.textContent ?? '');
            parent.setAttribute(TRANSLATED_ATTR, 'true');
          }
          node.textContent = translated;
        }
      });
    }
  } catch {
    // 静默失败，保留原文
  }
}

export function restorePage(): void {
  const elements = document.querySelectorAll(`[${TRANSLATED_ATTR}]`);
  elements.forEach((el) => {
    const original = el.getAttribute(ORIGINAL_ATTR);
    if (original) {
      // 恢复所有子文本节点
      const textNodes: Text[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        textNodes.push(n as Text);
      }
      // 简单处理：如果只有一个文本节点，直接恢复
      if (textNodes.length === 1) {
        textNodes[0].textContent = original;
      }
    }
    el.removeAttribute(TRANSLATED_ATTR);
    el.removeAttribute(ORIGINAL_ATTR);
  });
}
