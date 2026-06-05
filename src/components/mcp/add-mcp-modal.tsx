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
      onOk={onOk}
      onCancel={onCancel}
      okText={t('mcp.add')}
      cancelText={t('mcp.cancel')}
      confirmLoading={saving}
      width={560}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="mt-2">
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
          <Input placeholder={t('mcp.formNamePlaceholder')} />
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
                    <Input placeholder={t('mcp.formCommandPlaceholder')} />
                  </Form.Item>
                  <Form.Item name="args" label={t('mcp.formArgs')}>
                    <Input placeholder={t('mcp.formArgsPlaceholder')} />
                  </Form.Item>
                  <Form.Item
                    name="env"
                    label={t('mcp.formEnv')}
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder={"API_KEY=xxx\nDEBUG=1"}
                      className="font-mono text-sm"
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
                  <Input placeholder={t('mcp.formUrlPlaceholder')} />
                </Form.Item>
                <Form.Item
                  name="headers"
                  label={t('mcp.formHeaders')}
                >
                  <Input.TextArea
                    rows={3}
                    placeholder={"Authorization: Bearer xxx"}
                    className="font-mono text-sm"
                  />
                </Form.Item>
              </>
            );
          }}
        </Form.Item>
      </Form>
    </Modal>
  );
}
