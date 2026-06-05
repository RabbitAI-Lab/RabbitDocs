"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import type { Repository } from "@/lib/fs";

interface RepositorySyncStatusProps {
  repository: Repository;
  className?: string;
}

const STATUS_STYLE: Record<string, { color: string; icon: string }> = {
  not_cloned: {
    color: "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400",
    icon: "⏳",
  },
  synced: {
    color: "bg-green-100 text-green-700",
    icon: "✓",
  },
  behind: {
    color: "bg-orange-100 text-orange-700",
    icon: "↓",
  },
  error: {
    color: "bg-red-100 text-red-700",
    icon: "✕",
  },
};

const STATUS_KEY: Record<string, string> = {
  not_cloned: "syncStatus.notCloned",
  synced: "syncStatus.upToDate",
  behind: "syncStatus.behind",
  error: "syncStatus.error",
};

/**
 * 仓库同步状态指示器
 */
export default function RepositorySyncStatus({
  repository,
  className,
}: RepositorySyncStatusProps) {
  const t = useTranslations('project');
  const status = repository.syncStatus || "not_cloned";
  const style = STATUS_STYLE[status] || STATUS_STYLE.not_cloned;
  const label = t(STATUS_KEY[status] || STATUS_KEY.not_cloned);

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
        style.color,
        className
      )}
      title={repository.errorMessage || label}
    >
      <span>{style.icon}</span>
      <span>{label}</span>
    </span>
  );
}
