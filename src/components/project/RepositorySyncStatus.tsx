import { clsx } from "clsx";
import type { Repository } from "@/lib/fs";

interface RepositorySyncStatusProps {
  repository: Repository;
  className?: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  not_cloned: {
    color: "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400",
    label: "未克隆",
    icon: "⏳",
  },
  synced: {
    color: "bg-green-100 text-green-700",
    label: "已同步",
    icon: "✓",
  },
  behind: {
    color: "bg-orange-100 text-orange-700",
    label: "有更新",
    icon: "↓",
  },
  error: {
    color: "bg-red-100 text-red-700",
    label: "同步失败",
    icon: "✕",
  },
};

/**
 * 仓库同步状态指示器
 */
export default function RepositorySyncStatus({
  repository,
  className,
}: RepositorySyncStatusProps) {
  const status = repository.syncStatus || "not_cloned";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_cloned;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
        config.color,
        className
      )}
      title={repository.errorMessage || config.label}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}