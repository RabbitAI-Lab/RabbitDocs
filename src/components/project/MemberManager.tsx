"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";
import { Input, Button, Modal, App } from "antd";
import type { ProjectMember } from "@/lib/fs";

interface MemberManagerProps {
  projectPath: string;
  members: ProjectMember[];
  onMembersChange: (members: ProjectMember[]) => void;
  ownerId: string;
  ownerName: string;
  onOwnerTransfer?: (newOwnerId: string, newMembers: ProjectMember[]) => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Crown icon SVG
function CrownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" strokeWidth="0">
      <path d="M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-2.29-6.87c-.27-.82-1.16-1.26-1.98-.99-.62.21-1.04.76-1.08 1.39L8.42 10l-5.3-1.42c-.8-.21-1.62.26-1.83 1.06-.17.62.09 1.26.6 1.6l6.06 4.07c.19.13.31.34.31.57V17c0 .55.45 1 1 1h5.5c.55 0 1-.45 1-1v-1.12c0-.23.12-.44.31-.57l6.06-4.07c.51-.34.77-.98.6-1.6z" />
    </svg>
  );
}

export default function MemberManager({
  projectPath,
  members,
  onMembersChange,
  ownerId,
  ownerName,
  onOwnerTransfer,
}: MemberManagerProps) {
  const t = useTranslations('project');
  const { message: messageApi } = App.useApp();
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const { authFetch } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formAccountName, setFormAccountName] = useState("");
  const [transferring, setTransferring] = useState(false);

  // inline editing state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editAccountName, setEditAccountName] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const dirSegments = projectPath.split("/");
  const isOwner = user?.id === ownerId;

  const resetForm = () => {
    setFormAccountName("");
  };

  const handleAdd = async () => {
    if (!formAccountName.trim()) return;

    const member: ProjectMember = {
      id: crypto.randomUUID(),
      accountName: formAccountName.trim(),
      addedAt: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      const res = await authFetch("/api/fs/project-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirSegments, member }),
      });
      if (res.ok) {
        const updatedMembers = await res.json();
        onMembersChange(updatedMembers);
        resetForm();
        setShowAddForm(false);
      } else {
        const data = await res.json();
        messageApi.error(data.error || t('members.addFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (memberId: string) => {
    if (!confirm(t('members.confirmRemove'))) return;

    const res = await authFetch("/api/fs/project-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dirSegments, memberId }),
    });
    if (res.ok) {
      onMembersChange(members.filter((m) => m.id !== memberId));
    } else {
      const data = await res.json();
      messageApi.error(data.error || t('members.removeFailed'));
    }
  };

  const startEdit = (member: ProjectMember) => {
    setEditingMemberId(member.id);
    setEditAccountName(member.accountName);
  };

  const cancelEdit = () => {
    setEditingMemberId(null);
    setEditAccountName("");
  };

  const handleUpdate = async () => {
    if (!editAccountName.trim() || !editingMemberId) return;

    setEditSubmitting(true);
    try {
      const res = await authFetch("/api/fs/project-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirSegments,
          memberId: editingMemberId,
          updates: { accountName: editAccountName.trim() },
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onMembersChange(
          members.map((m) => (m.id === editingMemberId ? updated : m))
        );
        cancelEdit();
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleTransferOwnership = (member: ProjectMember) => {
    Modal.confirm({
      title: t('members.transferTitle'),
      content: (
        <p>
          {t('members.transferContent', { name: member.accountName })}
        </p>
      ),
      okText: t('members.transferBtn'),
      okType: "danger",
      cancelText: t('members.cancel'),
      onOk: async () => {
        setTransferring(true);
        try {
          const res = await authFetch("/api/fs/project-members", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dirSegments, memberId: member.id }),
          });
          if (res.ok) {
            const data = await res.json();
            messageApi.success(t('members.transferSuccess'));
            if (onOwnerTransfer) {
              onOwnerTransfer(data.ownerId, data.members);
            }
          } else {
            const data = await res.json();
            messageApi.error(data.error || t('members.transferFailed'));
          }
        } finally {
          setTransferring(false);
        }
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('members.memberCount', { count: members.length + 1 })}
        </p>
        {isOwner && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('members.addMember')}
          </button>
        )}
      </div>

      {/* Owner row */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10">
        <CrownIcon className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{ownerName}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300">
              {t('members.owner')}
            </span>
          </div>
        </div>
      </div>

      {/* Member list */}
      {members.length > 0 && (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 dark:border-zinc-700 hover:border-gray-200 dark:hover:border-zinc-600 transition-colors group"
            >
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <div className="flex-1 min-w-0">
                {editingMemberId === member.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      size="small"
                      value={editAccountName}
                      onChange={(e) => setEditAccountName(e.target.value)}
                      placeholder={t('members.accountNamePlaceholder')}
                      onPressEnter={handleUpdate}
                    />
                    <Button
                      size="small"
                      loading={editSubmitting}
                      disabled={!editAccountName.trim()}
                      onClick={handleUpdate}
                    >
                      {t('members.save')}
                    </Button>
                    <Button size="small" onClick={cancelEdit}>
                      {t('members.cancel')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{member.accountName}</span>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{t('members.added', { date: formatDate(member.addedAt) })}</p>
                  </>
                )}
              </div>
              {editingMemberId !== member.id && isOwner && (
                <div className="flex items-center gap-1">
                  {/* Transfer ownership button */}
                  <button
                    onClick={() => handleTransferOwnership(member)}
                    disabled={transferring}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400 transition-all disabled:opacity-50"
                    title={t('members.transferTitle')}
                  >
                    <CrownIcon className="w-3.5 h-3.5" />
                  </button>
                  {/* Edit button */}
                  <button
                    onClick={() => startEdit(member)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 dark:text-gray-600 hover:text-blue-500 transition-all"
                    title={t('members.edit')}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(member.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-all"
                    title={t('members.delete')}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add member modal (owner only) */}
      {isOwner && (
        <Modal
          title={t('members.addMemberTitle')}
          open={showAddForm}
          onOk={handleAdd}
          okText={t('members.addBtn')}
          onCancel={() => { setShowAddForm(false); resetForm(); }}
          cancelText={t('members.cancel')}
          confirmLoading={submitting}
          okButtonProps={{ disabled: !formAccountName.trim() }}
        >
          <div className="py-2">
            <Input
              placeholder={t('members.enterAccountName')}
              value={formAccountName}
              onChange={(e) => setFormAccountName(e.target.value)}
              onPressEnter={handleAdd}
            />
          </div>
        </Modal>
      )}

      {members.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
          <svg className="w-10 h-10 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <p className="text-sm">{t('members.noMembers')}</p>
        </div>
      )}
    </div>
  );
}
