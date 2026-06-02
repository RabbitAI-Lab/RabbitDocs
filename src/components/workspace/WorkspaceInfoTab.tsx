"use client";

import { useState, useEffect } from "react";
import type { Repository, SandboxStatus, ProjectMember } from "@/lib/fs";
import type { DocumentActivity } from "@/lib/types";
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
  sandbox?: SandboxStatus;
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

interface RecentChat {
  id: number;
  title: string;
  updatedAt: string;
  projectId: string | null; // 所属 project，可能为 null（游离 chat）
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
}

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "activity", label: "Activity" },
  { key: "projects", label: "Projects" },
  { key: "integration", label: "Integration" },
  { key: "skills", label: "Skills" },
  { key: "mcp", label: "MCP" },
  { key: "members", label: "Members" },
  { key: "log", label: "Log" },
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
}: WorkspaceInfoTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("activity");
  const [repositories, setRepositories] = useState<Repository[]>(
    workspaceMeta?.repositories || []
  );
  const [sandbox, setSandbox] = useState<SandboxStatus>(
    workspaceMeta?.sandbox || { enabled: false }
  );
  const [hasUnsynced, setHasUnsynced] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>(
    workspaceMeta?.members || []
  );

  // 修复 bug: projectPath 实际是 "/" 分隔,这里 workspacePath 同样使用 "/"
  const dirSegments = workspacePath.split("/").filter(Boolean);

  // 检查同步状态
  useEffect(() => {
    if (repositories.length === 0) {
      setHasUnsynced(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch("/api/fs/workspace-repositories/check-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dirSegments }),
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
    if (tab === "integration") {
      setHasUnsynced(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Sub-tab bar */}
      <div className="flex items-center px-6 border-b border-gray-200 shrink-0">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeSubTab === tab.key
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
            {tab.key === "integration" && hasUnsynced && (
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
            sandbox={sandbox}
            onRepositoriesChange={setRepositories}
            onSandboxChange={setSandbox}
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

