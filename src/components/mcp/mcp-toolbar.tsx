"use client";

import { PlusOutlined } from "@ant-design/icons";

export interface McpToolbarProps {
  enabledCount: number;
  totalCount: number;
  onAdd: () => void;
}

/**
 * Top toolbar: shows the enabled/configured count on the left and the
 * "Add MCP" button on the right.
 */
export default function McpToolbar({
  enabledCount,
  totalCount,
  onAdd,
}: McpToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {enabledCount} enabled / {totalCount} configured
      </span>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
      >
        <PlusOutlined />
        Add MCP
      </button>
    </div>
  );
}
