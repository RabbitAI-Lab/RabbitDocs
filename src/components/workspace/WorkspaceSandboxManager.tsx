"use client";

import { useState } from "react";
import { Modal } from "antd";
import type { SandboxStatus } from "@/lib/fs";

interface WorkspaceSandboxManagerProps {
  workspacePath: string;
  sandbox?: SandboxStatus;
  onSandboxChange: (sandbox: SandboxStatus) => void;
}

export default function WorkspaceSandboxManager({
  workspacePath,
  sandbox,
  onSandboxChange,
}: WorkspaceSandboxManagerProps) {
  const [loading, setLoading] = useState(false);

  // 修复 bug: 实际是 "/" 分隔
  const dirSegments = workspacePath.split("/").filter(Boolean);

  const handleRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fs/workspace-sandbox", {
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
      const res = await fetch("/api/fs/workspace-sandbox", {
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
      content:
        "After release, code analysis will not be available. Are you sure you want to release the sandbox?",
      okText: "Confirm Release",
      cancelText: "Cancel",
      okButtonProps: { danger: true },
      onOk: doRelease,
    });
  };

  const isEnabled = sandbox?.enabled ?? false;

  return (
    <div className="space-y-3">
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
          Sandbox is shared across all projects in this workspace. It provides a
          secure execution environment for running and analyzing code snippets.
        </p>
      </div>

      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100">
        <div
          className={`w-2 h-2 rounded-full ${
            isEnabled ? "bg-green-500" : "bg-gray-300"
          }`}
        />
        <div className="flex-1">
          <span className="text-sm font-medium text-gray-700">
            {isEnabled ? "Sandbox Requested" : "Sandbox Not Requested"}
          </span>
          {isEnabled && sandbox?.requestedAt && (
            <p className="text-xs text-gray-400">
              Requested at:{" "}
              {new Date(sandbox.requestedAt).toLocaleString()}
            </p>
          )}
          {!isEnabled && sandbox?.releasedAt && (
            <p className="text-xs text-gray-400">
              Released at:{" "}
              {new Date(sandbox.releasedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

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
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-md transition-colors"
          >
            {loading ? (
              <svg
                className="w-4 h-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
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
