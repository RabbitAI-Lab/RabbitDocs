"use client";

import { Popconfirm, Switch, Tag } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import type { McpServerEntry } from "./types";
import {
  describeServer,
  hasAuthorization,
  inferType,
  isSystemMcp,
  needsApiKey,
} from "./utils";

export interface McpListItemProps {
  name: string;
  entry: McpServerEntry;
  isEnabled: boolean;
  saving: boolean;
  // Currently stored API key; not rendered, but accepted for future use.
  apiKey?: string;
  onToggle: (name: string, checked: boolean) => void;
  onEditKey: (name: string) => void;
  onEdit: (name: string) => void;
  onDelete: (name: string) => void;
}

// Tag color mapping for inferred server type.
const TYPE_TAG_COLOR: Record<string, string> = {
  stdio: "blue",
  sse: "purple",
  http: "green",
};

/**
 * Single MCP server row: enable switch, name + type tag, command/url preview,
 * and per-row action buttons (edit key, edit JSON, delete).
 */
export default function McpListItem({
  name,
  entry,
  isEnabled,
  saving,
  onToggle,
  onEditKey,
  onEdit,
  onDelete,
}: McpListItemProps) {
  const type = inferType(entry);
  const tagColor = TYPE_TAG_COLOR[type] || "default";
  const hasAuth = hasAuthorization(entry);
  const showKey = needsApiKey(name, entry);
  const system = isSystemMcp(name);
  const description = describeServer(entry);

  return (
    <div
      className={
        "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors " +
        (isEnabled
          ? "border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600"
          : "border-gray-100 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 opacity-60")
      }
    >
      <Switch
        size="small"
        checked={isEnabled}
        loading={saving}
        onChange={(checked) => onToggle(name, checked)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={
              "text-sm font-medium truncate " +
              (isEnabled ? "text-gray-700 dark:text-gray-200" : "text-gray-400 dark:text-gray-500")
            }
          >
            {name}
          </span>
          <Tag
            color={tagColor}
            className="text-[10px] leading-4 m-0"
          >
            {type}
          </Tag>
          {!isEnabled && (
            <Tag color="default" className="text-[10px] leading-4 m-0">
              Disabled
            </Tag>
          )}
        </div>
        <div
          className="text-xs text-gray-400 dark:text-gray-500 truncate font-mono mt-0.5"
          title={description}
        >
          {description}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {showKey && (
          <KeyOutlined
            className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer text-base p-1"
            title="修改 API Key"
            onClick={() => onEditKey(name)}
          />
        )}
        <EditOutlined
          className={
            system
              ? "text-gray-300 dark:text-zinc-600 cursor-not-allowed text-base p-1"
              : "text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer text-base p-1"
          }
          title="Edit JSON"
          onClick={() => onEdit(name)}
        />
        {!system && (
          <Popconfirm
            title={`Delete "${name}"?`}
            description="This will also remove its saved API Key."
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(name)}
          >
            <DeleteOutlined
              className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 cursor-pointer text-base p-1"
              title="Delete"
            />
          </Popconfirm>
        )}
      </div>
    </div>
  );
}
