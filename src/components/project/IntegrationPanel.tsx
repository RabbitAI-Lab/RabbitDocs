"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Repository, GitNexusStatus } from "@/lib/fs";
import RepositoryManager from "./RepositoryManager";
import SandboxManager from "./SandboxManager";
import GitNexusManager from "./GitNexusManager";

interface IntegrationPanelProps {
  projectPath: string;
  repositories: Repository[];
  gitnexusStatus: GitNexusStatus | null;
  onRepositoriesChange: (repos: Repository[]) => void;
  onGitNexusStatusChange: (s: GitNexusStatus | null) => void;
}

export default function IntegrationPanel({
  projectPath,
  repositories,
  gitnexusStatus,
  onRepositoriesChange,
  onGitNexusStatusChange,
}: IntegrationPanelProps) {
  const t = useTranslations('project');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["gitnexus", "repository"])
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

  const GROUP_KEYS = ["gitnexus", "repository", "sandbox"] as const;
  const LABEL_KEYS: Record<string, string> = {
    gitnexus: "integration.gitnexusLabel",
    repository: "integration.repositoryLabel",
    sandbox: "integration.sandboxLabel",
  };
  const DESC_KEYS: Record<string, string> = {
    gitnexus: "integration.gitnexusDescription",
    repository: "integration.repositoryDescription",
    sandbox: "integration.sandboxDescription",
  };
  const ICONS: Record<string, string> = {
    gitnexus: "M12 2a10 10 0 1 0 10 10M12 2a10 10 0 0 1 10 10M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07",
    repository: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22",
    sandbox: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('integration.description')}</p>

      <div className="space-y-2">
        {GROUP_KEYS.map((groupKey) => {
          const isExpanded = expandedGroups.has(groupKey);
          return (
            <div
              key={groupKey}
              className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleGroup(groupKey)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors text-left"
              >
                <svg
                  className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d={ICONS[groupKey]} />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {t(LABEL_KEYS[groupKey])}
                  </span>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {t(DESC_KEYS[groupKey])}
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
                  {groupKey === "gitnexus" && (
                    <GitNexusManager
                      projectPath={projectPath}
                      status={gitnexusStatus}
                      onStatusChange={onGitNexusStatusChange}
                    />
                  )}
                  {groupKey === "repository" && (
                    <RepositoryManager
                      projectPath={projectPath}
                      repositories={repositories}
                      onRepositoriesChange={onRepositoriesChange}
                    />
                  )}
                  {groupKey === "sandbox" && (
                    <SandboxManager
                      projectPath={projectPath}
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
