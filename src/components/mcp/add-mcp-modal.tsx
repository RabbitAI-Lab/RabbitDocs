"use client";

import { useTranslations } from "next-intl";
import { Form, Input, Modal, Select } from "antd";
import type { FormInstance } from "antd";
import { NAME_PATTERN } from "./types";

export interface AddMcpModalProps {
  open: boolean;
  saving: boolean;
  // Form instance owned by the parent (hook) so that openAdd can
  // reset/setFieldsValue on it.
  form: FormInstance;
  onOk: () => void;
  onCancel: () => void;
}

const MODAL_STYLES = {
  mask: {
    background: "rgba(0, 0, 0, 0.15)",
    backdropFilter: "blur(6px) saturate(1.4)",
    WebkitBackdropFilter: "blur(6px) saturate(1.4)",
  },
  container: {
    background: 'var(--main-bg)',
    border: '1px solid var(--popup-border)',
    boxShadow:
      "0 8px 32px -4px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)",
  },
  header: {
    borderBottom: "none",
  },
};

/**
 * Modal with a Form to add a new MCP server. Supports stdio, http, and sse.
 * Stdio: command + args + env (one KEY=VALUE per line).
 * Http/SSE: url + headers (one Key: Value per line).
 */
export default function AddMcpModal({
  open,
  saving,
  form,
  onOk,
  onCancel,
}: AddMcpModalProps) {
  const t = useTranslations('workspace');
  return (
    <Modal
      title={t('mcp.addServer')}
      open={open}
      onCancel={onCancel}
      destroyOnHidden
      centered
      mask={{ closable: false }}
      styles={MODAL_STYLES}
      footer={null}
      width={560}
      afterOpenChange={(open) => {
        if (open) {
          form.resetFields();
          form.setFieldsValue({ type: "stdio", args: "" });
        }
      }}
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          name="name"
          label={t('mcp.formName')}
          rules={[
            { required: true, message: t('mcp.formNameRequired') },
            {
              pattern: NAME_PATTERN,
              message: t('mcp.formNamePattern'),
            },
          ]}
        >
          <Input placeholder={t('mcp.formNamePlaceholder')} style={{ background: 'transparent' }} />
        </Form.Item>

        <Form.Item
          name="type"
          label={t('mcp.formType')}
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { value: "stdio", label: t('mcp.formTypeStdio') },
              { value: "http", label: t('mcp.formTypeHttp') },
              { value: "sse", label: t('mcp.formTypeSse') },
            ]}
            onChange={(val) => {
              // Clear unrelated fields when switching type to avoid stale data.
              if (val === "stdio") {
                form.setFieldsValue({ url: undefined, headers: undefined });
              } else {
                form.setFieldsValue({
                  command: undefined,
                  args: undefined,
                  env: undefined,
                });
              }
            }}
          />
        </Form.Item>

        <Form.Item shouldUpdate>
          {() => {
            const type = form.getFieldValue("type");
            if (type === "stdio") {
              return (
                <>
                  <Form.Item
                    name="command"
                    label={t('mcp.formCommand')}
                    rules={[
                      { required: true, message: t('mcp.formCommandRequired') },
                    ]}
                  >
                    <Input placeholder={t('mcp.formCommandPlaceholder')} style={{ background: 'transparent' }} />
                  </Form.Item>
                  <Form.Item name="args" label={t('mcp.formArgs')}>
                    <Input placeholder={t('mcp.formArgsPlaceholder')} style={{ background: 'transparent' }} />
                  </Form.Item>
                  <Form.Item
                    name="env"
                    label={t('mcp.formEnv')}
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder={"API_KEY=xxx\nDEBUG=1"}
                      className="font-mono text-sm"
                      style={{ background: 'transparent' }}
                    />
                  </Form.Item>
                </>
              );
            }
            return (
              <>
                <Form.Item
                  name="url"
                  label={t('mcp.formUrl')}
                  rules={[
                    { required: true, message: t('mcp.formUrlRequired') },
                    { type: "url", message: t('mcp.formUrlInvalid') },
                  ]}
                >
                  <Input placeholder={t('mcp.formUrlPlaceholder')} style={{ background: 'transparent' }} />
                </Form.Item>
                <Form.Item
                  name="headers"
                  label={t('mcp.formHeaders')}
                >
                  <Input.TextArea
                    rows={3}
                    placeholder={"Authorization: Bearer xxx"}
                    className="font-mono text-sm"
                    style={{ background: 'transparent' }}
                  />
                </Form.Item>
              </>
            );
          }}
        </Form.Item>
      </Form>
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
        >
          {t('mcp.cancel')}
        </button>
        <button
          onClick={onOk}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
        >
          {t('mcp.add')}
        </button>
      </div>
    </Modal>
  );
}
