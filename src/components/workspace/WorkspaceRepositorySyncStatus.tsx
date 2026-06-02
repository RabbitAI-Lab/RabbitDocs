"use client";

import type { Repository } from "@/lib/fs";

interface WorkspaceRepositorySyncStatusProps {
  repository: Repository;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  not_cloned: {
    label: "Not Cloned",
    color: "text-gray-500",
    bgColor: "bg-gray-100",
  },
  cloned: {
    label: "Cloned",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  up_to_date: {
    label: "Up to Date",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  behind: {
    label: "Behind",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  error: {
    label: "Error",
    color: "text-red-700",
    bgColor: "bg-red-100",
  },
  syncing: {
    label: "Syncing",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
};

export default function WorkspaceRepositorySyncStatus({
  repository,
}: WorkspaceRepositorySyncStatusProps) {
  const status = repository.syncStatus || "not_cloned";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_cloned;

  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color} ${config.bgColor}`}
      title={
        repository.errorMessage
          ? `${config.label}: ${repository.errorMessage}`
          : config.label
      }
    >
      {config.label}
    </span>
  );
}
