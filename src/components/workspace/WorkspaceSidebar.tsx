"use client";

import type { TreeNode } from "@/lib/tree";
import FileTree from "@/components/ui/FileTree";

interface WorkspaceSidebarProps {
  /** Workspace 名称，用于标题显示 */
  workspaceName: string;
  /** 当前文件树数据 */
  tree: TreeNode[];
  /** 当前选中的文件路径（用于高亮），非文件标签时为 null */
  selectedPath: string | null;
  /** 是否正在重命名中（禁用新建按钮） */
  isRenaming: boolean;
  /** 重命名相关状态 */
  renamingPath: string | null;
  renamingName: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;

  // --- 回调 ---
  onCreateFile: (parentPath: string) => void;
  onCreateDir: (parentPath: string) => void;
  onFileClick: (node: TreeNode) => void;
  onDeleteFile: (filePath: string) => void;
  onDeleteDir: (dirPath: string) => void;
  onMentionFile: (node: TreeNode) => void;
  onStartRename: (path: string) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  onRenamingNameChange: (name: string) => void;
}

export default function WorkspaceSidebar({
  workspaceName,
  tree,
  selectedPath,
  isRenaming,
  renamingPath,
  renamingName,
  renameInputRef,
  onCreateFile,
  onCreateDir,
  onFileClick,
  onDeleteFile,
  onDeleteDir,
  onMentionFile,
  onStartRename,
  onRenameConfirm,
  onRenameCancel,
  onRenamingNameChange,
}: WorkspaceSidebarProps) {
  return (
    <div className="w-[240px] h-full flex flex-col border-r border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 shrink-0">
      <div className="px-3 h-[41px] flex items-center border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{workspaceName} Documents</h3>
      </div>

      <div className="px-2 py-1.5 border-b border-gray-100 dark:border-zinc-700 dark:border-zinc-700 flex gap-1">
        <button
          onClick={() => onCreateFile("")}
          disabled={isRenaming}
          className="flex items-center gap-1.5 flex-1 px-2 py-1 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          Document
        </button>
        <button
          onClick={() => onCreateDir("")}
          disabled={isRenaming}
          className="flex items-center gap-1.5 flex-1 px-2 py-1 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          Folder
        </button>
      </div>

      <FileTree
        tree={tree}
        mode="editable"
        selectedPath={selectedPath}
        onFileClick={onFileClick}
        onNewDirectory={onCreateDir}
        onNewFile={onCreateFile}
        onDeleteDirectory={onDeleteDir}
        onDeleteFile={onDeleteFile}
        onMentionFile={onMentionFile}
        renamingPath={renamingPath}
        renamingName={renamingName}
        onRenamingNameChange={onRenamingNameChange}
        onRenameConfirm={onRenameConfirm}
        onRenameCancel={onRenameCancel}
        renameInputRef={renameInputRef}
        onStartRename={onStartRename}
      />
    </div>
  );
}
