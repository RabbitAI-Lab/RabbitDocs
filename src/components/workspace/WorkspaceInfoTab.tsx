"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import type { Repository, ProjectMember, GitNexusStatus } from "@/lib/fs";
import type { DocumentActivity, RecentChat } from "@/lib/types";
import WorkspaceActivityPanel from "./WorkspaceActivityPanel";
import WorkspaceProjectsPanel from "./WorkspaceProjectsPanel";
import WorkspaceIntegrationPanel from "./WorkspaceIntegrationPanel";
import WorkspaceSkillsPanel from "./WorkspaceSkillsPanel";
import WorkspaceMcpPanel from "./WorkspaceMcpPanel";
import WorkspaceMemberManager from "./WorkspaceMemberManager";
import WorkspaceLogPanel from "./WorkspaceLogPanel";
import Badge from "@/components/ui/Badge";

interface WorkspaceMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
  sortOrder: number;
  repositories?: Repository[];
  gitnexusStatus?: GitNexusStatus;
  members?: ProjectMember[];
}

interface LinkedProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
}

type SubTab =
  | "activity"
  | "projects"
  | "integration"
  | "skills"
  | "mcp"
  | "members"
  | "log";

interface WorkspaceInfoTabProps {
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  workspaceMeta: WorkspaceMeta | null;
  linkedProjects: LinkedProject[];
  recentChats: RecentChat[];
  recentDocuments?: DocumentActivity[];
  onSwitchToChat: (chatId: number, projectId: string | null) => void;
  onNewChat: () => void;
  onNavigateToDocument?: (documentPath: string, projectId: string) => void;
  onWorkspaceDeleted: () => void;
  accountType: string;
  accountId: string;
  /** URL 参数传入的子Tab初始值 */
  initialSubTab?: string;
}

const SUB_TAB_KEYS: SubTab[] = [
  "activity",
  "projects",
  "integration",
  "skills",
  "mcp",
  "members",
  "log",
];

export default function WorkspaceInfoTab({
  workspaceId,
  workspaceName,
  workspacePath,
  workspaceMeta,
  linkedProjects,
  recentChats,
  recentDocuments,
  onSwitchToChat,
  onNewChat,
  onNavigateToDocument,
  onWorkspaceDeleted,
  accountType,
  accountId,
  initialSubTab,
}: WorkspaceInfoTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(
    initialSubTab && SUB_TAB_KEYS.includes(initialSubTab as SubTab)
      ? (initialSubTab as SubTab)
      : "activity"
  );
  const t = useTranslations('workspace');
  const { authFetch } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>(
    workspaceMeta?.repositories || []
  );
  const [gitnexusStatus, setGitnexusStatus] = useState<GitNexusStatus | null>(
    workspaceMeta?.gitnexusStatus || null
  );
  const [hasUnsynced, setHasUnsynced] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>(
    workspaceMeta?.members || []
  );

  // workspaceId is passed as a prop directly

  // 检查同步状态
  useEffect(() => {
    if (repositories.length === 0) {
      Promise.resolve().then(() => setHasUnsynced(false));
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await authFetch("/api/fs/workspace-repositories/check-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId }),
        });

        if (res.ok) {
          const data = await res.json();
          const updatedRepos = repositories.map((repo) => {
            const result = data.results.find(
              (r: { repoId: string }) => r.repoId === repo.id
            );
            if (result) {
              return {
                ...repo,
                syncStatus: result.status,
                localCommitHash: result.localHash,
                remoteCommitHash: result.remoteHash,
                errorMessage: result.error,
              };
            }
            return repo;
          });
          setRepositories(updatedRepos);

          const unsynced = updatedRepos.some(
            (r) =>
              r.syncStatus === "not_cloned" ||
              r.syncStatus === "behind" ||
              r.syncStatus === "error"
          );
          setHasUnsynced(unsynced);
        }
      } catch {
        const needsSync = repositories.some(
          (r) => !r.syncStatus || r.syncStatus === "not_cloned"
        );
        setHasUnsynced(needsSync);
      }
    };

    checkStatus();
  }, [repositories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: SubTab) => {
    setActiveSubTab(tab);
    // 同步到 URL
    const url = new URL(window.location.href);
    if (tab === "activity") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState(null, "", url.toString());
    if (tab === "integration") {
      setHasUnsynced(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Sub-tab bar */}
      <div className="flex items-center px-6 border-b border-gray-200 dark:border-zinc-700 shrink-0">
        {SUB_TAB_KEYS.map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => handleTabChange(tabKey)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeSubTab === tabKey
                ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-zinc-500"
            }`}
          >
            {t(`tabs.${tabKey}`)}
            {tabKey === "integration" && hasUnsynced && (
              <Badge variant="dot" className="ml-1.5" />
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="px-6 py-4">
        {activeSubTab === "activity" && (
          <WorkspaceActivityPanel
            recentChats={recentChats}
            recentDocuments={recentDocuments || []}
            onSwitchToChat={onSwitchToChat}
            onNewChat={onNewChat}
            onNavigateToDocument={onNavigateToDocument}
          />
        )}
        {activeSubTab === "projects" && (
          <WorkspaceProjectsPanel
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            accountType={accountType}
            accountId={accountId}
            initialProjects={linkedProjects}
            onWorkspaceDeleted={onWorkspaceDeleted}
          />
        )}
        {activeSubTab === "integration" && (
          <WorkspaceIntegrationPanel
            workspacePath={workspacePath}
            repositories={repositories}
            gitnexusStatus={gitnexusStatus}
            onRepositoriesChange={setRepositories}
            onGitNexusStatusChange={setGitnexusStatus}
          />
        )}
        {activeSubTab === "skills" && (
          <WorkspaceSkillsPanel workspacePath={workspacePath} />
        )}
        {activeSubTab === "mcp" && (
          <WorkspaceMcpPanel workspacePath={workspacePath} />
        )}
        {activeSubTab === "members" && (
          <WorkspaceMemberManager
            workspacePath={workspacePath}
            members={members}
            onMembersChange={setMembers}
          />
        )}
        {activeSubTab === "log" && (
          <WorkspaceLogPanel workspacePath={workspacePath} />
        )}
      </div>
    </div>
  );
}

