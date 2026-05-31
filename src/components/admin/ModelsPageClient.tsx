"use client";

import { useState, useCallback, useRef } from "react";
import {
  Card,
  Button,
  Form,
  Input,
  Select,
  Space,
  Modal,
  Tag,
  Typography,
  App,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ExportOutlined,
  ImportOutlined,
  CloudServerOutlined,
  StarOutlined,
  StarFilled,
} from "@ant-design/icons";
import {
  PROVIDERS,
  PROTOCOLS,
  PROTOCOL_LABELS,
  PROVIDER_TAG_COLORS,
  PROTOCOL_TAG_COLORS,
  getProviderDefaults,
  isPresetProvider,
} from "@/lib/model-constants";

const { Text, Paragraph } = Typography;

interface ModelConfig {
  id: number;
  provider: string;
  protocol: "openai" | "anthropic";
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  createdAt: string;
  updatedAt: string;
  isDefault: number;
}

const CUSTOM_PROVIDER_KEY = "__custom__";

const PROVIDER_SELECT_OPTIONS = [
  ...PROVIDERS.map((p) => ({ value: p, label: p })),
  { value: CUSTOM_PROVIDER_KEY, label: "自定义..." },
];

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 3) + "****" + key.slice(-4);
}

interface Props {
  initialModels: ModelConfig[];
}

