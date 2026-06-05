"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";
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
  const { authFetch } = useAuth();
  const t = useTranslations('admin');
  const [updatedAt, setUpdatedAt] = useState(initialConfig?.updatedAt || null);
  const [isSaving, setIsSaving] = useState(false);
  const { message } = App.useApp();

  const handleSave = async () => {
    if (!sandboxUrl.trim()) {
      message.error(t('sandboxPage.msgUrlEmpty'));
      return;
    }

    setIsSaving(true);
    try {
      const res = await authFetch("/api/sandbox-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxUrl }),
      });
      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || t('sandboxPage.msgSaveFailed'));
        return;
      }

      setUpdatedAt(data.updatedAt);
      message.success(t('sandboxPage.msgSavedSuccess'));
    } catch {
      message.error(t('sandboxPage.msgSaveFailedNetwork'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('sandboxPage.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('sandboxPage.subtitle')}
          </p>
        </div>
        <Space>
          <Button
            icon={<SaveOutlined />}
            loading={isSaving}
            onClick={handleSave}
          >
            {t('sandboxPage.btnSave')}
          </Button>
        </Space>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4">
          <div className="mb-3">
            <Text type="secondary" className="text-xs">
              {t('sandboxPage.tipDescription')}
            </Text>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('sandboxPage.labelSandboxUrl')}
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
                {t('sandboxPage.lastSaved')}{new Date(updatedAt).toLocaleString()}
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
