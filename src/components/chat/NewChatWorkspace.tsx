"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { useSearchParams, useRouter } from "next/navigation";
import type { ProjectMeta } from "@/lib/fs";

// --- Time-based greeting ---
function getGreeting(t: ReturnType<typeof useTranslations>) {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return t("welcome.greeting.morning");
  if (hour >= 12 && hour < 18) return t("welcome.greeting.afternoon");
  if (hour >= 18 && hour < 23) return t("welcome.greeting.evening");
  return t("welcome.greeting.lateNight");
}

export default function NewChatWorkspace() {
  const t = useTranslations("chat");
  const tc = useTranslations("common");
  const tp = useTranslations("projects");
  const tw = useTranslations("workspaces");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authFetch, user, isLoading: authLoading, hasFeature } = useAuth();
  const preselectProjectId = searchParams.get("project");

  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [workspaces, setWorkspaces] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const autoSelectedRef = useRef(false);

  // --- Fetch data ---
  useEffect(() => {
    if (authLoading || !user) return;

    const p = authFetch(`/api/fs/projects?type=personal&accountId=${user.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => (Array.isArray(d) ? d : []))
      .catch<ProjectMeta[]>(() => []);

    const w = authFetch(`/api/fs/workspaces?type=personal&accountId=${user.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => (Array.isArray(d) ? d : []))
      .catch<ProjectMeta[]>(() => []);

    Promise.all([p, w]).then(([pList, wList]) => {
      setProjects(pList);
      setWorkspaces(wList);
      setLoading(false);

      // Auto-select project from URL param ?project=xxx
      if (preselectProjectId && !autoSelectedRef.current) {
        const found = pList.find((pr: ProjectMeta) => pr.id === preselectProjectId);
        if (found) {
          autoSelectedRef.current = true;
          try {
            localStorage.setItem("last-selected-location", `project/${found.id}`);
          } catch {
            /* ignore */
          }
          router.replace(`/project/${found.id}?openChat=true`);
        }
      }
    });
  }, [authFetch, user, preselectProjectId, router, authLoading]);

  // --- Create handlers ---
  const handleCreateProject = useCallback(async () => {
    const baseName = tp("defaultProjectName");
    const existingNames = new Set(projects.map((p) => p.name));
    const name = existingNames.has(baseName)
      ? (() => {
          let i = 1;
          while (existingNames.has(`${baseName}(${i})`)) i++;
          return `${baseName}(${i})`;
        })()
      : baseName;
    const res = await authFetch("/api/fs/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "personal", accountId: user?.id, name }),
    });
    if (!res.ok) return;
    const meta: ProjectMeta = await res.json();
    try {
      localStorage.setItem("last-selected-location", `project/${meta.id}`);
    } catch {
      /* ignore */
    }
    router.push(`/project/${meta.id}?openChat=true`);
  }, [authFetch, user?.id, projects, tp, router]);

  const handleCreateWorkspace = useCallback(async () => {
    const baseName = tw("defaultWorkspaceName");
    const existingNames = new Set(workspaces.map((w) => w.name));
    const name = existingNames.has(baseName)
      ? (() => {
          let i = 1;
          while (existingNames.has(`${baseName}(${i})`)) i++;
          return `${baseName}(${i})`;
        })()
      : baseName;
    const res = await authFetch("/api/fs/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "personal", accountId: user?.id, name }),
    });
    if (!res.ok) {
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.upgradeRequired) {
          router.push("/billing");
          return;
        }
      }
      return;
    }
    const meta: ProjectMeta = await res.json();
    try {
      localStorage.setItem("last-selected-location", `workspace/${meta.id}`);
    } catch {
      /* ignore */
    }
    router.push(`/workspace/${meta.id}?openChat=true`);
  }, [authFetch, user?.id, workspaces, tw, router]);

  const handleSelectProject = (id: string) => {
    try {
      localStorage.setItem("last-selected-location", `project/${id}`);
    } catch {
      /* ignore */
    }
    router.push(`/project/${id}?openChat=true`);
  };

  const handleSelectWorkspace = (id: string) => {
    try {
      localStorage.setItem("last-selected-location", `workspace/${id}`);
    } catch {
      /* ignore */
    }
    router.push(`/workspace/${id}?openChat=true`);
  };

  // --- Render: Loading ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
        <span className="text-sm">{tc("loading")}</span>
      </div>
    );
  }

  const showWorkspaces = hasFeature("workspace");

  // --- Render: Empty state (no projects, no workspaces) ---
  if (projects.length === 0 && (!showWorkspaces || workspaces.length === 0)) {
    return (
      <div className="new-chat-page">
        <div className="new-chat-page__empty">
          <div className="new-chat-page__empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="new-chat-page__empty-text">{t("newChatWorkspace.noProjectHint")}</p>
          <button onClick={handleCreateProject} className="new-chat-page__create-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("newChatWorkspace.createFirstProject")}
          </button>
        </div>
      </div>
    );
  }

  // --- Render: Project/Workspace picker ---
  return (
    <div className="new-chat-page">
      <div className="new-chat-page__content">
        {/* Header */}
        <div className="new-chat-page__header">
          <span className="new-chat-page__greeting">{getGreeting(t)}</span>
          <h2 className="new-chat-page__title">{t("newChatWorkspace.pickToStart")}</h2>
        </div>

        {/* Projects section */}
        <section className="new-chat-page__section">
          <div className="new-chat-page__section-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>{t("newChatWorkspace.projects")}</span>
          </div>
          <div className="new-chat-page__grid">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelectProject(project.id)}
                className="new-chat-page__card"
              >
                <div className="new-chat-page__card-icon new-chat-page__card-icon--project">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <span className="new-chat-page__card-name">{project.name}</span>
              </button>
            ))}
            {/* Create new project card */}
            <button onClick={handleCreateProject} className="new-chat-page__card new-chat-page__card--create">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="new-chat-page__card-name">{tp("newProject")}</span>
            </button>
          </div>
        </section>

        {/* Workspaces section */}
        {showWorkspaces && (
          <section className="new-chat-page__section">
            <div className="new-chat-page__section-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <span>{t("newChatWorkspace.workspaces")}</span>
            </div>
            <div className="new-chat-page__grid">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws.id)}
                  className="new-chat-page__card"
                >
                  <div className="new-chat-page__card-icon new-chat-page__card-icon--workspace">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  </div>
                  <span className="new-chat-page__card-name">{ws.name}</span>
                </button>
              ))}
              <button onClick={handleCreateWorkspace} className="new-chat-page__card new-chat-page__card--create">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="new-chat-page__card-name">{tw("newWorkspace")}</span>
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
