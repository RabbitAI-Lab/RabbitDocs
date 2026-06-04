"use client";

import { useState } from "react";
import type { Repository, SandboxStatus, GitNexusStatus } from "@/lib/fs";
import WorkspaceGitNexusManager from "./WorkspaceGitNexusManager";
import WorkspaceRepositoryManager from "./WorkspaceRepositoryManager";
import WorkspaceSandboxManager from "./WorkspaceSandboxManager";

interface WorkspaceIntegrationPanelProps {
  workspacePath: string;
  repositories: Repository[];
  sandbox?: SandboxStatus;
  gitnexusStatus: GitNexusStatus | null;
  onRepositoriesChange: (repos: Repository[]) => void;
  onSandboxChange: (sandbox: SandboxStatus) => void;
  onGitNexusStatusChange: (s: GitNexusStatus | null) => void;
}

interface IntegrationGroup {
  key: string;
  label: string;
  icon: string;
  description: string;
}

const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    key: "gitnexus",
    label: "GitNexus",
    icon: "M12 2a10 10 0 1 0 10 10M12 2a10 10 0 0 1 10 10M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07",
    description:
      "Index the workspace root into a local code knowledge graph (force, skip git check)",
  },
  {
    key: "repository",
    label: "Repository",
    icon: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22",
    description:
      "Bind Git repositories to be shared across all projects in this workspace",
  },
  {
    key: "sandbox",
    label: "Sandbox Request",
    icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    description:
      "Request a secure sandbox environment shared across workspace projects",
  },
];

export default function WorkspaceIntegrationPanel({
  workspacePath,
  repositories,
  sandbox,
  gitnexusStatus,
  onRepositoriesChange,
  onSandboxChange,
  onGitNexusStatusChange,
}: WorkspaceIntegrationPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["gitnexus", "repository"]),
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
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Workspace-level integrations shared by all linked projects
      </p>

      <div className="space-y-2">
        {INTEGRATION_GROUPS.map((group) => {
          const isExpanded = expandedGroups.has(group.key);
          return (
            <div
              key={group.key}
              className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors text-left"
              >
                <svg
                  className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d={group.icon} />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {group.label}
                  </span>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {group.description}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${
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
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-zinc-700">
                  {group.key === "gitnexus" && (
                    <WorkspaceGitNexusManager
                      workspacePath={workspacePath}
                      status={gitnexusStatus}
                      onStatusChange={onGitNexusStatusChange}
                    />
                  )}
                  {group.key === "repository" && (
                    <WorkspaceRepositoryManager
                      workspacePath={workspacePath}
                      repositories={repositories}
                      onRepositoriesChange={onRepositoriesChange}
                    />
                  )}
                  {group.key === "sandbox" && (
                    <WorkspaceSandboxManager
                      workspacePath={workspacePath}
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
