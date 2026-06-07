"use client";

import { useTranslations } from "next-intl";
import SidebarShell from "./SidebarShell";
import NewChatButton from "./NewChatButton";
import NavLink from "./NavLink";
import TodoNavLink from "./TodoNavLink";
import ProjectsPanel from "./ProjectsPanel";
import WorkspacesPanel from "./WorkspacesPanel";
import ResizableChatsHistory from "./ResizableChatsHistory";
import AuthGate from "./AuthGate";
import AdminNavLink from "./AdminNavLink";
import MyAccountMenu from "./MyAccountMenu";

interface SidebarProps {
  initialWidth?: string;
  initialCollapsed?: string;
  brandName: string;
}

export default function Sidebar({ initialWidth, initialCollapsed, brandName }: SidebarProps) {
  const t = useTranslations("sidebar");
  return (
    <SidebarShell initialWidth={initialWidth} initialCollapsed={initialCollapsed} brandName={brandName}>
      {/* New Document Button */}
      <div className="px-2 pt-2 pb-1">
        <NewChatButton />
      </div>

      {/* Todo menu button */}
      <div className="px-2 mb-1">
        <TodoNavLink />
      </div>

      {/* Chats menu button */}
      <div className="px-2 mb-1">
        <NavLink
          href="/chats"
          icon={
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
        >
          {t('chats')}
        </NavLink>
      </div>

      {/* Templates menu button */}
      <div className="px-2 mb-1">
        <NavLink
          href="/templates"
          icon={
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          }
        >
          {t('templates')}
        </NavLink>
      </div>

      {/* Projects & Workspaces */}
      <div className="flex-1 overflow-y-auto">
        <AuthGate>
          <ProjectsPanel />
          <WorkspacesPanel />
        </AuthGate>
      </div>

      {/* Chats History - resizable */}
      <div className="shrink-0">
        <div className="h-2 flex items-center group">
          <div className="w-full h-px bg-transparent group-hover:bg-gray-100 dark:group-hover:bg-zinc-700 transition-colors" />
        </div>
        <AuthGate>
          <ResizableChatsHistory />
        </AuthGate>
      </div>

      {/* Sandbox & Admin menu buttons */}
      <div className="border-t border-gray-100 dark:border-zinc-700 px-3 py-2 space-y-1">
        <NavLink
          href="/sandbox"
          icon={
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          }
        >
          {t('projectSandbox')}
        </NavLink>
        <AdminNavLink />
        <MyAccountMenu />
      </div>
    </SidebarShell>
  );
}
