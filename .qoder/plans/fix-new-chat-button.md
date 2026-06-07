# 修复项目页面新建会话按钮无反应

## Context

在项目详情页（`/project/{id}`）的对话标签页中，点击 ChatHeader 的 "+" 按钮新建会话没有任何反应。

**根因**：`ProjectWorkspace` 和 `WorkspaceDetail` 都有正确的 `handleNewChat`（本地重置状态），并已传给各自的 `EditorArea`，但 `EditorArea` 没有将 `onNewChat` / `onSwitchToChat` 继续传递给 `ChatWorkspace`。`ChatWorkspace` 内部硬编码使用 `useChatNavigation` 的 `handleNewChat`，它执行 `router.push(...?openChat=true)` 做 Next.js 软导航，无法重置客户端组件状态。

## 修改计划

### 1. `ChatWorkspaceProps` 添加 `onNewChat` 可选 prop
**文件**: `src/components/chat/chat-workspace-ref.ts`
- 在 `onSwitchToChat` 后面添加 `onNewChat?: () => void;`

### 2. `ChatWorkspace` 优先使用外部 `onNewChat`
**文件**: `src/components/chat/ChatWorkspace.tsx`
- 解构参数中添加 `onNewChat`
- 第196行：`onNewChat={navigation.handleNewChat}` → `onNewChat={onNewChat ?? navigation.handleNewChat}`

### 3. `ProjectEditorArea` 传递 props 给 `ChatWorkspace`
**文件**: `src/components/project/ProjectEditorArea.tsx`
- `<ChatWorkspace>` 添加 `onNewChat={onNewChat}` 和 `onSwitchToChat={onSwitchToChat}`

### 4. `WorkspaceEditorArea` 同样传递
**文件**: `src/components/workspace/WorkspaceEditorArea.tsx`
- `<ChatWorkspace>` 添加 `onNewChat={onNewChat}`
- `onSwitchToChat` 需签名适配：`onSwitchToChat={(chatId) => onSwitchToChat(chatId, null)}`

## 验证

1. 项目页面点击 "+" → 消息清空、标题重置、停留在 Chat 标签页
2. 工作区页面同上
3. 独立 `/chat` 页面点击 "+" → 正常导航到 `/chat/new`（回退行为）
4. 浮动窗口 → 本地重置正常
5. 历史记录选择 → 在项目/工作区页面正常切换
