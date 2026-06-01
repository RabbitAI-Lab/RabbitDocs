"use client";

import { useState } from "react";
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

  const dirSegments = projectPath.split(",");

  const handleRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fs/project-sandbox", {
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
      const res = await fetch("/api/fs/project-sandbox", {
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
      title: "确认释放沙盒",
      content: "释放后无法进行代码分析，确定要释放沙盒吗？",
      okText: "确认释放",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: doRelease,
    });
  };

  const isEnabled = sandbox?.enabled ?? false;

  return (
    <div className="space-y-3">
      {/* 提示信息 */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
        <svg
          className="w-4 h-4 text-amber-500 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-sm text-amber-700">
          只有需要分析代码时才需要申请沙盒。沙盒提供安全的代码执行环境，用于运行和分析代码片段。
        </p>
      </div>

      {/* 沙盒状态 */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100">
        <div
          className={`w-2 h-2 rounded-full ${
            isEnabled ? "bg-green-500" : "bg-gray-300"
          }`}
        />
        <div className="flex-1">
          <span className="text-sm font-medium text-gray-700">
            {isEnabled ? "沙盒已申请" : "沙盒未申请"}
          </span>
          {isEnabled && sandbox?.requestedAt && (
            <p className="text-xs text-gray-400">
              申请时间：{new Date(sandbox.requestedAt).toLocaleString("zh-CN")}
            </p>
          )}
          {!isEnabled && sandbox?.releasedAt && (
            <p className="text-xs text-gray-400">
              释放时间：{new Date(sandbox.releasedAt).toLocaleString("zh-CN")}
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
            申请沙盒
          </button>
        ) : (
          <button
            onClick={handleRelease}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:bg-red-25 rounded-md transition-colors"
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
            释放沙盒
          </button>
        )}
      </div>
    </div>
  );
}