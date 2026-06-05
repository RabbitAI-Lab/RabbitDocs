"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  renamingPath?: string | null;
  renamingName?: string;
  onRenamingNameChange?: (name: string) => void;
  onRenameConfirm?: () => void;
  onRenameCancel?: () => void;
  renameInputRef?: React.RefObject<HTMLInputElement | null>;
  onStartRename?: (path: string) => void;
  emptyText?: string;
}

function RenameInput({
  name,
  inputRef,
  onNameChange,
  onConfirm,
  onCancel,
}: {
  name: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onNameChange: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmingRef = useRef(false);

  return (
    <input
      ref={inputRef}
      autoFocus
      value={name}
      onChange={(e) => onNameChange(e.target.value)}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          confirmingRef.current = true;
          onConfirm();
        }
        if (e.key === "Escape") {
          confirmingRef.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (!confirmingRef.current) onConfirm();
      }}
      className="flex-1 min-w-0 px-1.5 py-0.5 text-sm border border-blue-300 rounded focus:outline-none focus:border-blue-500 bg-white dark:bg-zinc-800 dark:text-gray-200 dark:border-blue-600"
    />
  );
}

function FileTreeNode({
  node,
  level,
  props,
  confirmDeletePath,
  setConfirmDeletePath,
  expandedPaths,
  onToggleExpand,
}: {
  node: TreeNode;
  level: number;
  props: FileTreeProps;
  confirmDeletePath: string | null;
  setConfirmDeletePath: (path: string | null) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
}) {
  const t = useTranslations('common');
  const isEditable = props.mode === "editable";
  const isSelected = props.selectedPath === node.path;
  const isRenaming = props.renamingPath === node.path;

  if (node.type === "directory") {
    return (
      <div>
        <div
          className={`flex items-center gap-1.5 w-full px-2 py-1 text-sm transition-colors select-none ${
            isEditable
              ? "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer group"
              : "text-gray-500 dark:text-gray-400 cursor-pointer"
          }`}
          onClick={() => {
            if (!isRenaming) onToggleExpand(node.path);
          }}
          onDoubleClick={() => {
            if (isEditable && !isRenaming && props.onStartRename) {
              props.onStartRename(node.path);
            }
          }}
          style={{ paddingLeft: `${8 + level * 14}px` }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isRenaming) onToggleExpand(node.path);
            }}
            className="shrink-0 p-0.5 -ml-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={expandedPaths.has(node.path) ? "Collapse" : "Expand"}
            tabIndex={-1}
          >
            <svg
              className={`w-3 h-3 transition-transform duration-150 ${
                expandedPaths.has(node.path) ? "rotate-90" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <svg
            className="w-3.5 h-3.5 shrink-0 text-amber-400"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          {isRenaming ? (
            <RenameInput
              name={props.renamingName || ""}
              inputRef={props.renameInputRef}
              onNameChange={props.onRenamingNameChange || (() => {})}
              onConfirm={props.onRenameConfirm || (() => {})}
              onCancel={props.onRenameCancel || (() => {})}
            />
          ) : (
            <span className="truncate font-medium">{node.name}</span>
          )}
          {isEditable && !isRenaming && (
            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {props.onNewDirectory && (
                <button
                  onClick={() => props.onNewDirectory!(node.path)}
                  className="p-0.5 text-gray-400 hover:text-blue-600"
                  title={t('folder')}
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
                  title={t('document')}
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
                <span className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeletePath(node.path);
                    }}
                    className="p-0.5 text-gray-400 hover:text-red-500"
                    title={t('delete')}
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
                  {confirmDeletePath === node.path && (
                    <span className="absolute right-0 bottom-full mb-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 flex items-center gap-2 text-xs whitespace-nowrap z-50">
                      <span className="text-gray-500 dark:text-gray-400">{t('confirmDelete')}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeletePath(null);
                          props.onDeleteDirectory!(node.path);
                        }}
                        className="px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                      >{t('delete')}</button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeletePath(null);
                        }}
                        className="px-1.5 py-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      >{t('cancel')}</button>
                    </span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
        {node.children &&
          node.children.length > 0 &&
          expandedPaths.has(node.path) &&
          node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              props={props}
              confirmDeletePath={confirmDeletePath}
              setConfirmDeletePath={setConfirmDeletePath}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
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
        className={`flex items-center gap-1.5 w-full px-2 py-1 text-sm transition-colors select-none ${
          isSelected
            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
            : isEditable
              ? "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-default"
              : "text-gray-600 dark:text-gray-400 cursor-default"
        }`}
        onDoubleClick={() => {
          if (isEditable && !isRenaming && props.onStartRename) {
            props.onStartRename(node.path);
          }
        }}
        style={{ paddingLeft: `${8 + level * 14}px` }}
      >
        {node.name.toLowerCase().endsWith(".html") ? (
          <svg
            className="w-3.5 h-3.5 shrink-0 text-orange-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="HTML file"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <polyline points="9 13 7 15 9 17" />
            <polyline points="15 13 17 15 15 17" />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5 shrink-0 text-blue-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Markdown file"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}
        {isRenaming ? (
          <RenameInput
            name={props.renamingName || ""}
            inputRef={props.renameInputRef}
            onNameChange={props.onRenamingNameChange || (() => {})}
            onConfirm={props.onRenameConfirm || (() => {})}
            onCancel={props.onRenameCancel || (() => {})}
          />
        ) : (
          <span className="truncate flex-1">{node.name}</span>
        )}
        {isEditable && !isRenaming && (props.onMentionFile || props.onDeleteFile) && (
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {props.onMentionFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onMentionFile!(node);
                }}
                className="p-0.5 text-gray-400 hover:text-blue-600"
                title={t('mention')}
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
                <span className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeletePath(node.path);
                    }}
                    className="p-0.5 text-gray-400 hover:text-red-500"
                    title={t('delete')}
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
                  {confirmDeletePath === node.path && (
                    <span className="absolute right-0 bottom-full mb-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 flex items-center gap-2 text-xs whitespace-nowrap z-50">
                      <span className="text-gray-500 dark:text-gray-400">{t('confirmDelete')}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeletePath(null);
                          props.onDeleteFile!(node.path);
                        }}
                        className="px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                      >{t('delete')}</button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeletePath(null);
                        }}
                        className="px-1.5 py-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      >{t('cancel')}</button>
                    </span>
                  )}
                </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FileTree(props: FileTreeProps) {
  const t = useTranslations('common');
  const { tree, emptyText = t('noDocuments') } = props;
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Close popover when clicking outside
  useEffect(() => {
    if (!confirmDeletePath) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setConfirmDeletePath(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [confirmDeletePath]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto py-1">
      {tree.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          level={0}
          props={props}
          confirmDeletePath={confirmDeletePath}
          setConfirmDeletePath={setConfirmDeletePath}
          expandedPaths={expandedPaths}
          onToggleExpand={toggleExpand}
        />
      ))}
      {tree.length === 0 && props.renamingPath == null && (
        <p className="px-3 py-4 text-sm text-gray-400 dark:text-gray-500 text-center">{emptyText}</p>
      )}
    </div>
  );
}
