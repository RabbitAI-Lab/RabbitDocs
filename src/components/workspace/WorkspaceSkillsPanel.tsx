"use client";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { Switch, App } from "antd";

interface WorkspaceSkillsPanelProps {
  workspacePath: string;
}

export default function WorkspaceSkillsPanel({
  workspacePath,
}: WorkspaceSkillsPanelProps) {
  const t = useTranslations('workspace');
  const [loading, setLoading] = useState(true);
  const { authFetch } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);
  const [eccEnabled, setEccEnabled] = useState(false);
  const [eccVersion, setEccVersion] = useState<string | null>(null);
  const [eccError, setEccError] = useState<string | null>(null);
  const [huashuEnabled, setHuashuEnabled] = useState(false);
  const [huashuVersion, setHuashuVersion] = useState<string | null>(null);
  const [huashuError, setHuashuError] = useState<string | null>(null);
  const { message } = App.useApp();

  // 修复 bug: 实际是 "/" 分隔
  const dirSegments = workspacePath.split("/").filter(Boolean);

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/fs/workspace-skills?dirSegments=${dirSegments.join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          const ecc = data.skills?.ecc;
          setEccEnabled(ecc?.enabled ?? false);
          setEccVersion(ecc?.version ?? null);
          const huashu = data.skills?.huashu;
          setHuashuEnabled(huashu?.enabled ?? false);
          setHuashuVersion(huashu?.version ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dirSegments]);

  const handleToggle = async (
    skillId: "ecc" | "huashu",
    checked: boolean,
  ) => {
    setSaving(skillId);
    if (skillId === "ecc") setEccError(null);
    else setHuashuError(null);
    try {
      const res = await authFetch("/api/fs/workspace-skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirSegments,
          skillId,
          enabled: checked,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (skillId === "ecc") {
          const ecc = data.skills?.ecc;
          setEccEnabled(ecc?.enabled ?? false);
          setEccVersion(ecc?.version ?? null);
        } else {
          const huashu = data.skills?.huashu;
          setHuashuEnabled(huashu?.enabled ?? false);
          setHuashuVersion(huashu?.version ?? null);
        }
        message.success(
          checked
            ? t('skills.enabledMsg', { name: skillId === "ecc" ? t('skills.ecc') : t('skills.huashuDesign') })
            : t('skills.disabledMsg', { name: skillId === "ecc" ? t('skills.ecc') : t('skills.huashuDesign') }),
        );
      } else {
        const data = await res.json();
        const errorMsg = data.details || data.error || t('skills.operationFailed');
        if (skillId === "ecc") setEccError(errorMsg);
        else setHuashuError(errorMsg);
        message.error(data.error || t('skills.operationFailed'));
      }
    } catch {
      const errorMsg = t('skills.networkError');
      if (skillId === "ecc") setEccError(errorMsg);
      else setHuashuError(errorMsg);
      message.error(t('skills.networkError'));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg
          className="w-5 h-5 animate-spin text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800">
        <svg
          className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <p className="text-sm text-indigo-700 dark:text-indigo-300">
          {t('skills.description')}
        </p>
      </div>

      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700">
        <Switch
          size="small"
          checked={eccEnabled}
          loading={saving === "ecc"}
          onChange={(checked) => handleToggle("ecc", checked)}
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('skills.ecc')}</span>
        <span
          className={`text-xs ${
            eccEnabled ? "text-green-600" : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {eccEnabled ? t('skills.enabled') : t('skills.disabled')}
        </span>
        {eccVersion && (
          <span className="text-xs text-gray-400 dark:text-gray-500">v{eccVersion}</span>
        )}
      </div>

      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700">
        <Switch
          size="small"
          checked={huashuEnabled}
          loading={saving === "huashu"}
          onChange={(checked) => handleToggle("huashu", checked)}
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('skills.huashuDesign')}
        </span>
        <span
          className={`text-xs ${
            huashuEnabled ? "text-green-600" : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {huashuEnabled ? t('skills.enabled') : t('skills.disabled')}
        </span>
        {huashuVersion && (
          <span className="text-xs text-gray-400 dark:text-gray-500">v{huashuVersion}</span>
        )}
      </div>

      {eccError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-100 dark:border-red-800">
          <svg
            className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-300">{eccError}</p>
        </div>
      )}
      {huashuError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-100 dark:border-red-800">
          <svg
            className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-300">{huashuError}</p>
        </div>
      )}
    </div>
  );
}
