"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
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
  if (value.trim() === "") return null; // Allow clearing to restore default
  if (!value.startsWith("/")) {
    return "Storage path must be an absolute path starting with /";
  }
  if (value.startsWith("/.") || value.includes("/..")) {
    return "Storage path cannot contain . or .. directory segments";
  }
  return null;
}

export default function StoragePageClient({ initialConfig }: Props) {
  const [storagePath, setStoragePath] = useState(
    initialConfig?.storagePath || ""
  );
  const { authFetch } = useAuth();
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
      const res = await authFetch("/api/storage-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: storagePath.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || "Save failed");
        return;
      }

      setUpdatedAt(data.updatedAt);
      message.success(
        storagePath.trim()
          ? "Saved successfully, file storage path updated"
          : "Saved successfully, restored default storage path"
      );
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
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">File Storage</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Configure file storage data directory, all project documents will be stored in this directory
          </p>
        </div>
        <Space>
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
          <div className="mb-3">
            <Text type="secondary" className="text-xs">
              Configure the root directory for file storage. Leave empty to use the default path (data folder under project directory).
              Path must be an absolute path starting with /.
            </Text>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Storage Directory
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
              title="Currently using default storage path: data folder under project directory"
              showIcon
            />
          )}

          {updatedAt && (
            <div className="mt-4">
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
