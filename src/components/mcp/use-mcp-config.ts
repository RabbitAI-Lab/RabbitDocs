"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App, Form } from "antd";
import type { FormInstance } from "antd";
import {
  MCP_BASE_URL,
  SYSTEM_MCP_DEFAULTS,
  type McpJson,
  type McpServerEntry,
} from "./types";
import { buildEntryFromFormValues, emptyMcpJson } from "./utils";

export interface UseMcpConfigParams {
  // Comma-separated path segments identifying the project/workspace.
  dirSegments: string[];
  // API base path; e.g. "/api/fs/project-mcp" or "/api/fs/workspace-mcp".
  apiBase: string;
  // Auth-aware fetch function
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export interface McpRenderEntry {
  name: string;
  entry: McpServerEntry;
  isEnabled: boolean;
}

export interface UseMcpConfigResult {
  // State
  mcpJson: McpJson;
  loading: boolean;
  saving: boolean;

  // Modal state and setters (wrapper controls open/close and controlled values)
  addOpen: boolean;
  setAddOpen: (b: boolean) => void;
  editTarget: string | null;
  setEditTarget: (n: string | null) => void;
  editText: string;
  setEditText: (s: string) => void;
  keyTarget: string | null;
  setKeyTarget: (n: string | null) => void;
  keyInput: string;
  setKeyInput: (s: string) => void;
  addForm: FormInstance;

  // Derived
  allEntries: McpRenderEntry[];
  enabledCount: number;
  totalCount: number;

