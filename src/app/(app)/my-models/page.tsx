"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import {
  Card,
  Button,
  Empty,
  App,
  Tag,
  Popconfirm,
  Space,
  Typography,
  Modal,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined, LoadingOutlined } from "@ant-design/icons";
import UserModelConfigModal from "@/components/user/UserModelConfigModal";
import { PROVIDER_TAG_COLORS } from "@/lib/model-constants";

const { Text } = Typography;

interface UserModelState {
  id: number;
  provider: string;
  name: string;
  modelName: string;
  apiKeyMasked: string;
  baseUrl: string;
  backend: string;
}

export default function MyModelsPage() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations("myModelsPage");

  const [models, setModels] = useState<UserModelState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingModel, setEditingModel] = useState<Record<string, unknown> | undefined>();
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{
    visible: boolean;
    ok: boolean;
    error?: string;
    request?: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body: Record<string, unknown>;
    };
    response?: {
      status: number;
      statusText: string;
      body: string;
    };
  }>({ visible: false, ok: false });

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/user-models");
      if (res.ok) {
        const data = await res.json();
        setModels(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // Initial data fetch — inline async to avoid set-state-in-effect
  useEffect(() => {
    void (async () => {
      try {
        const res = await authFetch("/api/user-models");
        if (res.ok) {
          const data = await res.json();
          setModels(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch]);

  const handleCreate = async (data: {
    provider: string;
    modelName: string;
    apiKey: string;
    name: string;
    backend?: string;
  }) => {
    setSubmitting(true);
    try {
      const res = await authFetch("/api/user-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        message.success(t("verifySuccess"));
        setModalOpen(false);
        loadModels();
      } else {
        const err = await res.json();
        message.error(err.error || t("operationFailed"));
      }
    } catch {
      message.error(t("operationFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (data: {
    provider: string;
    modelName: string;
    apiKey: string;
    name: string;
    backend?: string;
  }) => {
    if (!editingModel?.id) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        provider: data.provider,
        modelName: data.modelName,
        name: data.name,
      };
      // 仅当用户填了新的 API Key 时才更新
      if (data.apiKey) {
        body.apiKey = data.apiKey;
      }
      const res = await authFetch(`/api/user-models/${editingModel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        message.success(data.apiKey ? t("verifySuccess") : t("updated"));
        setModalOpen(false);
        setEditingModel(undefined);
        loadModels();
      } else {
        const err = await res.json();
        message.error(err.error || t("operationFailed"));
      }
    } catch {
      message.error(t("operationFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await authFetch(`/api/user-models/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        message.success(t("deleted"));
        loadModels();
      }
    } catch {
      message.error(t("operationFailed"));
    }
  };

  const openCreateModal = () => {
    setModalMode("create");
    setEditingModel(undefined);
    setModalOpen(true);
  };

  const openEditModal = (model: UserModelState) => {
    setModalMode("edit");
    setEditingModel(model as unknown as Record<string, unknown>);
    setModalOpen(true);
  };

  const handleTestConnection = async (model: UserModelState) => {
    setTestingId(model.id);
    try {
      const res = await authFetch(`/api/user-models/${model.id}/verify`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        message.success(t("testSuccess"));
      } else {
        message.error(data.error || t("testFailed"));
      }
      setTestResult({ visible: true, ...data });
    } catch {
      message.error(t("testFailed"));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-8">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          {t("addModel")}
        </Button>
      </div>

      {/* Model List */}
      {models.length === 0 && !loading ? (
        <Card>
          <Empty description={t("emptyTitle")} className="py-8">
            <p className="text-sm text-gray-400 mb-4">{t("emptyDesc")}</p>
            <Button type="primary" onClick={openCreateModal}>
              {t("addModel")}
            </Button>
          </Empty>
        </Card>
      ) : (
        <div className="space-y-4">
          {models.map((model) => (
            <Card key={model.id} className="shadow-sm" hoverable>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Tag color={PROVIDER_TAG_COLORS[model.provider] || "geekblue"}>
                      {model.provider}
                    </Tag>
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {model.name}
                    </span>
                    <Tag color="orange">Anthropic</Tag>
                  </div>
                  <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                    <div>
                      <Text type="secondary">Model: </Text>
                      <Text>{model.modelName}</Text>
                    </div>
                    <div>
                      <Text type="secondary">API Key: </Text>
                      <Text code>{model.apiKeyMasked}</Text>
                    </div>
                    <div>
                      <Text type="secondary">Base URL: </Text>
                      <Text className="text-xs">{model.baseUrl}</Text>
                    </div>
                  </div>
                </div>
                <Space>
                  <Button
                    icon={testingId === model.id ? <LoadingOutlined /> : <ApiOutlined />}
                    onClick={() => handleTestConnection(model)}
                    loading={testingId === model.id}
                  >
                    {t("testConnection")}
                  </Button>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(model)}
                  >
                    {t("editModel")}
                  </Button>
                  <Popconfirm
                    title={t("deleteConfirm", { name: model.name })}
                    onConfirm={() => handleDelete(model.id)}
                    okText="Delete"
                    cancelText="Cancel"
                    okButtonProps={{ danger: true }}
                  >
                    <Button icon={<DeleteOutlined />} danger>
                      {t("deleteModel")}
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Test Result Modal */}
      <Modal
        title={testResult.ok ? t("testSuccess") : t("testFailed")}
        open={testResult.visible}
        onCancel={() => setTestResult((prev) => ({ ...prev, visible: false }))}
        footer={null}
        width={640}
        centered
      >
        {!testResult.ok && testResult.error && (
          <div className="mb-4 p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <Text type="danger" strong>{testResult.error}</Text>
          </div>
        )}
        {testResult.request && (
          <div className="mb-3">
            <Text strong>{t("testRequest")}</Text>
            <pre className="mt-1 p-3 rounded bg-gray-50 dark:bg-gray-800 text-xs overflow-auto max-h-48">
{`${testResult.request.method} ${testResult.request.url}\n\n${JSON.stringify({
  headers: testResult.request.headers,
  body: testResult.request.body,
}, null, 2)}`}</pre>
          </div>
        )}
        {testResult.response && (
          <div>
            <Text strong>{t("testResponse")}</Text>
            <pre className="mt-1 p-3 rounded bg-gray-50 dark:bg-gray-800 text-xs overflow-auto max-h-48">
{`${testResult.response.status} ${testResult.response.statusText}\n\n${testResult.response.body}`}</pre>
          </div>
        )}
      </Modal>

      {/* Modal */}
      <UserModelConfigModal
        open={modalOpen}
        mode={modalMode}
        initialValues={editingModel}
        onSubmit={modalMode === "create" ? handleCreate : handleEdit}
        onCancel={() => {
          setModalOpen(false);
          setEditingModel(undefined);
        }}
        submitting={submitting}
      />
    </div>
  );
}
