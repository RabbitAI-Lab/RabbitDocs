"use client";

import { useCallback, useEffect } from "react";
import { Modal, Form, Input, Select } from "antd";
import { useTranslations } from "next-intl";
import { PROVIDERS, getProviderDefaults } from "@/lib/model-constants";

interface UserModelConfigModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: Record<string, unknown>;
  onSubmit: (data: {
    provider: string;
    modelName: string;
    apiKey: string;
    name: string;
    backend?: string;
  }) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

export default function UserModelConfigModal({
  open,
  mode,
  initialValues,
  onSubmit,
  onCancel,
  submitting = false,
}: UserModelConfigModalProps) {
  const [form] = Form.useForm();
  const t = useTranslations("myModelsPage");

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      const defaults = getProviderDefaults("GLM", "anthropic");
      form.setFieldsValue({
        provider: "GLM",
        modelName: defaults?.modelName || "",
        name: "",
        apiKey: "",
        baseUrl: defaults?.baseUrl || "",
      });
    } else if (initialValues) {
      form.setFieldsValue({
        provider: initialValues.provider,
        modelName: initialValues.modelName,
        name: initialValues.name,
        apiKey: "", // 编辑时不预填 API Key
        baseUrl: initialValues.baseUrl,
      });
    }
  }, [open, mode, initialValues, form]);

  const handleProviderChange = useCallback(
    (value: string) => {
      const defaults = getProviderDefaults(value, "anthropic");
      if (defaults) {
        form.setFieldValue("modelName", defaults.modelName);
        form.setFieldValue("baseUrl", defaults.baseUrl);
        if (!form.getFieldValue("name")) {
          form.setFieldValue("name", `${value}-${defaults.modelName}`);
        }
      }
    },
    [form]
  );

  const handleOk = useCallback(async () => {
    try {
      const values = await form.validateFields();
      await onSubmit({
        provider: values.provider,
        modelName: values.modelName,
        apiKey: values.apiKey,
        name: values.name || `${values.provider}-${values.modelName}`,
        backend: values.backend || "sdk",
      });
    } catch {
      // validation failed
    }
  }, [form, onSubmit]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    onCancel();
  }, [form, onCancel]);

  const title = mode === "create" ? t("addModel") : t("editModel");
  const currentProvider = Form.useWatch("provider", form);
  const defaults = currentProvider
    ? getProviderDefaults(currentProvider, "anthropic")
    : null;

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={submitting ? t("verifying") : (mode === "create" ? t("addModel") : t("editModel"))}
      cancelText="Cancel"
      confirmLoading={submitting}
      width={520}
      centered
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          label={t("provider")}
          name="provider"
          rules={[{ required: true }]}
        >
          <Select onChange={handleProviderChange}>
            {PROVIDERS.map((p) => (
              <Select.Option key={p} value={p}>
                {p}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item label={t("name")} name="name">
          <Input placeholder={t("namePlaceholder")} />
        </Form.Item>
        <Form.Item
          label={t("modelName")}
          name="modelName"
          rules={[{ required: true }]}
        >
          <Input placeholder={t("modelNamePlaceholder")} />
        </Form.Item>
        <Form.Item
          label={t("apiKey")}
          name="apiKey"
          rules={[
            {
              required: mode === "create",
              message: t("apiKeyPlaceholder"),
            },
          ]}
        >
          <Input.Password placeholder={t("apiKeyPlaceholder")} />
        </Form.Item>
        <Form.Item label={t("protocol")}>
          <Input value={t("protocolFixed")} disabled />
        </Form.Item>
        <Form.Item label={t("baseUrl")}>
          <Input value={defaults?.baseUrl || ""} disabled />
        </Form.Item>
      </Form>
    </Modal>
  );
}