  // Actions
  actions: {
    handleToggle: (name: string, checked: boolean) => Promise<void>;
    openEdit: (name: string) => void;
    handleSaveEdit: () => Promise<void>;
    handleSaveKey: () => Promise<void>;
    handleDelete: (name: string) => Promise<void>;
    openAdd: () => void;
    handleAdd: () => Promise<void>;
  };
}

/**
 * Encapsulates MCP config state, network, and CRUD logic.
 * The API endpoint is injected so the same hook can be reused for
 * project-level and workspace-level panels.
 */
export function useMcpConfig({
  dirSegments,
  apiBase,
  authFetch,
}: UseMcpConfigParams): UseMcpConfigResult {
  const [mcpJson, setMcpJson] = useState<McpJson>(emptyMcpJson);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();

  const [keyTarget, setKeyTarget] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");

  const { message } = App.useApp();

  // Stable entry ordering across toggles; must live inside the hook to
  // survive re-renders and keep a single source of truth.
  const entryOrderRef = useRef<string[]>([]);

  // Serialize dirSegments to a stable string key so that useCallback
  // dependencies do not change on every render (array reference instability
  // was causing an infinite fetch → setState → re-render loop).
  const dirKey = dirSegments.join(",");
  const dirSegmentsRef = useRef(dirSegments);
  dirSegmentsRef.current = dirSegments;

  const fetchConfig = useCallback(async () => {
    try {
      const res = await authFetch(
        `${apiBase}?dirSegments=${dirSegmentsRef.current.join(",")}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const mcpServers =
        (data.mcpJson?.mcpServers &&
        typeof data.mcpJson.mcpServers === "object"
          ? data.mcpJson.mcpServers
          : {}) as Record<string, McpServerEntry>;
      const disabled =
        (data.mcpJson?.disabled && typeof data.mcpJson.disabled === "object"
          ? data.mcpJson.disabled
          : {}) as Record<string, McpServerEntry>;
      const apiKeys =
        (data.mcpJson?._apiKeys && typeof data.mcpJson._apiKeys === "object"
          ? data.mcpJson._apiKeys
          : {}) as Record<string, string>;
      // Merge system MCP defaults: if user has no config for a system MCP,
      // inject the default entry as disabled so it appears in the list.
      const mergedMcpServers = { ...mcpServers };
      const mergedDisabled = { ...disabled };
      for (const [name, entry] of Object.entries(SYSTEM_MCP_DEFAULTS)) {
        if (!mergedMcpServers[name] && !mergedDisabled[name]) {
          mergedDisabled[name] = entry;
        }
      }
      setMcpJson({ mcpServers: mergedMcpServers, disabled: mergedDisabled, _apiKeys: apiKeys });
    } finally {
      setLoading(false);
    }
  }, [apiBase, dirKey, authFetch]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  /**
   * Optimistic write: update UI immediately, then PUT. On success, refetch
   * to align with server state; on failure, refetch to roll back.
   */
  const writeBack = useCallback(
    async (next: McpJson, successMsg?: string, opHint?: { serverName: string; action: string }) => {
      setMcpJson(next);
      setSaving(true);
      try {
        const res = await authFetch(apiBase, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dirSegments: dirSegmentsRef.current,
            mcpJson: {
              mcpServers: next.mcpServers,
              disabled: next.disabled || {},
              _apiKeys: next._apiKeys,
            },
            _op: opHint,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.mcpJson) {
          const mcpServers = (data.mcpJson.mcpServers || {}) as Record<
            string,
            McpServerEntry
          >;
          const disabled = (data.mcpJson.disabled || {}) as Record<
            string,
            McpServerEntry
          >;
          const apiKeys = (data.mcpJson._apiKeys || {}) as Record<
            string,
            string
          >;
          setMcpJson({ mcpServers, disabled, _apiKeys: apiKeys });
        }
        if (successMsg) message.success(successMsg);
      } catch (err) {
        message.error(`保存失败: ${(err as Error).message}`);
        await fetchConfig();
      } finally {
        setSaving(false);
      }
    },
    [apiBase, dirKey, fetchConfig, message, authFetch],
  );

  // Toggle enabled/disabled; rebuild zhipu URL on enable if a stored key exists.
  const handleToggle = useCallback(
    async (name: string, checked: boolean) => {
      if (checked) {
        const disabledEntry = mcpJson.disabled?.[name];
        if (!disabledEntry) return;
        const storedKey = mcpJson._apiKeys[name];
        let entry = disabledEntry;
        if (storedKey) {
          entry = { ...entry, url: `${MCP_BASE_URL}${storedKey}` };
        }
        const nextServers = { ...mcpJson.mcpServers, [name]: entry };
        const nextDisabled = { ...(mcpJson.disabled || {}) };
        delete nextDisabled[name];
        await writeBack(
          {
            mcpServers: nextServers,
            disabled: nextDisabled,
            _apiKeys: mcpJson._apiKeys,
          },
          "Enabled",
          { serverName: name, action: "enable" },
        );
      } else {
        const entry = mcpJson.mcpServers[name];
        if (!entry) return;
        const nextServers = { ...mcpJson.mcpServers };
        delete nextServers[name];
        const nextDisabled = {
          ...(mcpJson.disabled || {}),
          [name]: entry,
        };
        await writeBack(
          {
            mcpServers: nextServers,
            disabled: nextDisabled,
            _apiKeys: mcpJson._apiKeys,
          },
          "Disabled",
          { serverName: name, action: "disable" },
        );
      }
    },
    [mcpJson, writeBack],
  );

  // Save an API key: rebuild zhipu URL, force-enable, persist the key.
  const handleSaveKey = useCallback(async () => {
    if (!keyTarget) return;
    const trimmed = keyInput.trim();
    if (!trimmed) {
      message.error("Please enter API Key");
      return;
    }
    const entry =
      mcpJson.mcpServers[keyTarget] || mcpJson.disabled?.[keyTarget] || {};
    const nextServers = {
      ...mcpJson.mcpServers,
      [keyTarget]: { ...entry, url: `${MCP_BASE_URL}${trimmed}` },
    };
    const nextDisabled = { ...(mcpJson.disabled || {}) };
    delete nextDisabled[keyTarget];
    const nextKeys = { ...mcpJson._apiKeys, [keyTarget]: trimmed };
    await writeBack(
      {
        mcpServers: nextServers,
        disabled: nextDisabled,
        _apiKeys: nextKeys,
      },
      "API Key saved",
    );
    setKeyTarget(null);
    setKeyInput("");
  }, [keyTarget, keyInput, mcpJson, writeBack, message]);

  // Open the JSON editor for an entry. Editing implicitly enables the server.
  const openEdit = useCallback(
    (name: string) => {
      setEditTarget(name);
      const entry =
        mcpJson.mcpServers[name] ?? mcpJson.disabled?.[name] ?? {};
      setEditText(JSON.stringify(entry, null, 2));
    },
    [mcpJson],
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget) return;
    let parsed: McpServerEntry;
    try {
      parsed = JSON.parse(editText);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("not an object");
      }
    } catch {
      message.error("Invalid JSON format");
      return;
    }
    const nextServers = { ...mcpJson.mcpServers, [editTarget]: parsed };
    const nextDisabled = { ...(mcpJson.disabled || {}) };
    delete nextDisabled[editTarget];
    await writeBack(
      {
        mcpServers: nextServers,
        disabled: nextDisabled,
        _apiKeys: mcpJson._apiKeys,
      },
      "Saved",
    );
    setEditTarget(null);
  }, [editTarget, editText, mcpJson, writeBack, message]);

  // Delete a server from all three maps (mcpServers, disabled, _apiKeys).
  const handleDelete = useCallback(
    async (name: string) => {
      const nextServers = { ...mcpJson.mcpServers };
      delete nextServers[name];
      const nextDisabled = { ...(mcpJson.disabled || {}) };
      delete nextDisabled[name];
      const nextKeys = { ...mcpJson._apiKeys };
      delete nextKeys[name];
      await writeBack(
        {
          mcpServers: nextServers,
          disabled: nextDisabled,
          _apiKeys: nextKeys,
        },
        "Deleted",
      );
    },
    [mcpJson, writeBack],
  );

  const openAdd = useCallback(() => {
    addForm.resetFields();
    addForm.setFieldsValue({ type: "stdio", args: "" });
    setAddOpen(true);
  }, [addForm]);

  const handleAdd = useCallback(async () => {
    try {
      const values = await addForm.validateFields();
      const name = values.name as string;
      if (mcpJson.mcpServers[name] || mcpJson.disabled?.[name]) {
        message.error(`MCP "${name}" 已存在`);
        return;
      }
      const entry = buildEntryFromFormValues(values);
      const nextServers = { ...mcpJson.mcpServers, [name]: entry };
      await writeBack(
        {
          mcpServers: nextServers,
          disabled: mcpJson.disabled || {},
          _apiKeys: mcpJson._apiKeys,
        },
        "MCP added",
      );
      setAddOpen(false);
    } catch {
      // Form validation failed; Ant Design has already shown the error.
    }
  }, [addForm, mcpJson, writeBack, message]);

  // Merge enabled + disabled servers, preserving a stable display order.
  // Newly seen keys are appended; deleted keys are pruned.
  const allEntries = useMemo<McpRenderEntry[]>(() => {
    const existing = new Set(entryOrderRef.current);
    const disabled = mcpJson.disabled || {};
    Object.keys(mcpJson.mcpServers).forEach((k) => {
      if (!existing.has(k)) {
        entryOrderRef.current.push(k);
        existing.add(k);
      }
    });
    Object.keys(disabled).forEach((k) => {
      if (!existing.has(k)) {
        entryOrderRef.current.push(k);
        existing.add(k);
      }
    });
    const currentKeys = new Set([
      ...Object.keys(mcpJson.mcpServers),
      ...Object.keys(disabled),
    ]);
    entryOrderRef.current = entryOrderRef.current.filter((k) =>
      currentKeys.has(k),
    );
    return entryOrderRef.current.map((name) => {
      const isEnabled = !!mcpJson.mcpServers[name];
      const entry = isEnabled ? mcpJson.mcpServers[name] : disabled[name];
      return { name, entry, isEnabled };
    });
  }, [mcpJson]);

  const enabledCount = Object.keys(mcpJson.mcpServers).length;
  const totalCount = allEntries.length;

  return {
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
    actions: {
      handleToggle,
      openEdit,
      handleSaveEdit,
      handleSaveKey,
      handleDelete,
      openAdd,
      handleAdd,
    },
  };
}
