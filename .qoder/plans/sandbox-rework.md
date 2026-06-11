# 沙箱组件重构：从"请求/释放"机制改为"申请试用+绑定"机制

## Context

项目/工作空间信息页的沙箱部分当前使用旧的"请求沙箱"/"释放沙箱"机制（基于文件元数据 `SandboxStatus`），与 `/sandbox` 页面的申请+绑定机制脱节。需要统一为：未绑定时显示"申请试用"（跳转 /sandbox）和"绑定沙箱"按钮，绑定后显示沙箱信息。

## 修改文件清单

| # | 文件 | 操作 |
|---|------|------|
| 1 | `src/components/project/SandboxManager.tsx` | 重写 |
| 2 | `src/components/workspace/WorkspaceSandboxManager.tsx` | 重写 |
| 3 | `src/components/project/IntegrationPanel.tsx` | 移除 sandbox/onSandboxChange props |
| 4 | `src/components/workspace/WorkspaceIntegrationPanel.tsx` | 同上 |
| 5 | `src/components/project/ProjectInfoTab.tsx` | 移除 sandbox 状态和 props |
| 6 | `src/components/workspace/WorkspaceInfoTab.tsx` | 同上 |
| 7 | `messages/zh.json` | 更新沙箱相关 i18n |
| 8 | `messages/en.json` | 更新沙箱相关 i18n |

## Task 1: 更新 i18n（zh.json + en.json）

### 标签变更（4处，workspace 和 project 各2处）
- `"sandboxLabel": "沙箱请求"` → `"sandboxLabel": "沙箱"`（zh）/ `"Sandbox"`（en）
- `sandboxDescription` 相应更新

### 项目 `project.sandbox` 对象替换为新键
- 移除旧键：`requested`, `notRequested`, `requestedAt`, `releasedAt`, `requestSandbox`, `releaseSandbox`, `confirmRelease`, `confirmReleaseContent`
- 新增键：`applyTrial`(申请试用), `bindSandbox`(绑定沙箱), `unbind`(解绑), `noAvailableSandbox`(暂无可绑定沙箱), `selectSandbox`(选择沙箱), `unbindConfirm`, `unbindConfirmContent`, `operationFailed`
- 保留：`description`, `boundSandbox`, `openSandbox`, `cancel`, `confirmBtn`

### 工作空间 `workspace.sandbox` 对象同样替换

## Task 2: 重写 SandboxManager.tsx（项目级）

**文件**: `src/components/project/SandboxManager.tsx`

### Props 简化
- 移除 `sandbox?: SandboxStatus`, `onSandboxChange`
- 仅保留 `projectPath: string`

### 新逻辑
1. **数据加载**: mount 时 GET `/api/sandbox-applications`，计算：
   - `boundSandbox` = `apps.find(a => a.bindEntityId === projectId && a.status === "approved" && a.sandboxUrl)`
   - `availableApps` = `apps.filter(a => a.status === "approved" && a.sandboxUrl && !a.bindEntityId)`（未绑定的可用沙箱）
2. **已绑定状态**: 绿色卡片显示 remark/sandboxUrl + "打开沙箱"链接 + "解绑"按钮
3. **未绑定状态**: 两个按钮
   - "申请试用" → `router.push('/sandbox')`
   - "绑定沙箱" → 展开下拉选择可用沙箱，选中后 PATCH `/api/sandbox-applications` `{ id, bindEntityId: projectId }`
   - 无可用沙箱时显示提示文案
4. **移除**: 所有 `/api/fs/project-sandbox` 调用、`Modal.confirm` 释放对话框、旧状态显示

## Task 3: 重写 WorkspaceSandboxManager.tsx

**文件**: `src/components/workspace/WorkspaceSandboxManager.tsx`

与 Task 2 相同逻辑，用 `workspaceId` 替代 `projectId`。`workspaceId` 从 `workspacePath.split("/")[1]` 提取。PATCH 时 `bindEntityId` 使用 `workspaceId`。

## Task 4: IntegrationPanel props 清理

**文件**: `src/components/project/IntegrationPanel.tsx`
- 移除 props: `sandbox?: SandboxStatus`, `onSandboxChange`
- `<SandboxManager>` 只传 `projectPath`

**文件**: `src/components/workspace/WorkspaceIntegrationPanel.tsx`
- 同样清理，`<WorkspaceSandboxManager>` 只传 `workspacePath`

## Task 5: 上游调用者清理

**文件**: `src/components/project/ProjectInfoTab.tsx`
- 移除 `sandbox` state（`useState<SandboxStatus>`）
- 移除 `SandboxStatus` 类型导入
- `<IntegrationPanel>` 移除 `sandbox` 和 `onSandboxChange` 属性

**文件**: `src/components/workspace/WorkspaceInfoTab.tsx`
- 同样清理

## 验证方式

1. 启动 dev server (`pnpm dev`)
2. 打开项目信息 → 集成 tab → 展开"沙箱"折叠面板
3. 验证未绑定时：显示"申请试用"和"绑定沙箱"两个按钮
4. 点击"申请试用"→ 跳转到 `/sandbox` 页面
5. 在 `/sandbox` 页面申请并审批通过后，回到项目信息点击"绑定沙箱"→ 下拉选择 → 绑定成功
6. 验证已绑定状态：显示沙箱信息卡片 + 打开链接 + 解绑按钮
7. 点击解绑 → 回到未绑定状态
8. 工作空间页面同理测试
9. 暗色模式/英文语言切换测试
