"use client";

import type { TreeNode } from "@/lib/tree";
import { useTranslations } from "next-intl";
import FileTree from "@/components/ui/FileTree";
import FileTreeFooter, { type TreeViewMode } from "@/components/ui/FileTreeFooter";

interface ProjectSidebarProps {
  /** 项目名称，用于标题显示 */
  projectName: string;
  /** 当前文件树数据 (docs) */
  tree: TreeNode[];
  /** 根目录文件树数据 (workspace view) */
  rootTree: TreeNode[];
  /** 当前激活的视图模式 */
  activeView: TreeViewMode;
  /** 视图切换回调 */
  onViewChange: (view: TreeViewMode) => void;
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
  onUpload: (parentPath: string) => void;
  onRefresh?: () => void;
}

export default function ProjectSidebar({
  projectName,
  tree,
  rootTree,
  activeView,
  onViewChange,
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
  onUpload,
  onRefresh,
}: ProjectSidebarProps) {
  const t = useTranslations('project');
  const tc = useTranslations('common');

  const displayTree = activeView === "docs" ? tree : rootTree;

  return (
    <div className="w-[240px] h-full flex flex-col border-r border-gray-200 dark:border-zinc-700 bg-white dark:bg-[var(--sidebar-bg)] shrink-0">
      <div className="px-3 h-[41px] shrink-0 flex items-center justify-between border-b border-gray-200 dark:border-zinc-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{t('documents', { name: projectName })}</h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0"
            title={tc('refresh')}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        )}
      </div>

      <div className="px-2 h-[38px] shrink-0 border-b border-gray-100 dark:border-zinc-700 flex items-center gap-0.5">
        <button
          onClick={() => onCreateFile("")}
          disabled={isRenaming}
          className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          {t('document')}
        </button>
        <button
          onClick={() => onCreateDir("")}
          disabled={isRenaming}
          className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          {t('folder')}
        </button>
        <button
          onClick={() => onUpload("")}
          disabled={isRenaming}
          className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {t('upload')}
        </button>
      </div>

      <FileTree
        tree={displayTree}
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
        onUpload={onUpload}
      />

      <FileTreeFooter activeView={activeView} onViewChange={onViewChange} />
    </div>
  );
}
