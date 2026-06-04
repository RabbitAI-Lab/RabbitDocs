"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/useAuth";

type LogCategory = "repository" | "sandbox" | "skills" | "mcp" | "member";

interface LogEntry {
  id: number;
  projectId: string;
  category: LogCategory;
  action: string;
  detail: string;
  operator: string;
  metadata: string | null;
  createdAt: string;
}

interface LogPanelProps {
  projectPath: string;
}

const CATEGORY_FILTERS: { key: LogCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "repository", label: "Repository" },
  { key: "sandbox", label: "Sandbox" },
  { key: "skills", label: "Skills" },
  { key: "mcp", label: "MCP" },
  { key: "member", label: "Members" },
];

const CATEGORY_CONFIG: Record<LogCategory, { color: string }> = {
  repository: { color: "#8B5CF6" },
  sandbox: { color: "#F59E0B" },
  skills: { color: "#10B981" },
  mcp: { color: "#3B82F6" },
  member: { color: "#6B7280" },
};

const ACTION_LABELS: Record<string, { text: string; className: string }> = {
  create: { text: "Added", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  update: { text: "Modified", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  delete: { text: "Deleted", className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  enable: { text: "Enabled", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  disable: { text: "Disabled", className: "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400" },
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} minutes ago`;
  if (diffHour < 24) return `${diffHour} hours ago`;
  if (diffDay < 30) return `${diffDay} days ago`;
  return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function CategoryIcon({ category }: { category: LogCategory }) {
  const config = CATEGORY_CONFIG[category];
  return (
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: `${config.color}15` }}
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {category === "repository" && <><circle cx="12" cy="12" r="3" /><path d="M12 3v3m0 12v3m-9-9h3m12 0h3" /></>}
        {category === "sandbox" && <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></>}
        {category === "skills" && <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />}
        {category === "mcp" && <><path d="M6 12h12M12 6v12" /><rect x="3" y="3" width="18" height="18" rx="2" /></>}
        {category === "member" && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>}
      </svg>
    </span>
  );
}

export default function LogPanel({ projectPath }: LogPanelProps) {
  const projectId = projectPath.split(",").pop() || "";
  const { authFetch } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | "all">("all");

  const pageSize = 20;

  const fetchLogs = useCallback(async (pageNum: number, category: LogCategory | "all") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId,
        page: String(pageNum),
        pageSize: String(pageSize),
      });
      if (category !== "all") {
        params.set("category", category);
      }
      const res = await authFetch(`/api/fs/project-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (pageNum === 1) {
          setLogs(data.logs);
        } else {
          setLogs((prev) => [...prev, ...data.logs]);
        }
        setTotal(data.total);
        setPage(pageNum);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId, authFetch]);

  useEffect(() => {
    fetchLogs(1, selectedCategory);
  }, [selectedCategory, fetchLogs]);

  const handleCategoryChange = (category: LogCategory | "all") => {
    setSelectedCategory(category);
    setLogs([]);
  };

  const handleLoadMore = () => {
    fetchLogs(page + 1, selectedCategory);
  };

  const hasMore = logs.length < total;

  return (
    <div className="space-y-3">
      {/* Category filter */}
      <div className="flex items-center gap-1 flex-wrap">
        {CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => handleCategoryChange(filter.key)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              selectedCategory === filter.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Log list */}
      {logs.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
          <svg className="w-10 h-10 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p className="text-sm">No activity logs</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {logs.map((log) => {
            const actionLabel = ACTION_LABELS[log.action];
            return (
              <div
                key={log.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors"
              >
                <CategoryIcon category={log.category} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{log.detail}</span>
                    {actionLabel && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${actionLabel.className}`}>
                        {actionLabel.text}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{formatTime(log.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                    <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{log.operator}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : `Load More (${total - logs.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
