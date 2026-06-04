"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { Button, Input, App, Typography, Space } from "antd";
import { SaveOutlined, CloudDownloadOutlined } from "@ant-design/icons";

const { Text, Paragraph } = Typography;

interface McpConfigData {
  configJson: string;
  updatedAt: string;
}

interface Props {
  initialConfig?: McpConfigData;
  brandName: string;
}

const EXAMPLE_JSON = `{
  "server-name": {
    "type": "stdio",
    "command": "node",
    "args": ["./server.js"]
  }
}`;

export default function McpPageClient({ initialConfig, brandName }: Props) {
  const [configJson, setConfigJson] = useState(
    initialConfig?.configJson || "{}"
  );
  const { authFetch } = useAuth();
  const [updatedAt, setUpdatedAt] = useState(initialConfig?.updatedAt || null);
  const [isSaving, setIsSaving] = useState(false);
  const { message } = App.useApp();

  const handleInstallRabbitDocs = () => {
    try {
      const parsed = JSON.parse(configJson);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        message.error("Current JSON is not a valid object, please fix first");
        return;
      }
      parsed.rabbitdocs = { type: "http", url: "http://127.0.0.1:4001/mcp" };
      setConfigJson(JSON.stringify(parsed, null, 2));
      message.success(`${brandName} MCP server config added, click Save to apply`);
    } catch {
      setConfigJson(
        JSON.stringify(
          { rabbitdocs: { type: "http", url: "http://127.0.0.1:4001/mcp" } },
          null,
          2
        )
      );
      message.success(`${brandName} MCP server config added, click Save to apply`);
    }
  };

  const handleSave = async () => {
    // Frontend JSON format validation
    let parsed: unknown;
    try {
      parsed = JSON.parse(configJson);
    } catch {
      message.error("Invalid JSON format, please check input");
      return;
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      message.error("JSON must be an object {}");
      return;
    }

    setIsSaving(true);
    try {
      const res = await authFetch("/api/mcp-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configJson }),
      });
      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || "Save failed");
        return;
      }

      setUpdatedAt(data.updatedAt);
      message.success("Saved successfully");
    } catch {
      message.error("Save failed, please check network connection");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">MCP Config</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage external MCP server connection configurations
          </p>
        </div>
        <Space>
          <Button
            icon={<CloudDownloadOutlined />}
            onClick={handleInstallRabbitDocs}
          >
            Install {brandName} MCP
          </Button>
          <Button
            icon={<SaveOutlined />}
            loading={isSaving}
            onClick={handleSave}
          >
            Save
          </Button>
        </Space>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4">
          {/* Tips */}
          <div className="mb-3">
            <Text type="secondary" className="text-xs">
              Enter MCP server configuration JSON, format example:
            </Text>
            <Paragraph className="!mb-0 !mt-1">
              <pre className="text-xs bg-gray-50 dark:bg-zinc-800 rounded p-2 overflow-x-auto font-mono text-gray-600 dark:text-gray-300">
                {EXAMPLE_JSON}
              </pre>
            </Paragraph>
            <Text type="secondary" className="text-xs">
              Supported types: stdio, sse, streamable-http. See MCP protocol documentation for details.
            </Text>
          </div>

          {/* JSON Editor */}
          <Input.TextArea
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            rows={20}
            className="font-mono text-sm"
            placeholder="Enter MCP server configuration JSON here..."
            spellCheck={false}
          />

          {/* Footer Status */}
          {updatedAt && (
            <div className="mt-2">
              <Text type="secondary" className="text-xs">
                Last saved: {new Date(updatedAt).toLocaleString()}
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
