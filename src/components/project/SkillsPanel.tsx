"use client";

import { useState, useEffect } from "react";
import { Switch, App } from "antd";

interface SkillsPanelProps {
  projectPath: string;
}

export default function SkillsPanel({ projectPath }: SkillsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eccEnabled, setEccEnabled] = useState(false);
  const [eccVersion, setEccVersion] = useState<string | null>(null);
  const [eccError, setEccError] = useState<string | null>(null);
  const { message } = App.useApp();

  const dirSegments = projectPath.split(",");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/fs/project-skills?dirSegments=${dirSegments.join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          const ecc = data.skills?.ecc;
          setEccEnabled(ecc?.enabled ?? false);
          setEccVersion(ecc?.version ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dirSegments]);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    setEccError(null);
    try {
      const res = await fetch("/api/fs/project-skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirSegments,
          skillId: "ecc",
          enabled: checked,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const ecc = data.skills?.ecc;
        setEccEnabled(ecc?.enabled ?? false);
        setEccVersion(ecc?.version ?? null);
        message.success(checked ? "ECC 已启用" : "ECC 已卸载");
      } else {
        const data = await res.json();
        setEccError(data.details || data.error || "操作失败");
        message.error(data.error || "操作失败");
      }
    } catch {
      setEccError("网络错误");
      message.error("网络错误");
    } finally {
      setSaving(false);
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
      {/* 提示信息 */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <svg
          className="w-4 h-4 text-blue-500 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <p className="text-sm text-blue-700">
          Skills 是项目级的 AI 能力扩展。启用后，AI 对话中将获得对应增强能力。
        </p>
      </div>

      {/* ECC 行 */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200">
        <Switch
          size="small"
          checked={eccEnabled}
          loading={saving}
          onChange={handleToggle}
        />
        <span className="text-sm font-medium text-gray-700">ECC</span>
        <span
          className={`text-xs ${eccEnabled ? "text-green-600" : "text-gray-400"}`}
        >
          {eccEnabled ? "已启用" : "未启用"}
        </span>
        {eccEnabled && eccVersion && (
          <span className="text-xs text-gray-400">v{eccVersion}</span>
        )}
      </div>

      {/* 错误提示 */}
      {eccError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
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
          <p className="text-sm text-red-700">{eccError}</p>
        </div>
      )}
    </div>
  );
}
