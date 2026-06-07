"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { useSearchParams, useRouter } from "next/navigation";
import type { ProjectMeta } from "@/lib/fs";

export default function NewChatWorkspace() {
  const t = useTranslations("chat");
  const tc = useTranslations("common");
  const tp = useTranslations("projects");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authFetch, user } = useAuth();
  const preselectProjectId = searchParams.get("project");

  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const autoSelectedRef = useRef(false);

  // --- Create first project ---

  const handleCreateProject = useCallback(async () => {
    const baseName = tp('defaultProjectName');
    const existingNames = new Set(projects.map((p) => p.name));
    const name = existingNames.has(baseName)
      ? (() => { let i = 1; while (existingNames.has(`${baseName}(${i})`)) i++; return `${baseName}(${i})`; })()
      : baseName;
    const res = await authFetch("/api/fs/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "personal", accountId: user?.id, name }),
    });
    if (!res.ok) return;
    const meta: ProjectMeta = await res.json();
    try { localStorage.setItem("last-selected-project", meta.id); } catch { /* ignore */ }
    router.push(`/project/${meta.id}?openChat=true`);
  }, [authFetch, user?.id, projects, tp, router]);

  // --- Project list fetch ---

  useEffect(() => {
    if (!user) return;
    authFetch(`/api/fs/projects?type=personal&accountId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setProjects(list);
        setLoading(false);

        // Auto-select project from URL param ?project=xxx
        if (preselectProjectId && !autoSelectedRef.current) {
          const found = list.find((p: ProjectMeta) => p.id === preselectProjectId);
          if (found) {
            autoSelectedRef.current = true;
            try { localStorage.setItem("last-selected-project", found.id); } catch { /* ignore */ }
            router.replace(`/project/${found.id}?openChat=true`);
          }
        }
      })
      .catch(() => {
        setProjects([]);
        setLoading(false);
      });
  }, [authFetch, user, preselectProjectId, router]);

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
        <span className="text-sm">{tc("loading")}</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-start justify-center h-full bg-white dark:bg-[var(--sidebar-bg)] pt-[200px]">
        <div className="text-center max-w-[280px] mx-4 animate-glow-soft rounded-2xl px-8 py-10 bg-gradient-to-b from-blue-50/70 to-white/60 dark:from-blue-950/25 dark:to-zinc-800/30">
          <div className="animate-float-gentle mb-5">
            <svg className="w-12 h-12 mx-auto text-blue-300 dark:text-blue-400/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </div>
          <p className="text-[15px] leading-relaxed text-blue-500/80 dark:text-blue-300/70 font-medium">
            {t("newChatWorkspace.noProjectHint")}
          </p>
          <button
            onClick={handleCreateProject}
            className="mt-5 inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("newChatWorkspace.createFirstProject")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-center h-full bg-white dark:bg-[var(--sidebar-bg)] pt-[200px]">
      <div className="text-center max-w-[280px] mx-4 animate-glow-soft rounded-2xl px-8 py-10 bg-gradient-to-b from-blue-50/70 to-white/60 dark:from-blue-950/25 dark:to-zinc-800/30">
        <div className="animate-float-gentle mb-5">
          <svg className="w-12 h-12 mx-auto text-blue-300 dark:text-blue-400/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-[15px] leading-relaxed text-blue-500/80 dark:text-blue-300/70 font-medium">
          {t("newChatWorkspace.pleaseSelectProject")}
        </p>
        <div className="mt-4 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-blue-400/50 dark:text-blue-500/40 animate-arrow-glide" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