export default function ModelsPageClient({ initialModels }: Props) {
  const [models, setModels] = useState<ModelConfig[]>(initialModels);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [showApiKeyMap, setShowApiKeyMap] = useState<Record<number, boolean>>(
    {}
  );
  // 自定义厂商输入状态
  const [createCustomProvider, setCreateCustomProvider] = useState("");
  const [editCustomProvider, setEditCustomProvider] = useState("");
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const { modal, message } = App.useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 追踪用户是否手动编辑过字段，避免自动填充覆盖
  const createUserEditedRef = useRef<Set<string>>(new Set());
  const editUserEditedRef = useRef<Set<string>>(new Set());

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/models");
    const data = await res.json();
    setModels(data);
  }, []);

  /** 获取表单中实际的 provider 值（处理自定义厂商） */
  const getRealProvider = useCallback(
    (
      formProvider: string,
      customProvider: string
    ) => {
      if (formProvider === CUSTOM_PROVIDER_KEY) {
        return customProvider;
      }
      return formProvider;
    },
    []
  );

  /** 厂商下拉选择变化 */
  const handleProviderSelect = useCallback(
    (
      value: string,
      form: ReturnType<typeof Form.useForm>[0],
      setCustomProvider: (v: string) => void,
      userEditedRef: React.MutableRefObject<Set<string>>
    ) => {
      if (value === CUSTOM_PROVIDER_KEY) {
        setCustomProvider("");
        form.setFieldValue("baseUrl", "");
        form.setFieldValue("modelName", "");
        form.setFieldValue("name", "");
        return;
      }
      // 选择预设厂商，清空自定义输入
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
    []
  );

  /** 协议变化时自动填充 */
  const handleProtocolChange = useCallback(
    (
      protocol: string,
      form: ReturnType<typeof Form.useForm>[0],
      customProvider: string,
      userEditedRef: React.MutableRefObject<Set<string>>
    ) => {
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
    [getRealProvider]
  );

  /** 标记字段为用户手动编辑 */
  const markUserEdited = useCallback(
    (field: string, userEditedRef: React.MutableRefObject<Set<string>>) => {
      userEditedRef.current.add(field);
    },
    []
  );

  const handleCreate = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      // 替换自定义厂商值
      if (values.provider === CUSTOM_PROVIDER_KEY) {
        if (!createCustomProvider.trim()) {
          message.error("请输入自定义厂商名称");
          return;
        }
        values.provider = createCustomProvider.trim();
      }
      await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setCreateOpen(false);
      createForm.resetFields();
      setCreateCustomProvider("");
      createUserEditedRef.current.clear();
      await refreshList();
    } catch {
      // validation failed, antd will show errors
    }
  }, [createForm, createCustomProvider, refreshList, message]);

  const handleSetDefault = useCallback(
    (model: ModelConfig) => {
      const newDefault = model.isDefault ? 0 : 1;
      fetch(`/api/models/${model.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: newDefault }),
      }).then(() => {
        refreshList();
        message.success(newDefault ? `已将 "${model.name}" 设为默认模型` : `已取消 "${model.name}" 的默认模型`);
      });
    },
    [refreshList, message]
  );

  const handleDelete = useCallback(
    (id: number, name: string, isDefault?: number) => {
      let content = `确认删除 "${name}"?`;
      if (isDefault) {
        content += "\n\n注意：该模型为默认模型，删除后新建聊天将不会自动选择模型。";
      }
      modal.confirm({
        title: "确认删除",
        content,
        okText: "删除",
        cancelText: "取消",
        okButtonProps: { danger: true },
        onOk: async () => {
          await fetch(`/api/models/${id}`, { method: "DELETE" });
          await refreshList();
        },
      });
    },
    [modal, refreshList]
  );

  const handleStartEdit = useCallback(
    (model: ModelConfig) => {
      setEditingModel(model);
      const isPreset = isPresetProvider(model.provider);
      editForm.setFieldsValue({
        provider: isPreset ? model.provider : CUSTOM_PROVIDER_KEY,
        protocol: model.protocol || "openai",
        name: model.name,
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        modelName: model.modelName,
      });
      setEditCustomProvider(isPreset ? "" : model.provider);
      editUserEditedRef.current.clear();
      setEditOpen(true);
    },
    [editForm]
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingModel) return;
    try {
      const values = await editForm.validateFields();
      // 替换自定义厂商值
      if (values.provider === CUSTOM_PROVIDER_KEY) {
        if (!editCustomProvider.trim()) {
          message.error("请输入自定义厂商名称");
          return;
        }
        values.provider = editCustomProvider.trim();
      }
      const body: Record<string, string> = {};
      if (values.provider) body.provider = values.provider;
      if (values.protocol) body.protocol = values.protocol;
      if (values.name) body.name = values.name;
      if (values.baseUrl) body.baseUrl = values.baseUrl;
      if (values.modelName) body.modelName = values.modelName;
      if (values.apiKey) body.apiKey = values.apiKey;

      await fetch(`/api/models/${editingModel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setEditOpen(false);
      setEditingModel(null);
      editForm.resetFields();
      setEditCustomProvider("");
      editUserEditedRef.current.clear();
      await refreshList();
    } catch {
      // validation failed
    }
  }, [editingModel, editForm, editCustomProvider, refreshList, message]);

  const toggleApiKeyVisibility = useCallback((id: number) => {
    setShowApiKeyMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // 导出：将所有模型配置下载为 JSON 文件
  const handleExport = useCallback(() => {
    if (models.length === 0) {
      message.warning("暂无模型配置可导出");
      return;
    }
    const exportData = models.map(
      ({ id, createdAt, updatedAt, isDefault, ...rest }) => rest
    );
    const blob = new Blob(
      [JSON.stringify({ version: 2, models: exportData }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `model-configs-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success(`已导出 ${models.length} 条模型配置`);
  }, [models, message]);

  // 导入：读取 JSON 文件并批量创建
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 重置 input 以便重复选择同一文件
      e.target.value = "";

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        let importList: (Omit<
          ModelConfig,
          "id" | "createdAt" | "updatedAt"
        > & { protocol?: string })[] = [];

        if (Array.isArray(data)) {
          importList = data;
        } else if (data.models && Array.isArray(data.models)) {
          importList = data.models;
        } else {
          message.error("无效的文件格式");
          return;
        }

        const validProtocols = PROTOCOLS as readonly string[];
        const validItems = importList
          .map(({ isDefault, ...item }) => ({
            ...item,
            protocol: item.protocol || "openai",
          }))
          .filter(
            (item) =>
              item.provider &&
              item.name &&
              item.baseUrl &&
              item.apiKey &&
              item.modelName &&
              validProtocols.includes(item.protocol)
          );

        if (validItems.length === 0) {
          message.error("文件中没有有效的模型配置");
          return;
        }

        modal.confirm({
          title: "确认导入",
          content: `检测到 ${validItems.length} 条有效模型配置，是否导入？`,
          okText: "导入",
          cancelText: "取消",
          onOk: async () => {
            let successCount = 0;
            for (const item of validItems) {
              try {
                await fetch("/api/models", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(item),
                });
                successCount++;
              } catch {
                // skip failed items
              }
            }
            await refreshList();
            message.success(`成功导入 ${successCount} 条模型配置`);
          },
        });
      } catch {
        message.error("文件解析失败，请检查 JSON 格式");
      }
    },
    [modal, message, refreshList]
  );

  /** 渲染厂商选择字段（Select + 自定义输入框） */
  const renderProviderField = (
    form: ReturnType<typeof Form.useForm>[0],
    customProvider: string,
    setCustomProvider: (v: string) => void,
    userEditedRef: React.MutableRefObject<Set<string>>
  ) => (
    <>
      <Form.Item
        label="厂商"
        name="provider"
        rules={[{ required: true, message: "请选择厂商" }]}
      >
        <Select
          options={PROVIDER_SELECT_OPTIONS}
          placeholder="请选择厂商"
          onChange={(value) =>
            handleProviderSelect(value, form, setCustomProvider, userEditedRef)
          }
        />
      </Form.Item>
      {form.getFieldValue("provider") === CUSTOM_PROVIDER_KEY && (
        <Form.Item
          label="自定义厂商名称"
          required
          rules={[{ required: true, message: "请输入自定义厂商名称" }]}
        >
          <Input
            value={customProvider}
            onChange={(e) => setCustomProvider(e.target.value)}
            placeholder="如：Ollama、硅基流动..."
          />
        </Form.Item>
      )}
    </>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">模型配置</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            管理 AI 模型的 API 连接配置
          </p>
        </div>
        <Space>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出
          </Button>
          <Button icon={<ImportOutlined />} onClick={handleImport}>
            导入
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createUserEditedRef.current.clear();
              setCreateCustomProvider("");
              // 设置初始默认值
              const defaults = getProviderDefaults("GLM", "openai");
              if (defaults) {
                createForm.setFieldsValue({
                  provider: "GLM",
                  protocol: "openai",
                  name: `GLM-${defaults.modelName}`,
                  baseUrl: defaults.baseUrl,
                  modelName: defaults.modelName,
                });
              }
              setCreateOpen(true);
            }}
          >
            添加模型
          </Button>
        </Space>
        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {models.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60%] text-gray-400">
            <CloudServerOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p className="text-sm">暂无模型配置，点击上方按钮添加</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map((model) => (
              <Card
                key={model.id}
                size="small"
                hoverable
                actions={[
                  <span
                    key="default"
                    onClick={() => handleSetDefault(model)}
                    style={{ color: model.isDefault ? '#faad14' : undefined }}
                  >
                    {model.isDefault ? <StarFilled /> : <StarOutlined />}
                  </span>,
                  <EditOutlined
                    key="edit"
                    onClick={() => handleStartEdit(model)}
                  />,
                  <DeleteOutlined
                    key="delete"
                    onClick={() => handleDelete(model.id, model.name, model.isDefault)}
                  />,
                ]}
              >
                <div className="mb-3">
                  <Space align="center">
                    <Tag
                      color={
                        PROVIDER_TAG_COLORS[model.provider] || "geekblue"
                      }
                    >
                      {model.provider}
                    </Tag>
                    <Tag
                      color={
                        PROTOCOL_TAG_COLORS[model.protocol || "openai"] ||
                        "cyan"
                      }
                    >
                      {PROTOCOL_LABELS[model.protocol || "openai"] ||
                        model.protocol}
                    </Tag>
                    {model.isDefault ? <Tag color="gold">默认</Tag> : null}
                    <Text strong>{model.name}</Text>
                  </Space>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Text
                      type="secondary"
                      className="text-xs w-16 shrink-0"
                    >
                      Base URL
                    </Text>
                    <Paragraph
                      copyable={{ text: model.baseUrl }}
                      className="!mb-0 text-xs font-mono"
                      ellipsis
                    >
                      {model.baseUrl}
                    </Paragraph>
                  </div>
                  <div className="flex items-center gap-2">
                    <Text
                      type="secondary"
                      className="text-xs w-16 shrink-0"
                    >
                      Model
                    </Text>
                    <Text className="text-xs">{model.modelName}</Text>
                  </div>
                  <div className="flex items-center gap-2">
                    <Text
                      type="secondary"
                      className="text-xs w-16 shrink-0"
                    >
                      API Key
                    </Text>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Text className="!text-xs font-mono" ellipsis>
                        {showApiKeyMap[model.id]
                          ? model.apiKey
                          : maskApiKey(model.apiKey)}
                      </Text>
                      <Button
                        type="text"
                        size="small"
                        icon={
                          showApiKeyMap[model.id] ? (
                            <EyeInvisibleOutlined />
                          ) : (
                            <EyeOutlined />
                          )
                        }
                        onClick={() => toggleApiKeyVisibility(model.id)}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {createOpen && (
      <Modal
        title="新增模型配置"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
          setCreateCustomProvider("");
          createUserEditedRef.current.clear();
        }}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ provider: "GLM", protocol: "openai" }}
          className="mt-4"
        >
          {renderProviderField(
            createForm,
            createCustomProvider,
            setCreateCustomProvider,
            createUserEditedRef
          )}
          <Form.Item
            label="协议"
            name="protocol"
            rules={[{ required: true, message: "请选择协议" }]}
          >
            <Select
              onChange={(value) =>
                handleProtocolChange(
                  value,
                  createForm,
                  createCustomProvider,
                  createUserEditedRef
                )
              }
            >
              {PROTOCOLS.map((p) => (
                <Select.Option key={p} value={p}>
                  {PROTOCOL_LABELS[p]}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="配置名称"
            name="name"
            rules={[{ required: true, message: "请输入配置名称" }]}
          >
            <Input placeholder="如：我的GLM-4" />
          </Form.Item>
          <Form.Item
            label="Base URL"
            name="baseUrl"
            rules={[{ required: true, message: "请输入 Base URL" }]}
          >
            <Input
              placeholder="https://open.bigmodel.cn/api/coding/paas/v4"
              onChange={() => markUserEdited("baseUrl", createUserEditedRef)}
            />
          </Form.Item>
          <Form.Item
            label="Model Name"
            name="modelName"
            rules={[{ required: true, message: "请输入 Model Name" }]}
          >
            <Input
              placeholder="如：glm-5.1"
              onChange={() => markUserEdited("modelName", createUserEditedRef)}
            />
          </Form.Item>
          <Form.Item
            label="API Key"
            name="apiKey"
            rules={[{ required: true, message: "请输入 API Key" }]}
          >
            <Input.Password placeholder="输入 API Key" />
          </Form.Item>
        </Form>
      </Modal>
      )}

      {/* Edit Modal */}
      {editOpen && (
      <Modal
        title="编辑模型配置"
        open={editOpen}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditOpen(false);
          setEditingModel(null);
          editForm.resetFields();
          setEditCustomProvider("");
          editUserEditedRef.current.clear();
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={editForm}
          layout="vertical"
          className="mt-4"
        >
          {renderProviderField(
            editForm,
            editCustomProvider,
            setEditCustomProvider,
            editUserEditedRef
          )}
          <Form.Item
            label="协议"
            name="protocol"
            rules={[{ required: true, message: "请选择协议" }]}
          >
            <Select
              onChange={(value) =>
                handleProtocolChange(
                  value,
                  editForm,
                  editCustomProvider,
                  editUserEditedRef
                )
              }
            >
              {PROTOCOLS.map((p) => (
                <Select.Option key={p} value={p}>
                  {PROTOCOL_LABELS[p]}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="配置名称"
            name="name"
            rules={[{ required: true, message: "请输入配置名称" }]}
          >
            <Input placeholder="如：我的GLM-4" />
          </Form.Item>
          <Form.Item
            label="Base URL"
            name="baseUrl"
            rules={[{ required: true, message: "请输入 Base URL" }]}
          >
            <Input
              placeholder="https://open.bigmodel.cn/api/coding/paas/v4"
              onChange={() => markUserEdited("baseUrl", editUserEditedRef)}
            />
          </Form.Item>
          <Form.Item
            label="Model Name"
            name="modelName"
            rules={[{ required: true, message: "请输入 Model Name" }]}
          >
            <Input
              placeholder="如：glm-5.1"
              onChange={() => markUserEdited("modelName", editUserEditedRef)}
            />
          </Form.Item>
          <Form.Item
            label="API Key"
            name="apiKey"
            rules={[{ required: true, message: "请输入 API Key" }]}
          >
            <Input.Password placeholder="输入 API Key" />
          </Form.Item>
        </Form>
      </Modal>
      )}
    </div>
  );
}
