"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Modal, Checkbox, App, Empty } from "antd";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth/useAuth";
import type { McpServerEntry } from "./types";

interface ImportItem {
  id: number;
  name: string;
  entry: McpServerEntry;
  enabled: boolean;
}

interface ImportFromAccountModalProps {
  open: boolean;
  existingNames: Set<string>;
  onImport: (entries: Record<string, McpServerEntry>) => void;
  onCancel: () => void;
}

/**
 * Modal to import user-level third-party MCP entries into a project.
 */
export default function ImportFromAccountModal({
  open,
  existingNames,
  onImport,
  onCancel,
}: ImportFromAccountModalProps) {
  const t = useTranslations("integrationsPage");
  const wt = useTranslations("workspace");
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const modalStyles = useMemo(() => ({
    mask: {
      background: isDark ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.15)",
      backdropFilter: "blur(6px) saturate(1.4)",
      WebkitBackdropFilter: "blur(6px) saturate(1.4)",
    },
    container: {
      background: 'var(--main-bg)',
      border: '1px solid var(--popup-border)',
      boxShadow: isDark
        ? "0 8px 32px -4px rgba(0, 0, 0, 0.4), 0 2px 8px -2px rgba(0, 0, 0, 0.3)"
        : "0 8px 32px -4px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)",
    },
    header: {
      borderBottom: "none",
    },
    footer: {
      borderTop: "none",
      paddingTop: 8,
      paddingBottom: 4,
    },
  }), [isDark]);

  const modalRootClass = "import-account-modal";
  const [items, setItems] = useState<ImportItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/user-mcp");
      if (res.ok) {
        const data = await res.json();
        // Only show enabled items
        setItems(data.filter((i: ImportItem) => i.enabled));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (open) {
      Promise.resolve().then(() => load());
      Promise.resolve().then(() => setSelected(new Set()));
    }
  }, [open, load]);

  const handleOk = () => {
    if (selected.size === 0) {
      message.warning(t("importNoSelection"));
      return;
    }
    const entries: Record<string, McpServerEntry> = {};
    for (const item of items) {
      if (!selected.has(item.id)) continue;
      if (existingNames.has(item.name)) {
        message.warning(t("importConflict", { name: item.name }));
        continue;
      }
      entries[item.name] = item.entry;
    }
    if (Object.keys(entries).length === 0) {
      return;
    }
    onImport(entries);
    message.success(t("importSuccess", { count: Object.keys(entries).length }));
  };

  return (
    <Modal
      title={t("importTitle")}
      open={open}
      onCancel={onCancel}
      centered
      width={480}
      destroyOnHidden
      mask={{ closable: false }}
      styles={modalStyles}
      rootClassName={modalRootClass}
      footer={null}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        {t("importDesc")}
      </p>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <svg
            className="w-5 h-5 animate-spin text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        </div>
      ) : items.length === 0 ? (
        <Empty description={t("importEmpty")} />
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {items.map((item) => {
            const isConflict = existingNames.has(item.name);
            return (
              <div
                key={item.id}
                className={
                  "flex items-center gap-2 px-3 py-2 rounded-lg border " +
                  (isConflict
                    ? "border-gray-100 dark:border-zinc-700 opacity-50"
                    : "border-gray-200 dark:border-zinc-700")
                }
              >
                <Checkbox
                  checked={selected.has(item.id)}
                  disabled={isConflict}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    });
                  }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {item.name}
                  </span>
                  {isConflict && (
                    <span className="text-xs text-gray-400 ml-2">
                      ({t("importConflict", { name: item.name })})
                    </span>
                  )}
                  <div className="text-xs text-gray-400 font-mono truncate">
                    {item.entry.url || item.entry.command || ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
        >
          {wt("mcp.cancel")}
        </button>
        <button
          onClick={handleOk}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          {t("importBtn")}
        </button>
      </div>
    </Modal>
  );
}
