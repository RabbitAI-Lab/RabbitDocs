"use client";

import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";
import { Button, Space, App } from "antd";
import {
  PlusOutlined,
  ExportOutlined,
  ImportOutlined,
  CloudServerOutlined,
} from "@ant-design/icons";
import { PROTOCOLS, getProviderDefaults, isPresetProvider } from "@/lib/model-constants";
import {
  ModelConfig,
  ModelConfigSubmitData,
  CREATE_FORM_DEFAULTS,
  CUSTOM_PROVIDER_KEY,
  splitExtraEnvToForm,
} from "./model-config-shared";
import ModelConfigModal from "./ModelConfigModal";
import ModelCard from "./ModelCard";

interface Props {
  initialModels: ModelConfig[];
}

export default function ModelsPageClient({ initialModels }: Props) {
  const [models, setModels] = useState<ModelConfig[]>(initialModels);
  const { authFetch } = useAuth();
  const t = useTranslations('admin');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [showApiKeyMap, setShowApiKeyMap] = useState<Record<number, boolean>>(
    {}
  );
  const [createInitialValues, setCreateInitialValues] = useState<
    Record<string, unknown> | undefined
  >();
  const [editInitialValues, setEditInitialValues] = useState<
    Record<string, unknown> | undefined
  >();
  const { modal, message } = App.useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(async () => {
    const res = await authFetch("/api/models");
    const data = await res.json();
    setModels(data);
  }, [authFetch]);

  // --- CRUD handlers ---

  const handleCreate = useCallback(
    async (data: ModelConfigSubmitData) => {
      await authFetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setCreateOpen(false);
      await refreshList();
    },
    [refreshList, authFetch]
  );

  const handleSaveEdit = useCallback(
    async (data: ModelConfigSubmitData) => {
      if (!editingModel) return;
      await authFetch(`/api/models/${editingModel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setEditOpen(false);
      setEditingModel(null);
      await refreshList();
    },
    [editingModel, refreshList, authFetch]
  );

  const handleSetDefault = useCallback(
    (model: ModelConfig) => {
      const newDefault = model.isDefault ? 0 : 1;
      authFetch(`/api/models/${model.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: newDefault }),
      }).then(() => {
        refreshList();
        message.success(
          newDefault
            ? t('modelsPage.msgSetAsDefault', { name: model.name })
            : t('modelsPage.msgRemovedDefault', { name: model.name })
        );
      });
    },
    [refreshList, message, authFetch, t]
  );

  const handleDelete = useCallback(
    (id: number, name: string, isDefault?: number) => {
      let content = t('modelsPage.confirmDeleteContent', { name });
      if (isDefault) {
        content += "\n\n" + t('modelsPage.confirmDeleteDefaultNote');
      }
      modal.confirm({
        title: t('modelsPage.confirmDeleteTitle'),
        content,
        okText: t('modelsPage.btnDelete'),
        cancelText: t('modelConfigModal.btnCancel'),
        okButtonProps: { danger: true },
        onOk: async () => {
          await authFetch(`/api/models/${id}`, { method: "DELETE" });
          await refreshList();
        },
      });
    },
    [modal, refreshList, authFetch, t]
  );

  const handleStartEdit = useCallback((model: ModelConfig) => {
    setEditingModel(model);
    const isPreset = isPresetProvider(model.provider);
    const envFields = splitExtraEnvToForm(model.extraEnvJson || "{}");
    setEditInitialValues({
      provider: isPreset ? model.provider : CUSTOM_PROVIDER_KEY,
      _realProvider: isPreset ? "" : model.provider,
      protocol: model.protocol || "openai",
      name: model.name,
      baseUrl: model.baseUrl,
      apiKey: model.apiKey,
      modelName: model.modelName,
      backend: model.backend || "sdk",
      disableAdaptive: envFields.disableAdaptive,
      defaultThinking: envFields.defaultThinking,
      customEnvList: envFields.customEnvList,
    });
    setEditOpen(true);
  }, []);

  // --- Import/Export ---

  const handleExport = useCallback(() => {
    if (models.length === 0) {
      message.warning(t('modelsPage.msgNoModelsToExport'));
      return;
    }
    const exportData = models.map(
      ({ id: _id, createdAt: _createdAt, updatedAt: _updatedAt, isDefault: _isDefault, ...rest }) => rest
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
    message.success(t('modelsPage.msgExported', { count: models.length }));
  }, [models, message, t]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input to allow selecting same file again
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
          message.error(t('modelsPage.msgInvalidFileFormat'));
          return;
        }

        const validProtocols = PROTOCOLS as readonly string[];
        const validItems = importList
          .map(({ isDefault: _isDefault, ...item }) => ({
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
          message.error(t('modelsPage.msgNoValidModels'));
          return;
        }

        modal.confirm({
          title: t('modelsPage.confirmImportTitle'),
          content: t('modelsPage.confirmImportContent', { count: validItems.length }),
          okText: t('modelsPage.btnImportConfirm'),
          cancelText: t('modelConfigModal.btnCancel'),
          onOk: async () => {
            let successCount = 0;
            for (const item of validItems) {
              try {
                await authFetch("/api/models", {
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
            message.success(
              t('modelsPage.msgImported', { count: successCount })
            );
          },
        });
      } catch {
        message.error(t('modelsPage.msgFileParsingFailed'));
      }
    },
    [modal, message, refreshList, authFetch, t]
  );

  // --- API Key toggle ---

  const toggleApiKeyVisibility = useCallback((id: number) => {
    setShowApiKeyMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // --- Open create modal ---

  const openCreateModal = useCallback(() => {
    const defaults = getProviderDefaults("GLM", "openai");
    setCreateInitialValues({
      ...CREATE_FORM_DEFAULTS,
      name: defaults ? `GLM-${defaults.modelName}` : undefined,
      baseUrl: defaults?.baseUrl,
      modelName: defaults?.modelName,
    });
    setCreateOpen(true);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('modelsPage.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('modelsPage.subtitle')}
          </p>
        </div>
        <Space>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            {t('modelsPage.btnExport')}
          </Button>
          <Button icon={<ImportOutlined />} onClick={handleImport}>
            {t('modelsPage.btnImport')}
          </Button>
          <Button icon={<PlusOutlined />} onClick={openCreateModal}>
            {t('modelsPage.btnAddModel')}
          </Button>
        </Space>
        {/* Hidden file input */}
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
          <div className="flex flex-col items-center justify-center h-[60%] text-gray-400 dark:text-gray-500">
            <CloudServerOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p className="text-sm">
              {t('modelsPage.emptyText')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                showApiKey={!!showApiKeyMap[model.id]}
                onToggleApiKey={toggleApiKeyVisibility}
                onSetDefault={handleSetDefault}
                onEdit={handleStartEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {createOpen && (
        <ModelConfigModal
          open={createOpen}
          mode="create"
          initialValues={createInitialValues}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
        />
      )}

      {/* Edit Modal */}
      {editOpen && (
        <ModelConfigModal
          open={editOpen}
          mode="edit"
          initialValues={editInitialValues}
          onSubmit={handleSaveEdit}
          onCancel={() => {
            setEditOpen(false);
            setEditingModel(null);
          }}
        />
      )}
    </div>
  );
}
