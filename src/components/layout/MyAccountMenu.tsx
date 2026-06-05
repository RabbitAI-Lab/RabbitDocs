"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { useSidebar } from "./SidebarContext";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";
import { useLocaleSwitch } from "@/hooks/useLocaleSwitch";

export default function MyAccountMenu() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { collapsed } = useSidebar();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("sidebar");
  const { currentLocale, switchLocale } = useLocaleSwitch();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const email = user?.email ?? "user@example.com";
  const name = user?.name ?? t('myAccount');
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const menuItems = [
    { label: t('profile'), href: "/profile" },
    { label: t('billing'), href: "/billing" },
    { label: t('docs'), href: "/docs" },
    { label: t('account'), href: "/settings" },
  ];

  return (
    <div className="relative w-full">
      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 w-full py-1.5 text-sm rounded-lg transition-colors cursor-pointer select-none",
          collapsed ? "px-0 justify-center" : "px-3",
          open
            ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium"
            : "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
        )}
      >
        <svg
          className="w-4 h-4 text-blue-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        {!collapsed && <span className="flex-1">{t('myAccount')}</span>}
      </div>

      {/* Popup Menu */}
      {open && (
        <div
          ref={menuRef}
          className={cn(
            "absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-[var(--popup-bg)] rounded-xl border border-gray-200 dark:border-[var(--popup-border)] shadow-lg z-50 overflow-hidden",
            collapsed && "left-full bottom-0 mb-0 ml-2"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-[var(--popup-header-bg)]">
            <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('appearance')}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => switchLocale(currentLocale === 'zh' ? 'en' : 'zh')}
                className="text-xs px-2 py-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {currentLocale === 'zh' ? 'EN' : '中'}
              </button>
              <ThemeToggle />
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {menuItems.map((item) => (
              <div
                key={item.href}
                onClick={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer select-none transition-colors"
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Footer - Sign Out */}
          <div className="border-t border-gray-100 dark:border-gray-700 py-1">
            <div
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer select-none transition-colors"
            >
              {t('signOut')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
