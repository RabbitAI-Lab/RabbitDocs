"use client";

import { useState } from "react";
import { Button, Input, App, Typography, Space } from "antd";
import { SaveOutlined, CloudDownloadOutlined } from "@ant-design/icons";

const { Text, Paragraph } = Typography;

interface McpConfigData {
  configJson: string;
  updatedAt: string;
}

interface Props {
  initialConfig?: McpConfigData;
}

const EXAMPLE_JSON = `{
  "server-name": {
    "type": "stdio",
    "command": "node",
    "args": ["./server.js"]
  }
}`;

export default function McpPageClient({ initialConfig }: Props) {
  const [configJson, setConfigJson] = useState(
    initialConfig?.configJson || "{}"
  );
  const [updatedAt, setUpdatedAt] = useState(initialConfig?.updatedAt || null);
  const [isSaving, setIsSaving] = useState(false);
  const { message } = App.useApp();

  const handleInstallChatWiki = () => {
    try {
      const parsed = JSON.parse(configJson);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        message.error("当前 JSON 不是有效对象，请先修正");
        return;
      }
      parsed.chatwiki = { type: "http", url: "http://127.0.0.1:4001/mcp" };
      setConfigJson(JSON.stringify(parsed, null, 2));
      message.success("已添加 ChatWiki MCP 服务器配置，点击保存生效");
    } catch {
      setConfigJson(
        JSON.stringify(
          { chatwiki: { type: "http", url: "http://127.0.0.1:4001/mcp" } },
          null,
          2
        )
      );
      message.success("已添加 ChatWiki MCP 服务器配置，点击保存生效");
    }
  };

  const handleSave = async () => {
    // 前端验证 JSON 格式
    let parsed: unknown;
    try {
      parsed = JSON.parse(configJson);
    } catch {
      message.error("JSON 格式无效，请检查输入");
      return;
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      message.error("JSON 必须是一个对象 {}");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/mcp-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configJson }),
      });
      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || "保存失败");
        return;
      }

      setUpdatedAt(data.updatedAt);
      message.success("保存成功");
    } catch {
      message.error("保存失败，请检查网络连接");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">MCP 配置</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            管理外部 MCP 服务器连接配置
          </p>
        </div>
        <Space>
          <Button
            icon={<CloudDownloadOutlined />}
            onClick={handleInstallChatWiki}
          >
            Install ChatWiki MCP
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={isSaving}
            onClick={handleSave}
          >
            保存
          </Button>
        </Space>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {/* 提示信息 */}
          <div className="mb-3">
            <Text type="secondary" className="text-xs">
              请填写 MCP 服务器配置 JSON，格式示例：
            </Text>
            <Paragraph className="!mb-0 !mt-1">
              <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto font-mono text-gray-600">
                {EXAMPLE_JSON}
              </pre>
            </Paragraph>
            <Text type="secondary" className="text-xs">
              支持的类型：stdio、sse、streamable-http。详情参考 MCP 协议文档。
            </Text>
          </div>

          {/* JSON 编辑器 */}
          <Input.TextArea
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            rows={20}
            className="font-mono text-sm"
            placeholder="在此输入 MCP 服务器配置 JSON..."
            spellCheck={false}
          />

          {/* 底部状态 */}
          {updatedAt && (
            <div className="mt-2">
              <Text type="secondary" className="text-xs">
                上次保存：{new Date(updatedAt).toLocaleString("zh-CN")}
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
