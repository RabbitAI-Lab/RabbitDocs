# /chat/[chatId] Header 右侧 Icon 按钮统一为无边框

## Context

在 `/chat/[chatId]` 页面（`src/app/chat/[chatId]/page.tsx`），聊天头部（Header）右侧的图标按钮视觉风格不统一：

- `History`（历史记录）按钮：使用 `type="text"`，**无边框** ✓
- `新会话`（PlusOutlined）按钮：未指定 type，默认 `default`，**有边框** ✗
- `分享`（ShareAltOutlined）按钮：未指定 type，默认 `default`，**有边框** ✗
- `Clear`（ClearOutlined）按钮：未指定 type，默认 `default`，**有边框** ✗

项目中已有"无边框"的设计基线：
- `src/components/chat/ChatHistoryPopover.tsx` 中 History 按钮用 `type="text"`
- `src/components/chat/FloatingChatWindow.tsx` 浮动聊天窗口的所有右侧按钮（Plus/Share/Clear）均已使用 `type="text"`（见该文件 L272、L332、L349）
- `src/components/chat/ChatWorkspace.tsx` L1066 的嵌入式 `ArrowLeft` 按钮也已是 `type="text"`

目标：将 `ChatWorkspace.tsx` 头部右侧的 Plus/Share/Clear 三个按钮统一为 `type="text"`，与 History 按钮保持视觉一致。

> 注：修改 `ChatWorkspace.tsx` 会同时影响 `/chat/[chatId]`、`/chat/new`（嵌入式）以及 `FloatingChatWindow` 内的 ChatWorkspace 实例。前两者需要修，后者本身就是无边框（无需改）。

## 待修改文件

`src/components/chat/ChatWorkspace.tsx`

## 改动点

在头部右侧 `<Space size="small">` 块（L1077-1195）中，对以下 3 个 `<Button>` 增加 `type="text"` 属性：

| # | 行号 | 图标 | Tooltip | 现状 | 目标 |
|---|------|------|---------|------|------|
| 1 | L1106 | `<PlusOutlined />` | 新会话 | 无 type（有边框） | `type="text"` |
| 2 | L1175 | `<ShareAltOutlined />` | 分享 | 无 type（有边框） | `type="text"` |
| 3 | L1189 | `<ClearOutlined />` | Clear | 无 type（有边框） | `type="text"` |

### 改动 1：PlusOutlined 新会话按钮

原文（L1105-L1122）：
```tsx
<Tooltip title="新会话">
  <Button
    icon={<PlusOutlined />}
    size="small"
    onClick={() => {
      ...
    }}
  />
</Tooltip>
```

改为：
```tsx
<Tooltip title="新会话">
  <Button
    type="text"
    icon={<PlusOutlined />}
    size="small"
    onClick={() => {
      ...
    }}
  />
</Tooltip>
```

### 改动 2：ShareAltOutlined 分享按钮

原文（L1174-L1182）：
```tsx
<Tooltip title="分享">
  <Button
    icon={<ShareAltOutlined />}
    size="small"
    loading={shareLoading}
    onClick={handleShare}
  />
</Tooltip>
```

改为：
```tsx
<Tooltip title="分享">
  <Button
    type="text"
    icon={<ShareAltOutlined />}
    size="small"
    loading={shareLoading}
    onClick={handleShare}
  />
</Tooltip>
```

### 改动 3：ClearOutlined Clear 按钮

原文（L1188-L1194）：
```tsx
<Tooltip title="Clear">
  <Button
    icon={<ClearOutlined />}
    size="small"
    onClick={handleClear}
  />
</Tooltip>
```

改为：
```tsx
<Tooltip title="Clear">
  <Button
    type="text"
    icon={<ClearOutlined />}
    size="small"
    onClick={handleClear}
  />
</Tooltip>
```

## 不需要修改的地方

- `ChatHistoryPopover.tsx` 中 History 按钮已经是 `type="text"`，无需改。
- `FloatingChatWindow.tsx` 中所有按钮已经是 `type="text"`，无需改。
- 弹窗内 "复制链接" / "重新生成" / "取消分享" 按钮因带有文字标签和明确的 `type="primary"` / `danger` 样式，属于功能性操作按钮，**不在本次统一范围**。
- 左上角嵌入式 `ArrowLeft` 返回按钮（L1066）已经是 `type="text"`，无需改。

## 验证方式

1. **运行 dev server**：`bash scripts/dev.sh`（或 `npm run dev`），访问 `http://localhost:3000/chat/1`。
2. **目视检查**：头部右侧 Plus、Share、Clear 三个按钮应与 History 按钮视觉一致（无边框、hover 时浅色背景），不再出现"有的有边框、有的没边框"的混搭。
3. **交互验证**：
   - 点击新会话 → 应正常跳转至 `/chat/new`（行为不变）
   - 点击分享 → 弹出分享 Popover，加载态旋转图标正常显示
   - 点击 Clear → 消息列表清空
4. **回归路径**：
   - `/chat/new`：嵌入式 ChatWorkspace，新会话按钮与 History 视觉一致
   - 项目详情页嵌入式聊天（`/project/[...path]` 中通过 `NewChatWorkspace` 渲染 ChatWorkspace）：同上
   - 浮动聊天窗口：内部 ChatWorkspace 头部被 `floating` prop 跳过渲染（见 L1062 `!floating &&`），外层 `FloatingChatWindow` 的按钮本身就是 `type="text"`，不受影响

## 风险评估

极低。仅修改 `<Button>` 的 `type` 属性，不涉及任何 props 行为变更、状态变更或 API 调用。
