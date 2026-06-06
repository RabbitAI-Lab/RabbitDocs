"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Typography,
  App,
  Row,
  Col,
} from "antd";
import { useTranslations } from "next-intl";
import { PlusOutlined, MinusCircleOutlined } from "@ant-design/icons";
import {
  PROTOCOLS,
  PROTOCOL_LABELS,
  getProviderDefaults,
} from "@/lib/model-constants";
import {
  serializeExtraEnv,
  PREDEFINED_ENV_KEYS,
  DEFAULT_THINKING_VALUE,
} from "@/lib/model-env";
import {
  ModelConfigSubmitData,
  CUSTOM_PROVIDER_KEY,
  PROVIDER_SELECT_OPTIONS,
  collectExtraEnvFromForm,
  CREATE_FORM_DEFAULTS,
} from "./model-config-shared";

const { Text } = Typography;

interface ModelConfigModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: Record<string, unknown>;
  onSubmit: (data: ModelConfigSubmitData) => Promise<void>;
  onCancel: () => void;
}

export default function ModelConfigModal({
  open,
  mode,
  initialValues,
  onSubmit,
  onCancel,
}: ModelConfigModalProps) {
  const [form] = Form.useForm();
  const [customProvider, setCustomProvider] = useState(() => {
    if (mode === "edit" && initialValues) {
      const provider = initialValues.provider as string;
      if (provider === CUSTOM_PROVIDER_KEY) {
        return (initialValues as Record<string, string>)._realProvider || "";
      }
    }
    return "";
  });
  const userEditedRef = useRef<Set<string>>(new Set());
  const { message } = App.useApp();
  const t = useTranslations('admin');

  // Set form values when modal opens
  useEffect(() => {
    if (!open) return;
    userEditedRef.current.clear();

    if (mode === "create") {
      const defaults = getProviderDefaults("GLM", "openai");
      form.setFieldsValue({
        ...CREATE_FORM_DEFAULTS,
        name: defaults ? `GLM-${defaults.modelName}` : undefined,
        baseUrl: defaults?.baseUrl,
        modelName: defaults?.modelName,
        ...(initialValues || {}),
      });
    } else if (initialValues) {
      form.setFieldsValue(initialValues);
    }
  }, [open, mode, initialValues, form]);

  const getRealProvider = useCallback(
    (formProvider: string, customProv: string) => {
      if (formProvider === CUSTOM_PROVIDER_KEY) {
        return customProv;
      }
      return formProvider;
    },
    []
  );

  const handleProviderSelect = useCallback(
    (value: string) => {
      if (value === CUSTOM_PROVIDER_KEY) {
        setCustomProvider("");
        form.setFieldValue("baseUrl", "");
        form.setFieldValue("modelName", "");
        form.setFieldValue("name", "");
        return;
      }
      setCustomProvider("");
      const protocol = form.getFieldValue("protocol");
      if (!protocol) return;

      const defaults = getProviderDefaults(value, protocol);
      if (!defaults) return;

      if (!userEditedRef.current.has("baseUrl") && defaults.baseUrl) {
        form.setFieldValue("baseUrl", defaults.baseUrl);
      }
      if (!userEditedRef.current.has("modelName") && defaults.modelName) {
        form.setFieldValue("modelName", defaults.modelName);
      }
      if (!userEditedRef.current.has("name")) {
        form.setFieldValue("name", `${value}-${defaults.modelName}`);
      }
    },
    [form]
  );

  const handleProtocolChange = useCallback(
    (protocol: string) => {
      const formProvider = form.getFieldValue("provider");
      const realProvider = getRealProvider(formProvider, customProvider);
      if (!realProvider) return;

      const defaults = getProviderDefaults(realProvider, protocol);
      if (!defaults) return;

      if (!userEditedRef.current.has("baseUrl") && defaults.baseUrl) {
        form.setFieldValue("baseUrl", defaults.baseUrl);
      }
      if (!userEditedRef.current.has("modelName") && defaults.modelName) {
        form.setFieldValue("modelName", defaults.modelName);
      }
      if (!userEditedRef.current.has("name")) {
        form.setFieldValue("name", `${realProvider}-${defaults.modelName}`);
      }
    },
    [form, customProvider, getRealProvider]
  );

  const markUserEdited = useCallback((field: string) => {
    userEditedRef.current.add(field);
  }, []);

  const handleOk = useCallback(async () => {
    try {
      const values = await form.validateFields();
      let realProvider = values.provider;
      if (realProvider === CUSTOM_PROVIDER_KEY) {
        if (!customProvider.trim()) {
          message.error(t('modelConfigModal.msgEnterCustomProvider'));
          return;
        }
        realProvider = customProvider.trim();
      }
      const extraEnvJson = serializeExtraEnv(
        collectExtraEnvFromForm(
          values.disableAdaptive,
          values.defaultThinking,
          values.customEnvList
        )
      );
      await onSubmit({
        provider: realProvider,
        protocol: values.protocol,
        name: values.name,
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
        modelName: values.modelName,
        extraEnvJson,
        backend: values.backend || "sdk",
      });
    } catch {
      // validation failed, antd will show errors
    }
  }, [form, customProvider, onSubmit, message, t]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    setCustomProvider("");
    userEditedRef.current.clear();
    onCancel();
  }, [form, onCancel]);

  const title = mode === "create" ? t('modelConfigModal.titleCreate') : t('modelConfigModal.titleEdit');
  const okText = mode === "create" ? t('modelConfigModal.btnCreate') : t('modelConfigModal.btnSave');

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={okText}
      cancelText={t('modelConfigModal.btnCancel')}
      width={600}
      centered
      destroyOnHidden
      styles={{
        body: {
          maxHeight: "calc(100vh - 200px)",
          overflowY: "auto",
          paddingRight: 4,
        },
      }}
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={t('modelConfigModal.labelProvider')}
              name="provider"
              rules={[{ required: true, message: t('modelConfigModal.ruleProvider') }]}
            >
              <Select
                options={[
                  ...PROVIDER_SELECT_OPTIONS,
                  { value: CUSTOM_PROVIDER_KEY, label: t('modelConfigShared.providerCustom') },
                ]}
                placeholder={t('modelConfigModal.placeholderProvider')}
                onChange={handleProviderSelect}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t('modelConfigModal.labelProtocol')}
              name="protocol"
              rules={[{ required: true, message: t('modelConfigModal.ruleProtocol') }]}
            >
              <Select onChange={handleProtocolChange}>
                {PROTOCOLS.map((p) => (
                  <Select.Option key={p} value={p}>
                    {PROTOCOL_LABELS[p]}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        {/* Backend selection: only show for anthropic protocol */}
        {form.getFieldValue("protocol") === "anthropic" && (
          <Form.Item
            label="Backend"
            name="backend"
            tooltip="SDK: direct Agent SDK call (default). ACP: use ACP protocol with long-lived agent subprocess."
            initialValue="sdk"
          >
            <Select>
              <Select.Option value="sdk">SDK (Direct)</Select.Option>
              <Select.Option value="acp">ACP (Agent Protocol)</Select.Option>
            </Select>
          </Form.Item>
        )}
        {form.getFieldValue("provider") === CUSTOM_PROVIDER_KEY && (
          <Form.Item
            label={t('modelConfigModal.labelCustomProviderName')}
            required
            rules={[{ required: true, message: t('modelConfigModal.ruleCustomProviderName') }]}
          >
            <Input
              value={customProvider}
              onChange={(e) => setCustomProvider(e.target.value)}
              placeholder={t('modelConfigModal.placeholderCustomProvider')}
            />
          </Form.Item>
        )}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={t('modelConfigModal.labelConfigName')}
              name="name"
              rules={[{ required: true, message: t('modelConfigModal.ruleConfigName') }]}
            >
              <Input placeholder={t('modelConfigModal.placeholderConfigName')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t('modelConfigModal.labelModelName')}
              name="modelName"
              rules={[{ required: true, message: t('modelConfigModal.ruleModelName') }]}
            >
              <Input
                placeholder={t('modelConfigModal.placeholderModelName')}
                onChange={() => markUserEdited("modelName")}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          label={t('modelConfigModal.labelBaseUrl')}
          name="baseUrl"
          rules={[{ required: true, message: t('modelConfigModal.ruleBaseUrl') }]}
        >
          <Input
            placeholder="https://open.bigmodel.cn/api/coding/paas/v4"
            onChange={() => markUserEdited("baseUrl")}
          />
        </Form.Item>
        <Form.Item
          label={t('modelConfigModal.labelApiKey')}
          name="apiKey"
          rules={[{ required: true, message: t('modelConfigModal.ruleApiKey') }]}
        >
          <Input.Password placeholder={t('modelConfigModal.placeholderApiKey')} />
        </Form.Item>

        {/* Environment Variables Section */}
        <div
          style={{
            marginTop: 4,
            marginBottom: 16,
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.5,
            color: "rgba(0, 0, 0, 0.88)",
          }}
        >
          {t('modelConfigModal.sectionEnvVars')}
        </div>
        <Form.Item
          label={
            <span>
              {t('modelConfigModal.labelDisableAdaptive')}
              <Text type="secondary" className="text-xs ml-1">
                ({PREDEFINED_ENV_KEYS.DISABLE_ADAPTIVE})
              </Text>
            </span>
          }
          name="disableAdaptive"
          valuePropName="checked"
          tooltip={t('modelConfigModal.tooltipDisableAdaptive')}
          style={{ marginBottom: 10 }}
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label={
            <span>
              {t('modelConfigModal.labelDefaultThinking')}
              <Text type="secondary" className="text-xs ml-1">
                ({PREDEFINED_ENV_KEYS.DEFAULT_THINKING})
              </Text>
            </span>
          }
          name="defaultThinking"
          tooltip={t('modelConfigModal.tooltipDefaultThinking')}
          style={{ marginBottom: 10 }}
        >
          <Input allowClear placeholder={DEFAULT_THINKING_VALUE} />
        </Form.Item>
        <Form.Item
          label={
            <span>
              {t('modelConfigModal.labelCustomEnv')}
              <Text type="secondary" className="text-xs ml-1">
                ({t('modelConfigModal.customEnvNote')})
              </Text>
            </span>
          }
          style={{ marginBottom: 8 }}
        >
          <Form.List name="customEnvList">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name: fieldName, ...restField }) => (
                  <Space
                    key={key}
                    align="baseline"
                    size={4}
                    style={{ display: "flex", marginBottom: 4 }}
                  >
                    <Form.Item
                      {...restField}
                      name={[fieldName, "key"]}
                      rules={[
                        { required: true, message: t('modelConfigModal.ruleEnvKeyRequired') },
                        {
                          pattern: /^[A-Za-z_][A-Za-z0-9_]*$/,
                          message: t('modelConfigModal.ruleEnvKeyInvalid'),
                        },
                      ]}
                      style={{ marginBottom: 0, width: 160 }}
                    >
                      <Input placeholder="KEY" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[fieldName, "value"]}
                      rules={[{ required: true, message: t('modelConfigModal.ruleEnvValueRequired') }]}
                      style={{ marginBottom: 0, flex: 1, minWidth: 120 }}
                    >
                      <Input placeholder="value" allowClear />
                    </Form.Item>
                    <MinusCircleOutlined
                      onClick={() => remove(fieldName)}
                      style={{ color: "#ff4d4f", fontSize: 14, cursor: "pointer" }}
                    />
                  </Space>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ key: "", value: "" })}
                  block
                  size="small"
                  icon={<PlusOutlined />}
                >
                  {t('modelConfigModal.btnAddEnv')}
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>
      </Form>
    </Modal>
  );
}
