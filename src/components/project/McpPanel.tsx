"use client";

import { useTranslations } from "next-intl";
import AddMcpModal from "@/components/mcp/add-mcp-modal";
import ApiKeyMcpModal from "@/components/mcp/api-key-mcp-modal";
import EditMcpModal from "@/components/mcp/edit-mcp-modal";
import McpListItem from "@/components/mcp/mcp-list-item";
import McpToolbar from "@/components/mcp/mcp-toolbar";
import { useMcpConfig } from "@/components/mcp/use-mcp-config";
import { useAuth } from "@/components/auth/useAuth";

interface McpPanelProps {
  projectPath: string;
}

/**
 * Project-level MCP configuration panel.
 *
 * Thin composition wrapper: all data, network, and CRUD logic lives in
 * `useMcpConfig`; rendering is split across dedicated subcomponents.
 * Injecting the API base path here keeps this component a stable
 * project-level entry point while leaving the hook reusable for
 * workspace-level panels.
 */
export default function McpPanel({ projectPath }: McpPanelProps) {
  const t = useTranslations('project');
  const dirSegments = projectPath.split("/");
  const { authFetch } = useAuth();
  const {
    mcpJson,
    loading,
    saving,
    addOpen,
    setAddOpen,
    editTarget,
    setEditTarget,
    editText,
    setEditText,
    keyTarget,
    setKeyTarget,
    keyInput,
    setKeyInput,
    addForm,
    allEntries,
    enabledCount,
    totalCount,
    actions,
  } = useMcpConfig({
    dirSegments,
    apiBase: "/api/fs/project-mcp",
    authFetch,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
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
    );
  }

  return (
    <div className="space-y-3">
      <McpToolbar
        enabledCount={enabledCount}
        totalCount={totalCount}
        onAdd={actions.openAdd}
      />

      {allEntries.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-zinc-700 rounded-lg">
          {t('mcp.noServers')}
        </div>
      ) : (
        <div className="space-y-2">
          {allEntries.map(({ name, entry, isEnabled }) => (
            <McpListItem
              key={name}
              name={name}
              entry={entry}
              isEnabled={isEnabled}
              saving={saving}
              apiKey={mcpJson._apiKeys[name]}
              onToggle={actions.handleToggle}
              onEditKey={(n) => {
                setKeyTarget(n);
                setKeyInput(mcpJson._apiKeys[n] || "");
              }}
              onEdit={actions.openEdit}
              onDelete={actions.handleDelete}
            />
          ))}
        </div>
      )}

      <EditMcpModal
        open={!!editTarget}
        name={editTarget}
        json={editText}
        saving={saving}
        onChange={setEditText}
        onOk={actions.handleSaveEdit}
        onCancel={() => setEditTarget(null)}
      />
      <ApiKeyMcpModal
        open={!!keyTarget}
        name={keyTarget}
        value={keyInput}
        saving={saving}
        onChange={setKeyInput}
        onOk={actions.handleSaveKey}
        onCancel={() => {
          setKeyTarget(null);
          setKeyInput("");
        }}
      />
      <AddMcpModal
        open={addOpen}
        saving={saving}
        form={addForm}
        onOk={actions.handleAdd}
        onCancel={() => setAddOpen(false)}
      />
    </div>
  );
}
