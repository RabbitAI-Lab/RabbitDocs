"use client";

import { useTranslations } from "next-intl";

export interface McpToolbarProps {
  enabledCount: number;
  totalCount: number;
  onAdd: () => void;
  onImport?: () => void;
}

/**
 * Top toolbar: shows the enabled/configured count on the left and the
 * "Add MCP" button (and optional "Import" button) on the right.
 */
export default function McpToolbar({
  enabledCount,
  totalCount,
  onAdd,
  onImport,
}: McpToolbarProps) {
  const t = useTranslations('workspace');
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {t('mcp.toolbarCount', { enabled: enabledCount, total: totalCount })}
      </span>
      <div className="flex items-center gap-2">
        {onImport && (
          <button
            onClick={onImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('mcp.importFromAccount')}
          </button>
        )}
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('mcp.addMcp')}
        </button>
      </div>
    </div>
  );
}
