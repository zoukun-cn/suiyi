# 随译 Suiyi

> 一款支持双语对照、划词翻译、悬停翻译的浏览器翻译插件

## 技术栈

- 🧩 [Plasmo](https://docs.plasmo.com/) — 浏览器扩展框架
- ⚛️ React 18 + TypeScript 5
- 🎨 CSS Variables (零运行时样式)

## 功能

- 📄 **页面双语对照翻译**：保留原网页布局，译文插入原文下方
- 📝 **划词翻译**：选中即译，快速查词
- 👆 **悬停翻译**：鼠标悬停自动翻译
- 🔌 **多引擎支持**：Google / DeepL / OpenAI 等多翻译后端
- 📋 **翻译历史**：记住翻译记录便于回顾

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 打包上传
pnpm package
```

### 加载扩展

1. 打开 `chrome://extensions`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `build/chrome-mv3-dev` 目录

## 项目结构

```
src/
├── background/          # Service Worker
├── sidepanel/           # 侧边栏 (主界面)
├── popup/               # 弹窗 (快捷操作)
├── contents/            # 内容脚本
├── components/          # 共享组件
├── hooks/               # 自定义 Hooks
├── services/            # 业务逻辑
├── lib/                 # 工具函数
├── types/               # 类型定义
└── styles/              # 全局样式
```

## License

MIT
