"use client";

import { useTranslations } from "next-intl";
import { Input, Modal } from "antd";

export interface EditMcpModalProps {
  open: boolean;
  // Name of the entry being edited; null when modal is closed.
  name: string | null;
  // Current JSON text shown in the editor.
  json: string;
  saving: boolean;
  onChange: (value: string) => void;
  onOk: () => void;
  onCancel: () => void;
}

/**
 * Modal for editing a single MCP server entry as raw JSON.
 * Editing implicitly enables the server (handled in the hook).
 */
export default function EditMcpModal({
  open,
  name,
  json,
  saving,
  onChange,
  onOk,
  onCancel,
}: EditMcpModalProps) {
  const t = useTranslations('workspace');
  return (
    <Modal
      title={name ? t('mcp.editTitle', { name }) : "Edit MCP"}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText={t('mcp.save')}
      cancelText={t('mcp.cancel')}
      confirmLoading={saving}
      width={560}
    >
      <Input.TextArea
        rows={12}
        value={json}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm"
      />
    </Modal>
  );
}
