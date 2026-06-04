"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const menuGroups = [
  {
    title: "General",
    items: [
      {
        href: "/admin/general",
        label: "Site Settings",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "AI Services",
    items: [
      {
        href: "/admin/models",
        label: "Model Config",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        ),
      },
      {
        href: "/admin/mcp",
        label: "MCP Config",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v4" />
            <path d="m6.8 15-3.5 2" />
            <path d="m20.7 17-3.5-2" />
            <path d="M6.8 9 3.3 7" />
            <path d="m20.7 7-3.5 2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="6" r="2" />
            <circle cx="6.8" cy="9" r="2" />
            <circle cx="17.2" cy="9" r="2" />
            <circle cx="6.8" cy="15" r="2" />
            <circle cx="17.2" cy="15" r="2" />
          </svg>
        ),
      },
      {
        href: "/admin/system-prompts",
        label: "System Prompts",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      {
        href: "/admin/sandbox",
        label: "Sandbox Config",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ),
      },
      {
        href: "/admin/storage",
        label: "File Storage",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
      {
        href: "/admin/email",
        label: "Email",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        ),
      },
      {
        href: "/admin/database",
        label: "Database",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5V19A9 3 0 0 0 21 19V5" />
            <path d="M3 12A9 3 0 0 0 21 12" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "User Management",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
      {
        href: "/admin/invite-codes",
        label: "Invite Codes",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 12l2 2 4-4" />
            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.04 0 3.93.68 5.45 1.84" />
            <path d="M16 4l4 4-4 4" />
          </svg>
        ),
      },
      {
        href: "/admin/auth",
        label: "Auth",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Business",
    items: [
      {
        href: "/admin/plans",
        label: "Plans",
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M12 4v16" />
            <path d="M2 12h20" />
          </svg>
        ),
      },
    ],
  },
];

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="w-[200px] h-full flex flex-col border-r border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">System Admin</h2>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        {menuGroups.map((group, groupIndex) => (
          <div key={group.title}>
            <div
              className={cn(
                "px-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider",
                groupIndex === 0 ? "pt-1 pb-1" : "pt-3 pb-1"
              )}
            >
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <div
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer select-none text-gray-900 dark:text-gray-100",
                      isActive && "bg-blue-50 dark:bg-blue-900/30 font-medium",
                      !isActive && "hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                    )}
                  >
                    <span className={cn("text-blue-500")}>{item.icon}</span>
                    {item.label}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
