"use client";

import { useTranslations } from "next-intl";
import type { Repository } from "@/lib/fs";

interface WorkspaceRepositorySyncStatusProps {
  repository: Repository;
}

const STATUS_KEY_MAP: Record<string, string> = {
  not_cloned: "syncStatus.notCloned",
  cloned: "syncStatus.cloned",
  up_to_date: "syncStatus.upToDate",
  behind: "syncStatus.behind",
  error: "syncStatus.error",
  syncing: "syncStatus.syncing",
};

const STATUS_STYLE: Record<
  string,
  { color: string; bgColor: string }
> = {
  not_cloned: {
    color: "text-gray-500",
    bgColor: "bg-gray-100",
  },
  cloned: {
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  up_to_date: {
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  behind: {
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  error: {
    color: "text-red-700",
    bgColor: "bg-red-100",
  },
  syncing: {
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
};

export default function WorkspaceRepositorySyncStatus({
  repository,
}: WorkspaceRepositorySyncStatusProps) {
  const t = useTranslations('workspace');
  const status = repository.syncStatus || "not_cloned";
  const style = STATUS_STYLE[status] || STATUS_STYLE.not_cloned;
  const statusKey = STATUS_KEY_MAP[status] || STATUS_KEY_MAP.not_cloned;
  const label = t(statusKey);

  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${style.color} ${style.bgColor}`}
      title={
        repository.errorMessage
          ? `${label}: ${repository.errorMessage}`
          : label
      }
    >
      {label}
    </span>
  );
}
