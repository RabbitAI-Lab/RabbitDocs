# 修复重命名文件时扩展名被双重追加的问题

## Context

创建新文件时默认生成 `Untitled.md`，进入重命名模式后用户输入 `xxx.html`，期望得到 `xxx.html`，实际得到 `xxx.html.md`。

**根因**：重命名确认逻辑（3 处）会用正则取原文件扩展名 `.md`，然后判断新名字不以 `.md` 结尾就强行追加。当用户将 `.md` 文件重命名为 `.html` 文件时，`xxx.html` 不以 `.md` 结尾 → 被追加成 `xxx.html.md`。

## 修复方案

在追加原扩展名之前，先检查用户输入的新名字是否已经包含合法扩展名（`.md` 或 `.html`）。如果已有，则不再追加。

### 涉及文件（3 处相同逻辑）

1. `src/components/workspace/WorkspaceDetail.tsx` — 第 164-171 行
2. `src/components/project/ProjectWorkspace.tsx` — 第 137-144 行
3. `src/components/chat/useProjectFileTree.ts` — 第 114-121 行

### 修改内容

将每处的扩展名保护逻辑从：

```typescript
// For files, ensure the extension is preserved if user removed it
let finalName = trimmedName;
if (node.type === "file") {
  const ext = node.name.match(/\.(md|html)$/)?.[0];
  if (ext && !finalName.endsWith(ext)) {
    finalName = `${finalName}${ext}`;
  }
}
```

改为：

```typescript
// For files, ensure a valid extension is present
let finalName = trimmedName;
if (node.type === "file") {
  const hasValidExt = /\.(md|html)$/.test(finalName);
  if (!hasValidExt) {
    const ext = node.name.match(/\.(md|html)$/)?.[0] ?? ".md";
    finalName = `${finalName}${ext}`;
  }
}
```

逻辑变更：
- 先检查新名字是否已以 `.md` 或 `.html` 结尾
- 如果已有合法扩展名 → 不做任何处理
- 如果没有 → 追加原扩展名（兜底 `.md`）

## 验证

1. 创建新文件，重命名为 `xxx.html` → 应得到 `xxx.html`（非 `xxx.html.md`）
2. 创建新文件，重命名为 `xxx`（无扩展名）→ 应得到 `xxx.md`
3. 创建新文件，重命名为 `xxx.md` → 应得到 `xxx.md`
4. 创建新文件，重命名为 `xxx.txt` → 应得到 `xxx.txt.md`（保留原扩展名追加行为）
