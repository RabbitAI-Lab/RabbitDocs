# 聊天对话框布局改造 - 实施计划

## Context（背景）

用户希望改造聊天对话框的视觉行为：

1. **移除所有聊天对话框的欢迎语**（包括 `Welcome` 标题、说明文案，以及"你可以尝试" Prompts 快捷提示）
2. **新对话时输入框在中间**（当前始终固定在底部）
3. **输入并发送后输入框移到底部**（带平滑过渡动画）

**当前实现**：
- `ChatWorkspace.tsx` L1202-1237 渲染 `<Welcome>` + `<Prompts>`（仅 `messages.length === 0 && !floating` 时显示）
- `ChatWorkspace.tsx` L1239-1363 渲染 `<Sender>`（始终在底部 `<div className="px-4 py-3">` 中）
- 三种调用方（NewChatWorkspace、ChatPageContent、FloatingChatWindow）都使用同一个 `ChatWorkspace` 组件

**预期效果**：删除欢迎语后，新对话界面更简洁干净；输入框初始居中更突出，发送后平滑移到底部，符合主流 AI 产品的现代交互体验（ChatGPT、Claude 等）。

## 关键文件

- **主修改**：`/Users/xujialiang/Desktop/Dev/ChatWiki/src/components/chat/ChatWorkspace.tsx`（共 1377 行）
- **不需修改**：`NewChatWorkspace.tsx`、`ChatPageContent.tsx`、`FloatingChatWindow.tsx`（它们只是 ChatWorkspace 的 wrapper，行为由 ChatWorkspace 统一处理）

## 实施步骤

### 步骤 1：清理 import（L5、L9-25）

**L5 修改**：
```tsx
// 修改前
import { Bubble, Sender, XProvider, Welcome, Prompts, Actions } from "@ant-design/x";

// 修改后
import { Bubble, Sender, XProvider, Actions } from "@ant-design/x";
```

**L9-25 图标导入**：删除 `FileTextOutlined`、`SaveOutlined`（仅 `promptItems` 使用），保留其他图标（`RobotOutlined, FolderOutlined, ProfileOutlined, ClearOutlined, ReloadOutlined, StopOutlined, ShareAltOutlined, CopyOutlined, PlusOutlined, ArrowLeftOutlined, ThunderboltOutlined, DownOutlined, UserOutlined` 在 Header、ThinkingBlock、Sender footer 中仍使用）。

### 步骤 2：删除 `promptItems` 数组（L128-141）

整段删除 14 行的 `promptItems` 数组定义（"讨论需求"、"保存发布"）。

### 步骤 3：重写主渲染区（L1202-1363）

将原"Welcome/Prompts + 固定底部 Sender"改为**单一 flex 容器**：

- **消息区**：始终渲染（`flex: 0 0 0` ↔ `flex: 1 1 0%` 平滑过渡 + opacity 0 ↔ 1）
- **Sender 外层**：flex 行为切换（`flex-1 items-center` 让 Sender 居中 ↔ `flex-none` 让 Sender 贴底）
- **Sender 组件本身**：始终挂在同一直接父节点 `w-full max-w-3xl px-4 py-3`（className 不变），保证焦点和输入内容不丢

**核心 JSX 替换代码**：

