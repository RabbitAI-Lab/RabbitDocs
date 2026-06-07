"use client";

import { useState, useMemo } from "react";
import { Button, App, Popconfirm, ColorPicker } from "antd";
import { SaveOutlined, UndoOutlined } from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";
import {
  type ColorScheme,
  type ColorKey,
  COLOR_KEYS,
  DEFAULT_COLORS,
} from "@/lib/color-scheme";

interface Props {
  initialColorScheme: ColorScheme;
}

/** i18n key suffix for each ColorKey */
const COLOR_KEY_I18N: Record<ColorKey, string> = {
  primaryBtn: "colorPrimaryBtn",
  primaryBtnHover: "colorPrimaryBtnHover",
  accent: "colorAccent",
  sidebarBg: "colorSidebarBg",
  mainBg: "colorMainBg",
  foreground: "colorForeground",
  background: "colorBackground",
  senderBg: "colorSenderBg",
};

export default function AppearanceSettingsPageClient({
  initialColorScheme,
}: Props) {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations("admin.appearancePage");
  const [draft, setDraft] = useState<ColorScheme>(initialColorScheme);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(initialColorScheme);
  }, [draft, initialColorScheme]);

  const updateColor = (mode: "light" | "dark", key: ColorKey, hex: string) => {
    setDraft((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], [key]: hex },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch("/api/auth/admin/system-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorScheme: draft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("msgSaveFailed"));
      }
      message.success(t("msgSavedSuccess"));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t("msgSaveFailed");
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_COLORS });
  };

  const renderColorRow = (mode: "light" | "dark", key: ColorKey) => {
    const value = draft[mode][key];
    const label = t(COLOR_KEY_I18N[key]);
    const descKey = `${COLOR_KEY_I18N[key]}Desc`;
    const desc = t(descKey as Parameters<typeof t>[0]);

    return (
      <div
        key={key}
        className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-zinc-700 last:border-b-0"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {label}
          </div>
          {desc && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {desc}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <code className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {value}
          </code>
          <ColorPicker
            value={value}
            onChange={(_, hex) => updateColor(mode, key, hex)}
            size="small"
          />
        </div>
      </div>
    );
  };

  const renderSection = (mode: "light" | "dark", title: string) => (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 rounded-t-lg">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {title}
        </h3>
      </div>
      <div className="px-4 py-1">
        {COLOR_KEYS.map((key) => renderColorRow(mode, key))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {t("title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popconfirm
            title={t("msgResetConfirm")}
            onConfirm={handleReset}
            okText={t("btnResetDefaults")}
            cancelText=""
          >
            <Button icon={<UndoOutlined />}>{t("btnResetDefaults")}</Button>
          </Popconfirm>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!dirty}
            onClick={handleSave}
          >
            {t("btnSave")}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          {/* CSS Variable Reference */}
          <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-md text-xs text-gray-500 dark:text-gray-400">
            {t("cssVarNote")}
          </div>

          {renderSection("light", t("sectionLight"))}
          {renderSection("dark", t("sectionDark"))}
        </div>
      </div>
    </div>
  );
}
