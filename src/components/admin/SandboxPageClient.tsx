"use client";

import { useState } from "react";
import { Button, Input, App, Typography, Space } from "antd";
import { SaveOutlined } from "@ant-design/icons";

const { Text } = Typography;

const DEFAULT_URL = "openapi.sandbox.rabbitai-lab.com";

interface SandboxConfigData {
  sandboxUrl: string;
  updatedAt: string;
}

interface Props {
  initialConfig?: SandboxConfigData;
}

export default function SandboxPageClient({ initialConfig }: Props) {
  const [sandboxUrl, setSandboxUrl] = useState(
    initialConfig?.sandboxUrl || DEFAULT_URL
  );
  const [updatedAt, setUpdatedAt] = useState(initialConfig?.updatedAt || null);
  const [isSaving, setIsSaving] = useState(false);
  const { message } = App.useApp();

  const handleSave = async () => {
    if (!sandboxUrl.trim()) {
      message.error("沙盒 URL 不能为空");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/sandbox-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxUrl }),
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
          <h1 className="text-lg font-semibold text-gray-800">沙盒配置</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            配置 RabbitAI-Lab OpenSandbox 服务地址
          </p>
        </div>
        <Space>
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
          <div className="mb-3">
            <Text type="secondary" className="text-xs">
              配置 OpenSandbox 服务的连接地址，用于沙盒环境运行代码。
            </Text>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpenSandbox URL
            </label>
            <Input
              value={sandboxUrl}
              onChange={(e) => setSandboxUrl(e.target.value)}
              placeholder={DEFAULT_URL}
              className="max-w-xl"
            />
          </div>

          {updatedAt && (
            <div className="mt-4">
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
