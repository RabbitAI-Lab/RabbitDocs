"use client";

import { useState } from "react";
import { Button, Input, App, Typography, Space, Alert } from "antd";
import { SaveOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface StorageConfigData {
  storagePath: string;
  updatedAt: string;
}

interface Props {
  initialConfig?: StorageConfigData;
}

function validatePath(value: string): string | null {
  if (value.trim() === "") return null; // 允许清空恢复默认
  if (!value.startsWith("/")) {
    return "存储路径必须是绝对路径，以 / 开头";
  }
  if (value.startsWith("/.") || value.includes("/..")) {
    return "存储路径不能包含 . 或 .. 目录片段";
  }
  return null;
}

export default function StoragePageClient({ initialConfig }: Props) {
  const [storagePath, setStoragePath] = useState(
    initialConfig?.storagePath || ""
  );
  const [updatedAt, setUpdatedAt] = useState(initialConfig?.updatedAt || null);
  const [isSaving, setIsSaving] = useState(false);
  const { message } = App.useApp();

  const validationError = validatePath(storagePath);

  const handleSave = async () => {
    const error = validatePath(storagePath);
    if (error) {
      message.error(error);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/storage-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: storagePath.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || "保存失败");
        return;
      }

      setUpdatedAt(data.updatedAt);
      message.success(
        storagePath.trim()
          ? "保存成功，文件存储路径已更新"
          : "保存成功，已恢复默认存储路径"
      );
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
          <h1 className="text-lg font-semibold text-gray-800">文件存储</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            配置文件存储的数据目录，所有项目文档将存储到该目录下
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
              配置文件存储的根目录。留空则使用默认路径（项目目录下的 data 文件夹）。
              路径必须是绝对路径，以 / 开头。
            </Text>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              存储目录
            </label>
            <Input
              value={storagePath}
              onChange={(e) => setStoragePath(e.target.value)}
              placeholder="/path/to/storage"
              className="max-w-xl"
              status={validationError ? "error" : undefined}
            />
            {validationError && (
              <Text type="danger" className="text-xs mt-1 block">
                {validationError}
              </Text>
            )}
          </div>

          {!storagePath.trim() && (
            <Alert
              className="max-w-xl mt-3"
              type="info"
              title="当前使用默认存储路径：项目目录下的 data 文件夹"
              showIcon
            />
          )}

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
