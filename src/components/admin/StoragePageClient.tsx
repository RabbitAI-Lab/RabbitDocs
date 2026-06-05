"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";
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

function validatePath(value: string, t: (key: string) => string): string | null {
  if (value.trim() === "") return null; // Allow clearing to restore default
  if (!value.startsWith("/")) {
    return t('storagePage.validationMustBeAbsolute');
  }
  if (value.startsWith("/.") || value.includes("/..")) {
    return t('storagePage.validationNoDotSegments');
  }
  return null;
}

export default function StoragePageClient({ initialConfig }: Props) {
  const [storagePath, setStoragePath] = useState(
    initialConfig?.storagePath || ""
  );
  const { authFetch } = useAuth();
  const t = useTranslations('admin');
  const [updatedAt, setUpdatedAt] = useState(initialConfig?.updatedAt || null);
  const [isSaving, setIsSaving] = useState(false);
  const { message } = App.useApp();

  const validationError = validatePath(storagePath, t);

  const handleSave = async () => {
    const error = validatePath(storagePath, t);
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
        message.error(data.error || t('storagePage.msgSaveFailed'));
        return;
      }

      setUpdatedAt(data.updatedAt);
      message.success(
        storagePath.trim()
          ? t('storagePage.msgSavedUpdated')
          : t('storagePage.msgSavedRestored')
      );
    } catch {
      message.error(t('storagePage.msgSaveFailedNetwork'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('storagePage.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('storagePage.subtitle')}
          </p>
        </div>
        <Space>
          <Button
            icon={<SaveOutlined />}
            loading={isSaving}
            onClick={handleSave}
          >
            {t('storagePage.btnSave')}
          </Button>
        </Space>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4">
          <div className="mb-3">
            <Text type="secondary" className="text-xs">
              {t('storagePage.tipDescription')}
            </Text>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('storagePage.labelStorageDir')}
            </label>
            <Input
              value={storagePath}
              onChange={(e) => setStoragePath(e.target.value)}
              placeholder={t('storagePage.placeholderStoragePath')}
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
              title={t('storagePage.alertUsingDefault')}
              showIcon
            />
          )}

          {updatedAt && (
            <div className="mt-4">
              <Text type="secondary" className="text-xs">
                {t('storagePage.lastSaved')}{new Date(updatedAt).toLocaleString()}
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