```tsx
{/* Main area - 消息区 + Sender */}
<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
  {/* 消息区 - 始终渲染，高度 0 ↔ 100% 平滑过渡 */}
  <div
    className="overflow-hidden transition-all duration-300 ease-in-out"
    style={{
      flex: messages.length === 0 && !floating ? '0 0 0' : '1 1 0%',
      minHeight: 0,
      opacity: messages.length === 0 && !floating ? 0 : 1,
    }}
  >
    <Bubble.List
      style={{ height: "100%", maxWidth: '48rem', margin: '0 auto' }}
      items={bubbleItems}
      role={roles}
      autoScroll
    />
  </div>

  {/* Sender 外层 - flex 行为切换让 Sender 居中或贴底 */}
  <div
    className="flex transition-all duration-300 ease-in-out"
    style={{
      flex: messages.length === 0 && !floating ? '1 1 0%' : '0 0 auto',
      alignItems: messages.length === 0 && !floating ? 'center' : 'stretch',
      justifyContent: 'center',
    }}
  >
    <div className="w-full max-w-3xl px-4 py-3">
      <Sender
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSend}
        loading={loading}
        onCancel={handleCancel}
        placeholder="输入消息..."
        autoSize={
          messages.length === 0 && !floating
            ? { minRows: 2, maxRows: 6 }
            : { minRows: 1, maxRows: 4 }
        }
        suffix={false}
        header={
          mentionedFiles.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 12px" }}>
              {mentionedFiles.map((filePath) => {
                const fileName = filePath.split("/").pop() || filePath;
                return (
                  <Tag
                    key={filePath}
                    closable
                    onClose={() =>
                      setMentionedFiles((prev) =>
                        prev.filter((f) => f !== filePath)
                      )
                    }
                    style={{ margin: 0 }}
                  >
                    @{fileName}
                  </Tag>
                );
              })}
            </div>
          ) : false
        }
        styles={{ root: { backgroundColor: '#fff' } }}
        footer={(oriNode) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <div style={{ display: 'flex' }}>
              {/* 模型 Dropdown（保持原代码 L1278-1300） */}
              <Dropdown
                getPopupContainer={floating ? () => document.getElementById('floating-chat-window') || document.body : undefined}
                menu={{
                  items: [
                    ...(selectedModelId ? [{ key: '__clear_model__', label: '✕ 清除选择' }] : []),
                    ...models.map((m) => ({ key: String(m.id), label: `${m.provider} / ${m.modelName}` })),
                  ],
                  onClick: ({ key }) => {
                    if (key === '__clear_model__') handleModelChange(undefined);
                    else handleModelChange(Number(key));
                  },
                  selectedKeys: selectedModelId ? [String(selectedModelId)] : [],
                }}
              >
                <Sender.Switch
                  value={!!selectedModelId}
                  icon={<RobotOutlined />}
                  checkedChildren={models.find((m) => m.id === selectedModelId)?.modelName}
                  unCheckedChildren="模型"
                  styles={switchStyles}
                />
              </Dropdown>
              {/* 项目 Dropdown（保持原代码 L1302-1325） */}
              {!embedded && projects.length > 0 && (
                <Dropdown
                  getPopupContainer={floating ? () => document.getElementById('floating-chat-window') || document.body : undefined}
                  menu={{
                    items: [
                      ...(selectedProject ? [{ key: '__clear_project__', label: '✕ 清除选择' }] : []),
                      ...projects.map((p) => ({ key: p.id, label: p.name })),
                    ],
                    onClick: ({ key }) => {
                      if (key === '__clear_project__') handleProjectChange(undefined);
                      else handleProjectChange(key);
                    },
                    selectedKeys: selectedProject ? [selectedProject] : [],
                  }}
                >
                  <Sender.Switch
                    value={!!selectedProject}
                    icon={<FolderOutlined />}
                    checkedChildren={projects.find((p) => p.id === selectedProject)?.name}
                    unCheckedChildren="项目"
                    styles={switchStyles}
                  />
                </Dropdown>
              )}
              {/* 模板 Dropdown（保持原代码 L1327-1356） */}
              {templates.length > 0 && (
                <Dropdown
                  getPopupContainer={floating ? () => document.getElementById('floating-chat-window') || document.body : undefined}
                  menu={{
                    items: [
                      ...(selectedTemplateId ? [{ key: '__clear_template__', label: '✕ 清除选择' }] : []),
                      ...templates.map((t) => ({ key: String(t.id), label: t.name })),
                    ],
                    onClick: ({ key }) => {
                      if (key === '__clear_template__') handleTemplateChange(undefined);
                      else handleTemplateChange(Number(key));
                    },
                    selectedKeys: selectedTemplateId ? [String(selectedTemplateId)] : [],
                  }}
                >
                  <Sender.Switch
                    value={!!selectedTemplateId}
                    icon={<ProfileOutlined />}
                    checkedChildren={templates.find((t) => t.id === selectedTemplateId)?.name}
                    unCheckedChildren="模板"
                    styles={switchStyles}
                  />
                </Dropdown>
              )}
            </div>
            {oriNode}
          </div>
        )}
      />
    </div>
  </div>
</div>
```

