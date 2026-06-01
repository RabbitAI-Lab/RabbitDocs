"use client";

import { useState } from "react";
import type { Repository, SandboxStatus } from "@/lib/fs";
import RepositoryManager from "./RepositoryManager";
import SandboxManager from "./SandboxManager";

interface IntegrationPanelProps {
  projectPath: string;
  repositories: Repository[];
  sandbox?: SandboxStatus;
  onRepositoriesChange: (repos: Repository[]) => void;
  onSandboxChange: (sandbox: SandboxStatus) => void;
}

interface IntegrationGroup {
  key: string;
  label: string;
  icon: string;
  description: string;
}

const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    key: "repository",
    label: "代码库",
    icon: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22",
    description: "绑定 Git 代码仓库，关联项目源代码",
  },
  {
    key: "sandbox",
    label: "沙盒申请",
    icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    description: "申请安全沙盒环境，用于代码分析和执行",
  },
];

export default function IntegrationPanel({
  projectPath,
  repositories,
  sandbox,
  onRepositoriesChange,
  onSandboxChange,
}: IntegrationPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["repository"])
  );

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">管理项目的外部集成配置</p>

      <div className="space-y-2">
        {INTEGRATION_GROUPS.map((group) => {
          const isExpanded = expandedGroups.has(group.key);
          return (
            <div
              key={group.key}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <svg
                  className="w-4 h-4 text-gray-400 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d={group.icon} />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700">
                    {group.label}
                  </span>
                  <p className="text-xs text-gray-400 truncate">
                    {group.description}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {group.key === "repository" && (
                    <RepositoryManager
                      projectPath={projectPath}
                      repositories={repositories}
                      onRepositoriesChange={onRepositoriesChange}
                    />
                  )}
                  {group.key === "sandbox" && (
                    <SandboxManager
                      projectPath={projectPath}
                      sandbox={sandbox}
                      onSandboxChange={onSandboxChange}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
