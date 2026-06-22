# Suiyi（随译）— 浏览器翻译扩展

> "随译" = 即看即译

基于 [Plasmo](https://docs.plasmo.com/) 构建的 Chrome 浏览器翻译扩展（Manifest V3），支持三种翻译模式，可接入多种 AI / API 后端。

## 功能

| 模式 | 说明 |
|---|---|
| **整页双语翻译** | 在每个段落下插入翻译文本，保留原始页面布局 |
| **划词翻译** | 在任意页面选中文字 → 弹出翻译气泡 |
| **悬停翻译** | 鼠标悬停在文字上 → 自动弹出翻译 |

## 翻译引擎

| 引擎 | 是否需要 API Key | 模型 / 接口 |
|---|---|---|
| Google Translate | 否 | `translate.googleapis.com`（免费） |
| DeepL | 是 | `api-free.deepl.com` |
| OpenAI (GPT) | 是 | `gpt-4o-mini` |
| DeepSeek | 是 | `deepseek-v4-flash`（默认） |

## 技术栈

| 层级 | 技术 |
|---|---|
| 扩展框架 | [Plasmo](https://docs.plasmo.com/) v0.91+ |
| UI | React 18.3 + TypeScript |
| 构建 | esbuild（通过 Plasmo） |
| 包管理 | pnpm |
| 样式 | CSS Variables（零运行时） |
| 存储 | `@plasmohq/storage`（封装 chrome.storage） |

## 文档索引

- [架构概览](./ARCHITECTURE.md)
- [开发指南](./DEVELOPMENT.md)
- [内部消息协议](./MESSAGING.md)
- [编码规范](./CONVENTIONS.md)
