"use client";

import { TreeNode } from "@/lib/tree";

export interface FileTreeProps {
  tree: TreeNode[];
  mode: "readonly" | "editable";
  selectedPath?: string | null;
  onFileClick?: (node: TreeNode) => void;
  onNewDirectory?: (parentPath: string) => void;
  onNewFile?: (parentPath: string) => void;
  onDeleteDirectory?: (dirPath: string) => void;
  onMentionFile?: (node: TreeNode) => void;
  onDeleteFile?: (filePath: string) => void;
  creatingDirParent?: string | null;
  creatingDirName?: string;
  onCreatingDirNameChange?: (name: string) => void;
  onCreatingDirConfirm?: () => void;
  onCreatingDirCancel?: () => void;
  dirInputRef?: React.RefObject<HTMLInputElement | null>;
  emptyText?: string;
}

function FileTreeNode({
  node,
  level,
  props,
}: {
  node: TreeNode;
  level: number;
  props: FileTreeProps;
}) {
  const isEditable = props.mode === "editable";
  const isSelected = props.selectedPath === node.path;

  if (node.type === "directory") {
    return (
      <div>
        <div
          className={`flex items-center gap-1.5 w-full px-2 py-1 text-xs transition-colors select-none ${
            isEditable
              ? "text-gray-500 hover:bg-gray-100 cursor-default group"
              : "text-gray-500 cursor-default"
          }`}
          style={{ paddingLeft: `${8 + level * 14}px` }}
        >
          <svg
            className="w-3.5 h-3.5 shrink-0 text-amber-400"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          <span className="truncate font-medium">{node.name}</span>
          {isEditable && (
            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {props.onNewDirectory && (
                <button
                  onClick={() => props.onNewDirectory!(node.path)}
                  className="p-0.5 text-gray-400 hover:text-blue-600"
                  title="新建文件夹"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                </button>
              )}
              {props.onNewFile && (
                <button
                  onClick={() => props.onNewFile!(node.path)}
                  className="p-0.5 text-gray-400 hover:text-blue-600"
                  title="新建文档"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                </button>
              )}
              {props.onDeleteDirectory && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDeleteDirectory!(node.path);
                  }}
                  className="p-0.5 text-gray-400 hover:text-red-500"
                  title="删除"
                >
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        {isEditable &&
          props.creatingDirParent === node.path &&
          renderNewDirInput(level, props)}
        {node.children &&
          node.children.length > 0 &&
          node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              props={props}
            />
          ))}
      </div>
    );
  }

  // File node
  return (
    <div className={isEditable ? "group" : undefined}>
      <div
        role={isEditable ? "button" : undefined}
        tabIndex={isEditable ? 0 : undefined}
        onClick={
          isEditable && props.onFileClick
            ? () => props.onFileClick!(node)
            : undefined
        }
        onKeyDown={
          isEditable && props.onFileClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onFileClick!(node);
                }
              }
            : undefined
        }
        className={`flex items-center gap-1.5 w-full px-2 py-1 text-xs transition-colors select-none ${
          isSelected
            ? "bg-blue-50 text-blue-700 font-medium"
            : isEditable
              ? "text-gray-600 hover:bg-gray-50 cursor-default"
              : "text-gray-600 cursor-default"
        }`}
        style={{ paddingLeft: `${8 + level * 14}px` }}
      >
        <svg
          className="w-3.5 h-3.5 shrink-0 text-blue-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="truncate flex-1">{node.name}</span>
        {isEditable && (props.onMentionFile || props.onDeleteFile) && (
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {props.onMentionFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onMentionFile!(node);
                }}
                className="p-0.5 text-gray-400 hover:text-blue-600"
                title="@引用"
              >
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
                </svg>
              </button>
            )}
            {props.onDeleteFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDeleteFile!(node.path);
                }}
                className="p-0.5 text-gray-400 hover:text-red-500"
                title="删除"
              >
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function renderNewDirInput(level: number, props: FileTreeProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 bg-blue-50"
      style={{ paddingLeft: `${8 + (level + 1) * 14}px` }}
    >
      <svg
        className="w-3.5 h-3.5 shrink-0 text-amber-400"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
      </svg>
      <input
        ref={props.dirInputRef}
        autoFocus
        value={props.creatingDirName || ""}
        onChange={(e) => props.onCreatingDirNameChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") props.onCreatingDirConfirm?.();
          if (e.key === "Escape") props.onCreatingDirCancel?.();
        }}
        onBlur={() => props.onCreatingDirCancel?.()}
        className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:border-blue-500 bg-white"
      />
    </div>
  );
}

export default function FileTree(props: FileTreeProps) {
  const { tree, emptyText = "暂无文档" } = props;

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {props.mode === "editable" &&
        props.creatingDirParent === "" &&
        renderNewDirInput(-1, props)}
      {tree.map((node) => (
        <FileTreeNode key={node.path} node={node} level={0} props={props} />
      ))}
      {tree.length === 0 && props.creatingDirParent == null && (
        <p className="px-3 py-4 text-xs text-gray-400 text-center">{emptyText}</p>
      )}
    </div>
  );
}
