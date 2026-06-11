"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { Input, App, Tag, Select, Modal } from "antd";
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  PlusOutlined,
  EditOutlined,
  ApiOutlined,
} from "@ant-design/icons";

interface SandboxApplication {
  id: number;
  status: "pending" | "approved" | "rejected";
  sandboxUrl: string | null;
  reason: string | null;
  reviewNote: string | null;
  remark: string | null;
  bindEntityId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EntityOption {
  id: string;
  name: string;
  type: "project" | "workspace";
}

const STATUS_CONFIG = {
  pending: { color: "processing" as const, Icon: ClockCircleOutlined },
  approved: { color: "success" as const, Icon: CheckCircleOutlined },
  rejected: { color: "error" as const, Icon: CloseCircleOutlined },
};

function RemarkEditable({
  value,
  placeholder,
  onSave,
}: {
  value: string | null;
  placeholder: string;
  onSave: (val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(text.trim());
      setEditing(false);
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setText(value || "");
              setEditing(false);
            }
          }}
          disabled={saving}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-2 py-0.5 text-sm bg-transparent border border-blue-300 dark:border-blue-600 rounded outline-none focus:border-blue-500 text-gray-800 dark:text-gray-200"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
        >
          {saving ? "..." : "OK"}
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="group cursor-pointer flex items-center gap-1.5"
    >
      <span className={`text-sm font-medium truncate ${value ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-500 italic"}`}>
        {value || placeholder}
      </span>
      <EditOutlined className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

export default function SandboxPage() {
  const t = useTranslations("sandboxPage");
  const { user, authFetch } = useAuth();
  const { message } = App.useApp();
  const [applications, setApplications] = useState<SandboxApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [reason, setReason] = useState("");
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [bindModalAppId, setBindModalAppId] = useState<number | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadApplications();
    loadEntities();
  }, [user]);

  const loadApplications = async () => {
    try {
      const res = await authFetch("/api/sandbox-applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadEntities = async () => {
    try {
      const [pRes, wRes] = await Promise.all([
        authFetch("/api/fs/projects"),
        authFetch("/api/fs/workspaces"),
      ]);
      const options: EntityOption[] = [];
      if (pRes.ok) {
        const projects = await pRes.json();
        for (const p of projects) {
          options.push({ id: p.id, name: p.name || p.id, type: "project" });
        }
      }
      if (wRes.ok) {
        const workspaces = await wRes.json();
        for (const w of workspaces) {
          options.push({ id: w.id, name: w.name || w.id, type: "workspace" });
        }
      }
      setEntityOptions(options);
    } catch {
      // ignore
    }
  };

  const hasPending = applications.some((a) => a.status === "pending");
  const approvedList = applications.filter((a) => a.status === "approved" && a.sandboxUrl);

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await authFetch("/api/sandbox-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setReason("");
        setApplyModalOpen(false);
        message.success(t("applySuccess"));
        loadApplications();
      } else {
        message.error(data.error || t("applyFailed"));
      }
    } catch {
      message.error(t("applyFailed"));
    } finally {
      setApplying(false);
    }
  };

  const handleRemarkSave = async (id: number, remark: string) => {
    const res = await authFetch("/api/sandbox-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, remark }),
    });
    if (res.ok) {
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, remark } : a))
      );
    } else {
      message.error(t("applyFailed"));
      throw new Error("Failed to update remark");
    }
  };

  const handleBind = async (id: number, entityId: string | null) => {
    const res = await authFetch("/api/sandbox-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, bindEntityId: entityId }),
    });
    if (res.ok) {
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, bindEntityId: entityId } : a))
      );
      setBindModalAppId(null);
      message.success(t("bindSuccess"));
    } else {
      message.error(t("applyFailed"));
    }
  };

  const getEntityLabel = (entityId: string | null) => {
    if (!entityId) return null;
    const entity = entityOptions.find((e) => e.id === entityId);
    if (!entity) return null;
    const typeLabel = entity.type === "project" ? t("labelProject") : t("labelWorkspace");
    return `${typeLabel}: ${entity.name}`;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🔐</div>
            <p className="text-gray-400 dark:text-gray-500">{t("loginRequired")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {t("title")}
        </h1>
        <button
          onClick={() => setApplyModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <PlusOutlined />
          {t("applyButton")}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* 沙箱列表 */}
        {approvedList.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t("sandboxListTitle")}
            </h2>
            <div className="grid gap-3">
              {approvedList.map((app) => {
                const bindLabel = getEntityLabel(app.bindEntityId);
                const isBindModal = bindModalAppId === app.id;

                return (
                  <div
                    key={app.id}
                    className="p-4 border border-[var(--sidebar-border)] rounded-xl"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-blue-500 dark:text-blue-400">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <RemarkEditable
                            value={app.remark}
                            placeholder={t("remarkPlaceholder")}
                            onSave={(remark) => handleRemarkSave(app.id, remark)}
                          />
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {app.sandboxUrl}
                          </p>
                        </div>
                      </div>
                      <a
                        href={app.sandboxUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 ml-3"
                      >
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                          <LinkOutlined />
                          {t("openSandbox")}
                        </button>
                      </a>
                    </div>

                    {/* 绑定区域 */}
                    <div className="mt-3 pt-3 border-t border-[var(--sidebar-border)]">
                      {isBindModal ? (
                        <div className="flex items-center gap-2">
                          <Select
                            showSearch
                            style={{ flex: 1 }}
                            placeholder={t("bindSelectPlaceholder")}
                            optionFilterProp="label"
                            options={entityOptions.map((e) => ({
                              value: e.id,
                              label: `[${e.type === "project" ? t("labelProject") : t("labelWorkspace")}] ${e.name}`,
                            }))}
                            onChange={(val: string) => handleBind(app.id, val)}
                            onClear={() => handleBind(app.id, null)}
                            allowClear
                            defaultValue={app.bindEntityId || undefined}
                            notFoundContent={t("noEntities")}
                          />
                          <button
                            onClick={() => setBindModalAppId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 shrink-0"
                          >
                            {t("btnCancel")}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {bindLabel ? (
                            <>
                              <ApiOutlined className="text-xs text-green-500" />
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                {bindLabel}
                              </span>
                              <button
                                onClick={() => handleBind(app.id, null)}
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                              >
                                {t("btnUnbind")}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setBindModalAppId(app.id)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {t("btnBind")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 其他状态的申请记录 */}
        {applications
          .filter((a) => a.status !== "approved")
          .map((app) => {
            const cfg = STATUS_CONFIG[app.status];
            const StatusIcon = cfg.Icon;
            return (
              <div
                key={app.id}
                className="mb-3 p-3 border border-[var(--sidebar-border)] rounded-xl flex items-center gap-3"
              >
                <StatusIcon className={app.status === "pending" ? "text-blue-500" : "text-red-500"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Tag color={cfg.color} className="text-xs">
                      {t(`status${app.status.charAt(0).toUpperCase() + app.status.slice(1)}`)}
                    </Tag>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(app.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {app.status === "rejected" && app.reviewNote && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                      {t("reviewNote", { note: app.reviewNote })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

      </div>

      {/* 申请弹窗 */}
      <Modal
        open={applyModalOpen}
        title={t("applyButton")}
        centered
        okText={t("applyButton")}
        cancelText={t("btnCancel")}
        confirmLoading={applying}
        onOk={handleApply}
        onCancel={() => {
          setApplyModalOpen(false);
          setReason("");
        }}
        styles={{ container: { border: "1px solid var(--popup-border)" } }}
      >
        <div className="py-2">
          <Input.TextArea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPlaceholder")}
            rows={4}
            className="w-full"
          />
        </div>
      </Modal>
    </div>
  );
}
