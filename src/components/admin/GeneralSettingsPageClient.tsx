"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { Button, Input, App, Typography, Space } from "antd";
import { SaveOutlined } from "@ant-design/icons";

const { Text } = Typography;

const DEFAULT_BRAND_NAME = "RabbitDocs";

interface Props {
  initialBrandName: string;
}

export default function GeneralSettingsPageClient({ initialBrandName }: Props) {
  const [brandName, setBrandName] = useState(initialBrandName || DEFAULT_BRAND_NAME);
  const [isSaving, setIsSaving] = useState(false);
  const { authFetch } = useAuth();
  const { message } = App.useApp();

  const dirty = brandName !== (initialBrandName || DEFAULT_BRAND_NAME);

  const handleSave = async () => {
    const value = brandName.trim();
    if (!value) {
      message.error("Brand name cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const res = await authFetch("/api/auth/admin/system-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: value }),
      });
      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || "Save failed");
        return;
      }

      message.success("Brand name saved successfully");
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
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Site Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Configure site-wide branding and general settings
          </p>
        </div>
        <Space>
          <Button
            icon={<SaveOutlined />}
            loading={isSaving}
            disabled={!dirty}
            onClick={handleSave}
          >
            Save
          </Button>
        </Space>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4 max-w-2xl">
          <div className="mb-3">
            <Text type="secondary" className="text-xs">
              The brand name is displayed in the sidebar, page titles, emails, and other system displays.
            </Text>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Brand Name
            </label>
            <Input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={DEFAULT_BRAND_NAME}
              allowClear
              className="max-w-md"
            />
          </div>

          <div className="mt-4 p-3 bg-gray-50 dark:bg-zinc-800 rounded-md">
            <Text type="secondary" className="text-xs">
              Preview: <span className="font-medium text-gray-700 dark:text-gray-300">{brandName || DEFAULT_BRAND_NAME}</span> — Document Management & Publishing
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}
