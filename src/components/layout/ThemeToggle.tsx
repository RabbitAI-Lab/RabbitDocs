"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const themeKeys = ["system", "light", "dark"] as const;

const icons: Record<string, React.ReactNode> = {
  system: (
    <svg
      className="w-2.5 h-2.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  light: (
    <svg
      className="w-2.5 h-2.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  dark: (
    <svg
      className="w-2.5 h-2.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
};

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("theme");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center p-[2px] rounded-md bg-gray-100 dark:bg-gray-800">
        {themeKeys.map((key) => (
          <div
            key={key}
            className="w-5 h-5 rounded-sm bg-gray-200/80 dark:bg-gray-700/80"
          />
        ))}
      </div>
    );
  }

  const activeIndex = themeKeys.findIndex((key) => key === theme);

  return (
    <div className="relative flex items-center p-[2px] rounded-md bg-gray-100 dark:bg-gray-800">
      {/* Sliding indicator */}
      <div
        className="absolute top-[2px] w-5 h-5 rounded-sm bg-white dark:bg-gray-700 shadow-sm transition-transform duration-500 ease-in-out"
        style={{
          transform: `translateX(${activeIndex * 20}px)`,
        }}
      />

      {themeKeys.map((key) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          className={cn(
            "relative z-10 flex items-center justify-center w-5 h-5 rounded-sm transition-colors duration-500 select-none",
            theme === key
              ? "text-gray-900 dark:text-gray-100"
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          )}
          title={t(key)}
        >
          {icons[key]}
        </button>
      ))}
    </div>
  );
}
