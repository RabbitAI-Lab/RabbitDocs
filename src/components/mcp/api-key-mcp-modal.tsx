"use client";

import { useTranslations } from "next-intl";
import { Input, Modal } from "antd";

export interface ApiKeyMcpModalProps {
  open: boolean;
  // Name of the server the key belongs to; null when modal is closed.
  name: string | null;
  // Current value of the API key input (controlled).
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
  onOk: () => void;
  onCancel: () => void;
}

/**
 * Modal for editing the API key of an MCP server (e.g. zhipu-style).
 * The key is stored in `_apiKeys` and appended to the server URL as
 * `?Authorization=<key>` on save.
 */
export default function ApiKeyMcpModal({
  open,
  name,
  value,
  saving,
  onChange,
  onOk,
  onCancel,
}: ApiKeyMcpModalProps) {
  const t = useTranslations('workspace');
  return (
    <Modal
      title={name ? t('mcp.apiKeyTitle', { name }) : t('mcp.apiKey')}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText={t('mcp.save')}
      cancelText={t('mcp.cancel')}
      confirmLoading={saving}
    >
      <p className="text-xs text-gray-500 mb-2">
        {t('mcp.apiKeyDescription')}
      </p>
      <Input.Password
        placeholder={t('mcp.apiKeyPlaceholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
      />
    </Modal>
  );
}
