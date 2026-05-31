# 欢迎使用 ChatWiki

ChatWiki 是一个基于文件系统的文档管理与发布平台。

## 特性

- **文件系统存储**：所有文档以 Markdown 文件形式存储在磁盘上，可直接用任何编辑器打开
- **CherryMarkdown 编辑器**：所见即所得的 Markdown 编辑体验
- **嵌套目录支持**：项目内支持多层子目录，自由组织文档结构
- **一键发布**：将文档发布为独立的公开页面

## 快速开始

1. 点击左侧 **New Chat** 开始新的聊天
2. 在聊天中讨论并生成文档内容
3. 点击 **Save to Document** 将聊天内容保存为文档
4. 在文档编辑器中完善内容，点击 **Publish** 发布

## 目录结构

你的所有文档存储在 `data/personal/default/` 目录下，每个项目是一个子目录：

```
data/personal/default/
├── my-project/
│   ├── README.md
│   ├── 01-需求分析/
│   │   └── 用户调研.md
│   └── 02-技术方案/
│       └── 架构设计.md
└── another-project/
    └── 会议纪要.md
```

开始你的文档创作之旅吧！
