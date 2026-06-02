# "请先在左侧选择一个项目"提示框样式改为蓝色系

## Context

用户反馈 `NewChatWorkspace` 组件中"请先在左侧选择一个项目"的占位提示框使用紫色系（`bg-purple-50`、`border-purple-400`、`text-purple-500`、`text-purple-400`），视觉上与项目整体蓝色调风格不协调且显得突兀。依据用户偏好（菜单字体使用蓝色系 `text-blue-600/dark:text-blue-400`，界面默认亮色主题、配色明亮），将该提示框从紫色系统一调整为蓝色系，保持视觉风格一致。

## 待修改文件

- `src/components/chat/NewChatWorkspace.tsx`（第 734-751 行，整个"未选择项目"占位区域）

## 修改方案

将紫色系 class 全部替换为对应的蓝色系 class：

| 元素 | 现有 class | 目标 class |
| --- | --- | --- |
| 占位容器背景 | `bg-purple-50` | `bg-blue-50` |
| 容器左侧边线 | `border-purple-400` | `border-blue-400` |
| 左指箭头图标 | `text-purple-500` | `text-blue-500` |
| 对话框主图标 | `text-purple-400` | `text-blue-400` |
| 提示文字 | `text-gray-700` | `text-blue-700`（增强蓝色统一感） |

## 验证步骤

1. 启动 `pnpm dev`（或 `npm run dev`）
2. 在浏览器中打开 `/chat/new` 页面
3. 确认左侧 Projects 面板未选中任何项目
4. 检查右侧主区域显示的"请先在左侧选择一个项目"占位框：
   - 背景为浅蓝色
   - 左侧 4px 蓝色边线
   - 左指箭头与对话框图标均为蓝色
   - 提示文字为蓝色加粗显示
5. 选择某个项目后，占位框应被工作区内容正常替换（确认无样式回归）