## 关键设计决策

### Sender 状态稳定性
- Sender 的**直接父节点**始终是 `w-full max-w-3xl px-4 py-3`（className 不变）
- 只有**外层祖父**的 flex 行为切换
- React 调和时识别到 Sender 子树未变，**不会卸载** → 焦点和输入内容完全保留

### 动画方案
- **高度过渡**：`flex: 0 0 0` ↔ `flex: 1 1 0%`（浏览器会过渡实际计算高度）
- **位置过渡**：`alignItems: center` ↔ `alignItems: stretch`（Sender 父容器的对齐方式）
- **时长**：300ms，`ease-in-out` 缓动
- **不引入新依赖**：项目无 framer-motion，纯 CSS transition 即可

### floating 模式行为
- `floating=true` 时 `messages.length === 0 && !floating` 永远为 false
- 消息区始终 `flex: 1 1 0%` + `opacity: 1`
- Sender 始终贴底（`flex: 0 0 auto` + `alignItems: stretch`）
- **与原代码逻辑一致**（floating 模式原来就不显示 Welcome）

### Sender `autoSize` 自适应
- **居中时**：`{ minRows: 2, maxRows: 6 }`（更大的输入区，更突出）
- **贴底时**：`{ minRows: 1, maxRows: 4 }`（紧凑，给消息区留更多空间）

## 边界情况处理

| 情况 | 行为 | 备注 |
|------|------|------|
| `messages.length === 0` 且 `loading === true` | 不会出现（发送必先添加消息） | 动画自然过渡 |
| 用户在中间输入文字后发送 | 焦点保持（Sender 未卸载） | 布局平滑过渡 |
| 切换 Chat / New Chat | 整个 ChatWorkspace 重新挂载 | `inputValue` 重置，符合预期 |
| `floating === true` 模式 | Sender 始终贴底 | 与原行为一致 |
| `mentionedFiles` header 标签 | 状态保留 | Sender 未卸载 |

## 验证步骤

1. **基础验证**（启动 dev server `npm run dev`）：
   - 访问 `http://localhost:3000/chat/new`
   - 左侧项目列表（NewChatWorkspace）+ 右侧居中的输入框

2. **居中布局验证**：
   - 选择项目后 → 进入 chat 标签 → 看到输入框居中
   - **无欢迎语/标题/Prompts**

3. **过渡动画验证**：
   - 在居中的输入框输入文字 → 点击发送
   - 应看到：消息区平滑展开 + 输入框平滑移到底部（300ms）

4. **有消息状态验证**：
   - 输入框在底部
   - 消息列表正常显示
   - `Bubble.List` 的 `autoScroll` 让新消息自动滚到底部

5. **floating 模式验证**：
   - 打开全局悬浮聊天窗口
   - 应看到：输入框始终贴底（不显示居中模式）

6. **完整性验证**：
   - 测试 `/chat/[id]` 直接访问（ChatPageContent 渲染）
   - 测试 `/chat/new`（NewChatWorkspace 渲染）
   - 测试切换聊天、New Chat 按钮

7. **回归测试**：
   - 发送消息、生成回复、保存到文档、分享等核心功能不受影响
   - 输入框的模型/项目/模板切换器正常工作
   - `@filename` mention 文件标签正常工作

## 不需要修改的内容

- `NewChatWorkspace.tsx` 中"请先在左侧选择一个项目"提示（L748）— **保留**（与本任务无关，是项目选择引导，不是聊天欢迎语）
- `FloatingChatWindow.tsx` — 不需要改（ChatWorkspace 已统一处理 floating 行为）
- `ChatPageContent.tsx` — 不需要改
- 数据库 schema、API 路由 — 完全不涉及

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| `flex` transition 在某些浏览器上不平滑 | 低 | Tailwind/CSS 现代浏览器都支持；300ms 过渡是"锦上添花" |
| Sender 状态丢失 | 低 | 父节点不变，React 不会卸载；退一步：用户发送时输入已清空 |
| floating 模式行为变化 | 低 | 条件判断保留 `!floating`，行为与原代码一致 |
