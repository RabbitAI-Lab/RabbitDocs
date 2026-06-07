"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { Button, Input, App, Typography, Space } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

const { Text } = Typography;

const DEFAULT_BRAND_NAME = "RabbitDocs";
const DEFAULT_SITE_URL = "https://docs.rabbitai-lab.com";

interface Props {
  initialBrandName: string;
  initialSiteUrl: string;
  initialAdminEmail: string;
}

export default function GeneralSettingsPageClient({ initialBrandName, initialSiteUrl, initialAdminEmail }: Props) {
  const [brandName, setBrandName] = useState(initialBrandName || DEFAULT_BRAND_NAME);
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl || DEFAULT_SITE_URL);
  const [adminEmail, setAdminEmail] = useState(initialAdminEmail);
  const [isSaving, setIsSaving] = useState(false);
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations("admin.generalPage");

  const dirty =
    brandName !== (initialBrandName || DEFAULT_BRAND_NAME) ||
    siteUrl !== (initialSiteUrl || DEFAULT_SITE_URL) ||
    adminEmail !== initialAdminEmail;

  const handleSave = async () => {
    const brandValue = brandName.trim();
    if (!brandValue) {
      message.error(t('msgBrandNameEmpty'));
      return;
    }

    setIsSaving(true);
    try {
      const res = await authFetch("/api/auth/admin/system-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: brandValue, siteUrl: siteUrl.trim(), adminEmail: adminEmail.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || t('msgSaveFailed'));
        return;
      }

      message.success(t('msgSavedSuccess'));
    } catch {
      message.error(t('msgSaveFailedNetwork'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('subtitle')}
          </p>
        </div>
        <Space>
          <Button
            icon={<SaveOutlined />}
            loading={isSaving}
            disabled={!dirty}
            onClick={handleSave}
          >
            {t('btnSave')}
          </Button>
        </Space>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4 max-w-2xl">
          {/* Brand Name */}
          <div className="mb-3">
            <Text type="secondary" className="text-xs">
              {t('brandNameDesc')}
            </Text>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('brandNameLabel')}
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
              Preview: <span className="font-medium text-gray-700 dark:text-gray-300">{brandName || DEFAULT_BRAND_NAME}</span> — {t('brandNamePreview')}
            </Text>
          </div>

          {/* Site URL */}
          <div className="mt-6 mb-3">
            <Text type="secondary" className="text-xs">
              {t('siteUrlDesc')}
            </Text>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('siteUrlLabel')}
            </label>
            <Input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder={DEFAULT_SITE_URL}
              allowClear
              className="max-w-md"
            />
          </div>

          {/* Admin Email */}
          <div className="mt-6 mb-3">
            <Text type="secondary" className="text-xs">
              {t('adminEmailDesc')}
            </Text>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('adminEmailLabel')}
            </label>
            <Input
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@example.com"
              allowClear
              type="email"
              className="max-w-md"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
