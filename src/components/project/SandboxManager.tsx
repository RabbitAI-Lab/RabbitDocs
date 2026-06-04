"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { Modal } from "antd";
import type { SandboxStatus } from "@/lib/fs";

interface SandboxManagerProps {
  projectPath: string;
  sandbox?: SandboxStatus;
  onSandboxChange: (sandbox: SandboxStatus) => void;
}

export default function SandboxManager({
  projectPath,
  sandbox,
  onSandboxChange,
}: SandboxManagerProps) {
  const [loading, setLoading] = useState(false);
  const { authFetch } = useAuth();

  const dirSegments = projectPath.split(",");

  const handleRequest = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/fs/project-sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirSegments,
          sandbox: {
            enabled: true,
            requestedAt: new Date().toISOString(),
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onSandboxChange(data.sandbox);
      }
    } finally {
      setLoading(false);
    }
  };

  const doRelease = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/fs/project-sandbox", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirSegments,
          sandbox: {
            enabled: false,
            releasedAt: new Date().toISOString(),
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onSandboxChange(data.sandbox);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = () => {
    Modal.confirm({
      title: "Confirm Release Sandbox",
      content: "After release, code analysis will not be available. Are you sure you want to release the sandbox?",
      okText: "Confirm Release",
      cancelText: "Cancel",
      okButtonProps: { danger: true },
      onOk: doRelease,
    });
  };

  const isEnabled = sandbox?.enabled ?? false;

  return (
    <div className="space-y-3">
      {/* 提示信息 */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
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
          Sandbox is only needed when analyzing code. It provides a secure execution environment for running and analyzing code snippets.
        </p>
      </div>

      {/* 沙盒状态 */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 dark:border-zinc-700">
        <div
          className={`w-2 h-2 rounded-full ${
            isEnabled ? "bg-green-500" : "bg-gray-300 dark:bg-zinc-600"
          }`}
        />
        <div className="flex-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {isEnabled ? "Sandbox Requested" : "Sandbox Not Requested"}
          </span>
          {isEnabled && sandbox?.requestedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Requested at: {new Date(sandbox.requestedAt).toLocaleString()}
            </p>
          )}
          {!isEnabled && sandbox?.releasedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Released at: {new Date(sandbox.releasedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {!isEnabled ? (
          <button
            onClick={handleRequest}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
          >
            {loading ? (
              <svg
                className="w-4 h-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  strokeOpacity="0.25"
                />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
            Request Sandbox
          </button>
        ) : (
          <button
            onClick={handleRelease}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 disabled:bg-red-25 rounded-md transition-colors"
          >
            {loading ? (
              <svg
                className="w-4 h-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  strokeOpacity="0.25"
                />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            )}
            Release Sandbox
          </button>
        )}
      </div>
    </div>
  );
}