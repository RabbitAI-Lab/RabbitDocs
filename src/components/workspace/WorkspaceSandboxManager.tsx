"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";
import { App } from "antd";
import { LinkOutlined } from "@ant-design/icons";

interface SandboxApplication {
  id: number;
  status: "pending" | "approved" | "rejected";
  sandboxUrl: string | null;
  remark: string | null;
  bindEntityId: string | null;
}

interface WorkspaceSandboxManagerProps {
  workspacePath: string;
}

export default function WorkspaceSandboxManager({
  workspacePath,
}: WorkspaceSandboxManagerProps) {
  const t = useTranslations('workspace');
  const router = useRouter();
  const { authFetch } = useAuth();
  const { modal } = App.useApp();

  const workspaceId = workspacePath.split("/")[1] || "";

  const [applications, setApplications] = useState<SandboxApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showBindSelect, setShowBindSelect] = useState(false);

  const loadApplications = useCallback(async () => {
    try {
      const res = await authFetch("/api/sandbox-applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (workspaceId) loadApplications();
  }, [workspaceId, loadApplications]);

  // 找到绑定到当前工作空间的沙箱
  const boundSandbox = applications.find(
    (a) => a.bindEntityId === workspaceId && a.status === "approved" && a.sandboxUrl
  ) || null;

  // 可用的（已审批且未绑定其他实体的）沙箱
  const availableApps = applications.filter(
    (a) => a.status === "approved" && a.sandboxUrl && !a.bindEntityId
  );

  const handleBind = async (appId: number) => {
    setActionLoading(true);
    try {
      const res = await authFetch("/api/sandbox-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appId, bindEntityId: workspaceId }),
      });
      if (res.ok) {
        setShowBindSelect(false);
        loadApplications();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const doUnbind = async () => {
    if (!boundSandbox) return;
    setActionLoading(true);
    try {
      const res = await authFetch("/api/sandbox-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: boundSandbox.id, bindEntityId: null }),
      });
      if (res.ok) {
        loadApplications();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbind = () => {
    modal.confirm({
      title: t('sandbox.unbindConfirm'),
      content: t('sandbox.unbindConfirmContent'),
      okText: t('sandbox.confirmBtn'),
      cancelText: t('sandbox.cancel'),
      okButtonProps: { danger: true },
      onOk: doUnbind,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 提示信息 */}
      <div className="flex items-start gap-2 p-3 mt-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
        <svg
          className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {t('sandbox.description')}
        </p>
      </div>

      {boundSandbox ? (
        /* 已绑定状态 */
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                {boundSandbox.remark || t('sandbox.boundSandbox')}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{boundSandbox.sandboxUrl}</p>
          </div>
          <a
            href={boundSandbox.sandboxUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            <LinkOutlined />
            {t('sandbox.openSandbox')}
          </a>
          <button
            onClick={handleUnbind}
            disabled={actionLoading}
            className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-40"
          >
            {t('sandbox.unbind')}
          </button>
        </div>
      ) : (
        /* 未绑定状态 */
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/sandbox')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('sandbox.applyTrial')}
            </button>
            <button
              onClick={() => setShowBindSelect(!showBindSelect)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-950 rounded-md transition-colors"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {t('sandbox.bindSandbox')}
            </button>
          </div>

          {showBindSelect && (
            <div className="p-3 border border-gray-200 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
              {availableApps.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('sandbox.noAvailableSandbox')}
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {t('sandbox.selectSandbox')}
                  </p>
                  {availableApps.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => handleBind(app.id)}
                      disabled={actionLoading}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md border border-gray-200 dark:border-zinc-600 hover:bg-white dark:hover:bg-zinc-700 transition-colors disabled:opacity-40"
                    >
                      <span className="flex-1 min-w-0 truncate font-medium text-gray-700 dark:text-gray-200">
                        {app.remark || app.sandboxUrl}
                      </span>
                      {app.sandboxUrl && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[200px]">
                          {app.sandboxUrl}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
