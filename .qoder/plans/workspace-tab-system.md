# Workspace 详情页添加 Tab 系统

## Context

当前 Workspace 详情页（`WorkspaceDetail`）是简单的单栏布局，直接展示 `WorkspaceInfoTab`（7 个子标签）。用户希望在 Workspace 页面也能像 Project 页面一样，有顶层 Tab 系统：**Workspace Info** + **Chat**。这样用户可以在 Workspace 内直接发起对话，无需跳转到 Project 页面。

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/components/workspace/WorkspaceDetail.tsx` | 重构为 Tab 系统，新增 Chat Tab |
| `src/components/chat/ChatWorkspace.tsx` | 新增 `showProjectSelector` prop |

## 详细步骤

### Step 1: ChatWorkspace.tsx — 新增 `showProjectSelector` prop

- 在 `ChatWorkspaceProps` 接口新增 `showProjectSelector?: boolean`
- 在 forwardRef 解构中新增 `showProjectSelector = false`
- 修改第 1306 行项目选择器渲染条件：
  ```
  // 旧: {!embedded && projects.length > 0 && (
  // 新:
  {((!embedded) || showProjectSelector) && projects.length > 0 && (
  ```

### Step 2: WorkspaceDetail.tsx — 重构为 Tab 系统

**2a. 新增 imports 和常量**
- `import { useState, useCallback } from "react"`
- `import ChatWorkspace from "@/components/chat/ChatWorkspace"`
- `const WORKSPACE_INFO_TAB = "__workspace_info__"`
- `const CHAT_TAB = "__chat__"`

**2b. 新增 Chat 状态**
```ts
const [activeTabId, setActiveTabId] = useState(WORKSPACE_INFO_TAB);
const [chatKey, setChatKey] = useState(0);
const [activeChatId, setActiveChatId] = useState<number | null>(null);
const [activeChatTitle, setActiveChatTitle] = useState("New Chat");
const [activeChatMessages, setActiveChatMessages] = useState([]);
const [activeChatModelId, setActiveChatModelId] = useState<number | undefined>();
const [activeChatTemplateId, setActiveChatTemplateId] = useState<number | undefined>();
const [activeChatProjectId, setActiveChatProjectId] = useState<string | undefined>();
```

**2c. 重写 handleSwitchToChat**
- 从路由跳转改为：fetch 会话数据 → 更新所有 chat 状态 → `setActiveTabId(CHAT_TAB)`
- 同时恢复 `activeChatProjectId`

**2d. 重写 handleNewChat**
- 从路由跳转改为：重置所有 chat 状态 → `setActiveTabId(CHAT_TAB)`

**2e. 重构 JSX 布局**

```
外层: div.flex-1.flex.flex-col.overflow-hidden.bg-white
  ├── Tab Bar (h-[41px], 与 Project 页一致)
  │   ├── [Workspace Info] button
  │   └── [Chat] button (含浮窗弹出按钮)
  └── Tab Content (flex-1 min-h-0 relative)
      ├── Info Tab (absolute inset-0 overflow-y-auto, 内部 max-w-3xl)
      │   ├── workspace header
      │   └── WorkspaceInfoTab
      └── Chat Tab (absolute inset-0, display toggle)
          └── ChatWorkspace (embedded, showProjectSelector, projectId={activeChatProjectId})
```

- Workspace header 从外层移入 Info Tab content
- `handleNavigateToDocument` 保持路由跳转到 Project 页（workspace 无编辑器）
- `handleWorkspaceDeleted` 保持路由跳转到首页

## 验证

1. 访问 workspace 详情页 → 默认显示 Workspace Info Tab
2. 点击 Chat Tab → ChatWorkspace 正常渲染，底部可见项目选择器
3. Activity 中点击 chat → 切换到 Chat Tab 并加载会话
4. 在 Chat Tab 中通过项目选择器选择 project → 发送消息正常
5. 点击 Chat Tab 弹窗按钮 → 浮动聊天窗口正常打开
