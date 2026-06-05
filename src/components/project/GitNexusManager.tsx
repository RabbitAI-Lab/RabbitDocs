"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { Modal } from "antd";
import { useTranslations } from "next-intl";
import type { GitNexusStatus, GitNexusPhase } from "@/lib/fs";

interface GitNexusManagerProps {
  projectPath: string; // 逗号分隔的 dirSegments
  status: GitNexusStatus | null;
  onStatusChange: (s: GitNexusStatus | null) => void;
}

const PHASE_BADGE_KEY: Record<GitNexusPhase, string> = {
  idle: "gitnexus.notIndexed",
  analyzing: "gitnexus.analyzing",
  cleaning: "gitnexus.cleaning",
  success: "gitnexus.indexed",
  failed: "gitnexus.failed",
};

const PHASE_BADGE_STYLE: Record<GitNexusPhase, { color: string; spin: boolean }> = {
  idle: { color: "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400", spin: false },
  analyzing: { color: "bg-blue-100 text-blue-700", spin: true },
  cleaning: { color: "bg-blue-100 text-blue-700", spin: true },
  success: { color: "bg-green-100 text-green-700", spin: false },
  failed: { color: "bg-red-100 text-red-700", spin: false },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function Spinner() {
  return (
    <svg
      className="w-3 h-3 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

export default function GitNexusManager({
  projectPath,
  status,
  onStatusChange,
}: GitNexusManagerProps) {
  const { authFetch } = useAuth();
  const t = useTranslations('project');
  const phase: GitNexusPhase = status?.phase ?? "idle";
  const badgeKey = PHASE_BADGE_KEY[phase];
  const badgeStyle = PHASE_BADGE_STYLE[phase];
  const isInProgress = phase === "analyzing" || phase === "cleaning";

  // 轮询：每 2s 拉一次最新状态
  useEffect(() => {
    if (!isInProgress) return;
    const timer = setInterval(async () => {
      try {
        const res = await authFetch(`/api/fs/project-gitnexus?dirSegments=${encodeURIComponent(projectPath)}`
        );
        if (res.ok) {
          const data = await res.json();
          if ("status" in data) {
            onStatusChange(data.status ?? null);
          }
        }
      } catch {
        /* ignore polling errors */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [isInProgress, projectPath, onStatusChange]);

  const handleAnalyze = async () => {
    try {
      const res = await authFetch("/api/fs/project-gitnexus/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirSegments: projectPath.split("/"),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status) {
          onStatusChange(data.status);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        Modal.error({
          title: t('gitnexus.failedToStartAnalyze'),
          content: data.error || `Server returned ${res.status}`,
        });
      }
    } catch (e: unknown) {
      Modal.error({
        title: t('gitnexus.failedToStartAnalyze'),
        content: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleCancel = () => {
    Modal.confirm({
      title: t('gitnexus.cancelAnalyze'),
      content: t('gitnexus.cancelAnalyzeContent'),
      okText: t('gitnexus.cancelTask'),
      okButtonProps: { danger: true },
      cancelText: t('gitnexus.keepRunning'),
      onOk: async () => {
        try {
          const res = await authFetch("/api/fs/project-gitnexus/clean", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dirSegments: projectPath.split("/"),
              action: "cancel",
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            Modal.error({
              title: t('gitnexus.failedToCancel'),
              content: data.error || `Server returned ${res.status}`,
            });
          }
        } catch (e: unknown) {
          Modal.error({
            title: t('gitnexus.failedToCancel'),
            content: e instanceof Error ? e.message : String(e),
          });
        }
      },
    });
  };

  const handleClean = () => {
    Modal.confirm({
      title: t('gitnexus.cleanIndex'),
      content: t('gitnexus.cleanIndexContent'),
      okText: t('gitnexus.cleanBtn'),
      okButtonProps: { danger: true },
      cancelText: t('mcp.cancel'),
      onOk: async () => {
        try {
          const res = await authFetch("/api/fs/project-gitnexus/clean", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dirSegments: projectPath.split("/"),
              action: "clean",
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status) {
              onStatusChange(data.status);
            }
          } else {
            const data = await res.json().catch(() => ({}));
            Modal.error({
              title: t('gitnexus.failedToStartAnalyze'),
              content: data.error || `Server returned ${res.status}`,
            });
          }
        } catch (e: unknown) {
          Modal.error({
            title: t('gitnexus.failedToStartAnalyze'),
            content: e instanceof Error ? e.message : String(e),
          });
        }
      },
    });
  };

  return (
    <div className="space-y-3 pt-3">
      {/* 状态 + 按钮 */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${badgeStyle.color}`}
        >
          {badgeStyle.spin && <Spinner />}
          {t(badgeKey)}
        </span>
        <div className="flex-1 min-w-0 text-xs text-gray-500">
          {phase === "success" && status?.lastSuccessAt && (
            <p>{t('gitnexus.lastIndexed', { time: formatTime(status.lastSuccessAt) })}</p>
          )}
          {phase === "failed" && status?.lastError && (
            <p className="text-red-500 truncate" title={status.lastError}>
              {status.lastError}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isInProgress ? (
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              {t('gitnexus.cancelTask')}
            </button>
          ) : (
            <>
              <button
                onClick={handleAnalyze}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                {t('gitnexus.analyze')}
              </button>
              <button
                onClick={handleClean}
                disabled={!status?.indexExists}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('gitnexus.cleanBtn')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
