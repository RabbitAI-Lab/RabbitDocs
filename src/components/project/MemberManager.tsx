"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { Input, Button, Modal } from "antd";
import type { ProjectMember } from "@/lib/fs";

interface MemberManagerProps {
  projectPath: string;
  members: ProjectMember[];
  onMembersChange: (members: ProjectMember[]) => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function MemberManager({
  projectPath,
  members,
  onMembersChange,
}: MemberManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const { authFetch } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formAccountName, setFormAccountName] = useState("");

  // inline editing state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editAccountName, setEditAccountName] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const dirSegments = projectPath.split(",");

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
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    const res = await authFetch("/api/fs/project-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dirSegments, memberId }),
    });
    if (res.ok) {
      onMembersChange(members.filter((m) => m.id !== memberId));
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {members.length} members
        </p>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Member
        </button>
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
                      placeholder="Account name"
                      onPressEnter={handleUpdate}
                    />
                    <Button
                      size="small"
                      loading={editSubmitting}
                      disabled={!editAccountName.trim()}
                      onClick={handleUpdate}
                    >
                      Save
                    </Button>
                    <Button size="small" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{member.accountName}</span>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Added {formatDate(member.addedAt)}</p>
                  </>
                )}
              </div>
              {editingMemberId !== member.id && (
                <>
                  <button
                    onClick={() => startEdit(member)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 dark:text-gray-600 hover:text-blue-500 transition-all"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(member.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-all"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add member modal */}
      <Modal
        title="Add Member"
        open={showAddForm}
        onOk={handleAdd}
        okText="Add"
        onCancel={() => { setShowAddForm(false); resetForm(); }}
        cancelText="Cancel"
        confirmLoading={submitting}
        okButtonProps={{ disabled: !formAccountName.trim() }}
      >
        <div className="py-2">
          <Input
            placeholder="Enter account name"
            value={formAccountName}
            onChange={(e) => setFormAccountName(e.target.value)}
            onPressEnter={handleAdd}
          />
        </div>
      </Modal>

      {members.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
          <svg className="w-10 h-10 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <p className="text-sm">No members</p>
        </div>
      )}
    </div>
  );
}
