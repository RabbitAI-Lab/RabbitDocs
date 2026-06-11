"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { App, Tag, Popconfirm, Switch } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";
import AddMcpModal from "./add-mcp-modal";
import EditMcpModal from "./edit-mcp-modal";
import { describeServer, inferType, buildEntryFromFormValues } from "./utils";
import type { McpServerEntry } from "./types";
import { Form } from "antd";

interface UserMcpItem {
  id: number;
  name: string;
  entry: McpServerEntry;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const TYPE_TAG_COLOR: Record<string, string> = {
  stdio: "blue",
  sse: "purple",
  http: "green",
};

export default function UserMcpSection() {
  const t = useTranslations("integrationsPage");
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const [items, setItems] = useState<UserMcpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserMcpItem | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [addForm] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const res = await authFetch("/api/user-mcp");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  const handleAdd = useCallback(async () => {
    try {
      const values = await addForm.validateFields();
      const name = values.name as string;
      const entry = buildEntryFromFormValues(values);

      setSaving(true);
      const res = await authFetch("/api/user-mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, entry }),
      });

      if (!res.ok) {
        const data = await res.json();
        message.error(data.error || t("operationFailed"));
        return;
      }

      message.success(t("addMcp"));
      setAddOpen(false);
      addForm.resetFields();
      load();
    } catch {
      // Form validation failed
    } finally {
      setSaving(false);
    }
  }, [addForm, authFetch, message, t, load]);

  const handleDelete = useCallback(
    async (item: UserMcpItem) => {
      setSaving(true);
      try {
        const res = await authFetch(`/api/user-mcp/${item.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          message.success(t("deleted"));
          load();
        } else {
          message.error(t("operationFailed"));
        }
      } catch {
        message.error(t("operationFailed"));
      } finally {
        setSaving(false);
      }
    },
    [authFetch, message, t, load]
  );

  const handleToggle = useCallback(
    async (item: UserMcpItem, checked: boolean) => {
      setSaving(true);
      try {
        const res = await authFetch(`/api/user-mcp/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: checked }),
        });
        if (res.ok) {
          load();
        } else {
          message.error(t("operationFailed"));
        }
      } catch {
        message.error(t("operationFailed"));
      } finally {
        setSaving(false);
      }
    },
    [authFetch, message, t, load]
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      let entry: McpServerEntry;
      try {
        entry = JSON.parse(editText);
      } catch {
        message.error("Invalid JSON");
        return;
      }
      const res = await authFetch(`/api/user-mcp/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry }),
      });
      if (res.ok) {
        message.success(t("addMcp"));
        setEditTarget(null);
        load();
      } else {
        message.error(t("operationFailed"));
      }
    } catch {
      message.error(t("operationFailed"));
    } finally {
      setSaving(false);
    }
  }, [editTarget, editText, authFetch, message, t, load]);

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
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t("thirdPartyMcpDesc")}
        </span>
        <button
          onClick={() => {
            setAddOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("addMcp")}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-zinc-700 rounded-lg">
          <div className="font-medium mb-1">{t("emptyTitle")}</div>
          <div className="text-xs">{t("emptyDesc")}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => {
            const type = inferType(item.entry);
            const desc = describeServer(item.entry);
            return (
              <div
                key={item.id}
                className={
                  "rounded-lg border p-3 transition-colors " +
                  (item.enabled
                    ? "border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600"
                    : "border-gray-100 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 opacity-60")
                }
              >
                <div className="flex items-center gap-2 mb-1">
                  <Switch
                    size="small"
                    checked={item.enabled}
                    loading={saving}
                    onChange={(checked) => handleToggle(item, checked)}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1">
                    {item.name}
                  </span>
                  <Tag
                    color={TYPE_TAG_COLOR[type] || "default"}
                    className="text-[10px] leading-4 m-0"
                  >
                    {type}
                  </Tag>
                </div>
                <div
                  className="text-xs text-gray-400 dark:text-gray-500 truncate font-mono mb-2"
                  title={desc}
                >
                  {desc}
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <EditOutlined
                    className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer text-sm p-1"
                    onClick={() => {
                      setEditTarget(item);
                      setEditText(JSON.stringify(item.entry, null, 2));
                    }}
                  />
                  <Popconfirm
                    title={t("deleteConfirm", { name: item.name })}
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleDelete(item)}
                  >
                    <DeleteOutlined className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 cursor-pointer text-sm p-1" />
                  </Popconfirm>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddMcpModal
        open={addOpen}
        saving={saving}
        form={addForm}
        onOk={handleAdd}
        onCancel={() => setAddOpen(false)}
      />

      <EditMcpModal
        open={!!editTarget}
        name={editTarget?.name || null}
        json={editText}
        saving={saving}
        onChange={setEditText}
        onOk={handleSaveEdit}
        onCancel={() => setEditTarget(null)}
      />
    </>
  );
}
