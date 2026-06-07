# Fix: ChatWelcome 组件 Safari 兼容性修复

## Context

ChatWelcome 组件在 Safari 浏览器下存在两个样式问题：
1. **Grid 布局**：Safari 下 bento 网格变成一行两个的统一长方形，缺少 Chrome 中的错落感
2. **Dark 模式颜色**：渐变文字在 Safari dark 模式下不显示正确颜色

## 根因分析

### 问题 1：Grid 布局

Bento 网格使用 `row-span-2`（tall 卡片）创建错落效果，但缺少：
- `grid-auto-flow: dense`：Safari 的 grid 自动布局算法在处理 `row-span-2` 时不回填空隙，导致布局出现空洞
- `grid-auto-rows`：没有显式行高定义，Safari 隐式行处理与 Chrome 不一致

### 问题 2：渐变文字 Dark 模式

已通过编译产物验证（`.next/dev/static/chunks/` 下的 CSS）：

- `.bg-clip-text` → `{ -webkit-background-clip: text; background-clip: text; }` ✅
- `.text-transparent` → `{ color: #0000; }` ❌ **缺少 `-webkit-text-fill-color: transparent`**

Safari 渲染 `background-clip: text` 渐变文字时，`-webkit-text-fill-color` 优先级高于 `color`，缺少此属性导致渐变文字在 Safari 中不可见。

## 修改方案

### 唯一需修改的文件：`src/app/globals.css`

在 chat-welcome 动画块之后（约第 132 行），`@media (prefers-reduced-motion)` 之前，插入：

```css
/* Bento grid — Safari compatibility for row-span + implicit rows */
.chat-welcome .grid {
  grid-auto-flow: row dense;
  grid-auto-rows: minmax(auto, 1fr);
}

/* Gradient text — Safari requires -webkit-text-fill-color with bg-clip-text */
.bg-clip-text {
  -webkit-text-fill-color: transparent;
}
```

### 不需修改的文件

- **ChatWelcome.tsx**：组件 Tailwind 类名正确，问题在 CSS 层面
- **Hero.tsx**：同样使用 `bg-clip-text text-transparent`，全局 `.bg-clip-text` 补丁会一并修复

## 影响范围

- `grid-auto-flow: dense` + `grid-auto-rows` 仅作用于 `.chat-welcome .grid`，不影响其他 grid 布局
- `.bg-clip-text` 全局补丁修复项目内所有渐变文字场景（ChatWelcome + Hero），Chrome 同样兼容

## 验证步骤

1. macOS Safari 打开 ChatWiki，进入空聊天页面，检查 welcome 区域：
   - 确认 bento 网格有错落感（readme 宽卡、fix 高卡）
   - 切换 dark 模式，确认渐变文字正确显示为 zinc-50 → zinc-400 渐变
2. Chrome 回归验证：确认布局和颜色无变化
